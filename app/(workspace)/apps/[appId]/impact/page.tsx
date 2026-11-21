import { Suspense } from "react";
import ImpactView from "@/components/impact/impact-view";

export default function Page() {
  return (
    <Suspense>
      <ImpactView />
    </Suspense>
  );
}
