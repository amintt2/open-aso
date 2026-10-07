import { isCountry } from "@/lib/appstore/countries";
import { HttpError } from "@/lib/server/http";

export function scopeParam(value: string | null | undefined) {
  const scope = (value ?? "us").toLowerCase();
  if (scope !== "all" && !isCountry(scope)) throw new HttpError(400, `Unsupported country: ${scope}`);
  return scope;
}
