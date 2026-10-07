import { ZodError } from "zod";
import { registerClient, RegistrationError, registrationSchema } from "@/lib/oauth/clients";
import { oauthError, oauthJson, preflight } from "@/lib/oauth/http";
import { HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  try {
    rateLimit(`ip:${clientIp(req)}`, "oauthRegister");
    const text = await req.text();
    if (text.length > 20_000) return oauthError("invalid_request", "Request body too large");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return oauthError("invalid_request", "Body must be valid JSON");
    }
    return oauthJson(await registerClient(registrationSchema.parse(raw)), 201);
  } catch (error) {
    if (error instanceof RegistrationError) return oauthError(error.code, error.message);
    if (error instanceof ZodError) return oauthError("invalid_client_metadata", error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
    if (error instanceof HttpError) return oauthError("temporarily_unavailable", error.message, error.status);
    console.error(error);
    return oauthError("server_error", "Registration failed", 500);
  }
}
