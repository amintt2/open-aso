import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { SignJWT } from "jose";
import { getSetting, setSetting } from "@/lib/server/settings";
import { HttpError } from "@/lib/server/http";

export const TOKEN_URL = "https://appleid.apple.com/auth/oauth2/token";
export const AUDIENCE = "https://appleid.apple.com";
export const SCOPE = "searchadsorg";
const SECRET_TTL_SECONDS = 60 * 60 * 24 * 30;

export class AppleAdsError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { messageCode?: string; message?: string; field?: string }[] = [],
  ) {
    super(message);
  }
}

export type Credentials = { clientId: string; teamId: string; keyId: string; privateKey: string };

export function readCredentials(): Partial<Credentials> {
  return {
    clientId: getSetting("ads.clientId"),
    teamId: getSetting("ads.teamId"),
    keyId: getSetting("ads.keyId"),
    privateKey: getSetting("ads.privateKey"),
  };
}

export function requireCredentials(): Credentials {
  const c = readCredentials();
  if (!c.clientId || !c.teamId || !c.keyId || !c.privateKey)
    throw new HttpError(409, "Apple Ads is not connected. Add your client ID, team ID, key ID and key pair first.");
  return c as Credentials;
}

function loadPrivateKey(pem: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPrivateKey(pem.trim());
  } catch {
    throw new HttpError(400, "The private key is not a valid PEM key.");
  }
  const details = key.asymmetricKeyDetails;
  if (key.asymmetricKeyType !== "ec" || (details?.namedCurve && details.namedCurve !== "prime256v1"))
    throw new HttpError(400, "Apple Ads requires an EC P-256 (prime256v1) key.");
  return key;
}

export function generateKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  setSetting("ads.privateKey", privateKey);
  setSetting("ads.publicKey", publicKey);
  resetToken();
  return { publicKey };
}

export function importPrivateKey(pem: string) {
  const key = loadPrivateKey(pem);
  const publicKey = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
  setSetting("ads.privateKey", key.export({ type: "pkcs8", format: "pem" }).toString());
  setSetting("ads.publicKey", publicKey);
  resetToken();
  return { publicKey };
}

export async function createClientSecret(c: Credentials, now = Math.floor(Date.now() / 1000)) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: c.keyId })
    .setSubject(c.clientId)
    .setIssuer(c.teamId)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SECRET_TTL_SECONDS)
    .sign(loadPrivateKey(c.privateKey));
}

type TokenState = { token: string; expiresAt: number; fingerprint: string };
type GlobalWithToken = typeof globalThis & { __openAsoAdsToken?: TokenState; __openAsoAdsTokenPending?: Promise<string> };

function fingerprint(c: Credentials) {
  return createHash("sha256").update(`${c.clientId}|${c.teamId}|${c.keyId}|${c.privateKey}`).digest("hex");
}

export function resetToken() {
  const g = globalThis as GlobalWithToken;
  g.__openAsoAdsToken = undefined;
  g.__openAsoAdsTokenPending = undefined;
}

async function exchange(c: Credentials): Promise<TokenState> {
  const secret = await createClientSecret(c);
  const form = new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: secret, scope: SCOPE });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    const reason = data.error_description ?? data.error ?? `HTTP ${res.status}`;
    const hint =
      data.error === "invalid_client"
        ? " Check that the client ID, team ID and key ID match the public key uploaded in Apple Ads → Account Settings → API."
        : "";
    throw new AppleAdsError(res.status === 400 ? 401 : res.status, `Apple sign-in failed: ${reason}.${hint}`);
  }
  return { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000, fingerprint: fingerprint(c) };
}

export async function getAccessToken(force = false): Promise<string> {
  const c = requireCredentials();
  const g = globalThis as GlobalWithToken;
  const fp = fingerprint(c);
  const current = g.__openAsoAdsToken;
  if (!force && current && current.fingerprint === fp && current.expiresAt - 60_000 > Date.now()) return current.token;
  if (!force && g.__openAsoAdsTokenPending) return g.__openAsoAdsTokenPending;
  const pending = exchange(c)
    .then((state) => {
      g.__openAsoAdsToken = state;
      return state.token;
    })
    .finally(() => {
      g.__openAsoAdsTokenPending = undefined;
    });
  g.__openAsoAdsTokenPending = pending;
  return pending;
}
