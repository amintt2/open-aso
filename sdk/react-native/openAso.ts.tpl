import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { getLocales } from "expo-localization";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

const BASE_URL = "__OPEN_ASO_URL__";
const SDK_TOKEN = "__OPEN_ASO_TOKEN__";
const BUNDLE_ID = Application.applicationId ?? "__BUNDLE_ID__";
const USER_KEY = "open_aso.user_id";
const INSTALL_KEY = "open_aso.install_sent";

const attribution = requireOptionalNativeModule<{ attributionToken(): Promise<string | null> }>("OpenAsoAttribution");

async function post(path: string, body: Record<string, string | undefined>) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SDK_TOKEN}` },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function openAsoUserId() {
  const existing = await AsyncStorage.getItem(USER_KEY);
  if (existing) return existing;
  const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(USER_KEY, created);
  return created;
}

export async function startOpenAso() {
  const userId = await openAsoUserId();
  Purchases.setAttributes({ openAsoId: userId });
  if (!(await AsyncStorage.getItem(INSTALL_KEY))) {
    const adServicesToken = Platform.OS === "ios" ? ((await attribution?.attributionToken().catch(() => null)) ?? undefined) : undefined;
    const ok = await post("/api/attribution/install", { bundleId: BUNDLE_ID, userId, adServicesToken, country: getLocales()[0]?.regionCode ?? undefined });
    if (ok) await AsyncStorage.setItem(INSTALL_KEY, "1");
  }
  await post("/api/attribution/event", { bundleId: BUNDLE_ID, userId, name: "session" });
  return userId;
}
