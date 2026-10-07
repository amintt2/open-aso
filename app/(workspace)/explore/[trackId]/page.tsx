import { notFound } from "next/navigation";
import ExploreDetail from "@/components/explore/explore-detail";
import { isCountry } from "@/lib/appstore/countries";

export default async function Page({ params, searchParams }: { params: Promise<{ trackId: string }>; searchParams: Promise<{ country?: string }> }) {
  const trackId = Number((await params).trackId);
  if (!Number.isInteger(trackId) || trackId <= 0) notFound();
  const requested = (await searchParams).country?.toLowerCase();
  const country = requested && isCountry(requested) ? requested : "us";
  return <ExploreDetail key={trackId} trackId={trackId} initialCountry={country} />;
}
