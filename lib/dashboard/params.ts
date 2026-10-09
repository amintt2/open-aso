import { isCountry } from "@/lib/appstore/countries";
import { HttpError } from "@/lib/server/http";

export function countryParam(req: Request) {
  const value = (new URL(req.url).searchParams.get("country") ?? "all")
    .trim()
    .toLowerCase();
  if (value !== "all" && !isCountry(value))
    throw new HttpError(400, "Unsupported country");
  return value;
}

export function optionalAppId(req: Request) {
  const raw = new URL(req.url).searchParams.get("appId");
  if (!raw || raw === "all") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0)
    throw new HttpError(400, "Invalid appId");
  return id;
}

export function daysParam(req: Request): 7 | 30 {
  return new URL(req.url).searchParams.get("days") === "7" ? 7 : 30;
}
