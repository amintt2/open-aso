import { handleRevenueCat } from "@/lib/integrations/revenuecat";
import { bearer, workspaceForToken } from "@/lib/server/tokens";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const token = bearer(req);
  const workspaceId = await workspaceForToken("revenuecat", token);
  if (!workspaceId) {
    const hint = !token
      ? "The webhook has no Authorization header."
      : token.includes("…") || token.includes("...")
        ? "The Authorization header contains the masked token hint, not the full token."
        : !token.startsWith("oaso_rc_")
          ? "The Authorization header isn't an Open ASO RevenueCat token (it should start with oaso_rc_)."
          : "This token doesn't match any workspace — it may have been rotated.";
    throw new HttpError(
      401,
      `Unauthorized: ${hint} In Open ASO → Integrations → RevenueCat, rotate the token, copy the full value shown once, and paste it as the webhook's Authorization header.`,
    );
  }
  const payload = await req.json().catch(() => {
    throw new HttpError(400, "Body must be JSON");
  });
  return json(
    await handleRevenueCat(
      workspaceId,
      payload,
      new URL(req.url).searchParams.get("app"),
    ),
  );
});
