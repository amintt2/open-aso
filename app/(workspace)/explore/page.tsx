import ExplorePage from "@/components/explore/explore-page";
import { isCountry } from "@/lib/appstore/countries";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; country?: string }> }) {
  const { q, country } = await searchParams;
  const code = country?.toLowerCase();
  return <ExplorePage initialQuery={q?.trim() ?? ""} initialCountry={code && isCountry(code) ? code : "us"} />;
}
