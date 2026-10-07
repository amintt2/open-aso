import { isCountry } from "@/lib/appstore/countries";
import { HttpError } from "@/lib/server/http";

export function countryParam(req: Request, fallback = "us") {
  const value = (new URL(req.url).searchParams.get("country") ?? fallback).toLowerCase();
  if (!isCountry(value)) throw new HttpError(400, `Unsupported country: ${value}`);
  return value;
}

export async function trackIdParam(params: Promise<{ trackId: string }>) {
  const value = Number((await params).trackId);
  if (!Number.isInteger(value) || value <= 0) throw new HttpError(400, "Invalid trackId");
  return value;
}
