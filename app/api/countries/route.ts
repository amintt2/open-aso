import { COUNTRIES } from "@/lib/appstore/countries";
import { requireUser } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  await requireUser();
  return json(COUNTRIES);
});
