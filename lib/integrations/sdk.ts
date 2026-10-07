import fs from "node:fs/promises";
import path from "node:path";

export type SdkPlatform = "swift" | "react-native" | "flutter";

export type SdkSnippet = {
  platform: SdkPlatform;
  title: string;
  filename: string;
  language: string;
  description: string;
  code: string;
};

const FILES: Omit<SdkSnippet, "code">[] = [
  {
    platform: "swift",
    title: "OpenASO.swift",
    filename: "swift/OpenASO.swift.tpl",
    language: "swift",
    description:
      "Drop this file into your iOS target. It reads the AdServices token once and posts it with a stable anonymous user id.",
  },
  {
    platform: "swift",
    title: "App entry point",
    filename: "swift/Usage.swift.tpl",
    language: "swift",
    description:
      "Start Open ASO at launch and tag the RevenueCat subscriber with the same id so revenue joins back to the install.",
  },
  {
    platform: "react-native",
    title: "OpenAsoAttributionModule.swift",
    filename: "react-native/OpenAsoAttributionModule.swift.tpl",
    language: "swift",
    description:
      "Create a local Expo module (npx create-expo-module --local open-aso-attribution) and replace its iOS module with this.",
  },
  {
    platform: "react-native",
    title: "expo-module.config.json",
    filename: "react-native/expo-module.config.json.tpl",
    language: "json",
    description: "Module config for the local Expo module.",
  },
  {
    platform: "react-native",
    title: "openAso.ts",
    filename: "react-native/openAso.ts.tpl",
    language: "typescript",
    description:
      "Call startOpenAso() once after Purchases.configure(). Requires @react-native-async-storage/async-storage, expo-application and expo-localization.",
  },
  {
    platform: "flutter",
    title: "AppDelegate.swift",
    filename: "flutter/AppDelegate.swift.tpl",
    language: "swift",
    description:
      "Expose the AdServices token to Dart over a method channel (ios/Runner/AppDelegate.swift).",
  },
  {
    platform: "flutter",
    title: "open_aso.dart",
    filename: "flutter/open_aso.dart.tpl",
    language: "dart",
    description:
      "Call OpenAso.start() after Purchases.configure(). Requires http and shared_preferences.",
  },
];

export async function sdkSnippets(
  origin: string,
  bundleId: string | null,
): Promise<SdkSnippet[]> {
  const root = path.join(process.cwd(), "sdk");
  return Promise.all(
    FILES.map(async (file) => {
      const source = await fs
        .readFile(path.join(root, file.filename), "utf8")
        .catch(() => "");
      return {
        ...file,
        filename: file.filename.replace(/\.tpl$/, ""),
        code: source
          .replaceAll("__OPEN_ASO_URL__", origin.replace(/\/$/, ""))
          .replaceAll("__BUNDLE_ID__", bundleId ?? "com.example.app")
          .trimEnd(),
      };
    }),
  );
}

export function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto =
    req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
