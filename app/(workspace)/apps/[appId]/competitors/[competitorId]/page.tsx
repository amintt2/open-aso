import { notFound } from "next/navigation";
import CompetitorDetail from "@/components/competitors/competitor-detail";

export default async function Page({ params }: { params: Promise<{ competitorId: string }> }) {
  const id = Number((await params).competitorId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <CompetitorDetail key={id} competitorId={id} />;
}
