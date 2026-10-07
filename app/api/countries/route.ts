import { COUNTRIES } from "@/lib/appstore/countries";
import { json } from "@/lib/server/http";

export const GET = () => json(COUNTRIES);
