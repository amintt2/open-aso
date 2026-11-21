import { Suspense } from "react";
import TrafficView from "@/components/traffic/traffic-view";

export default function Page() {
  return (
    <Suspense>
      <TrafficView />
    </Suspense>
  );
}
