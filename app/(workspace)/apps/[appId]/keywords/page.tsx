import { Suspense } from "react";
import KeywordsView from "@/components/keywords/keywords-view";

export default function Page() {
  return (
    <Suspense>
      <KeywordsView />
    </Suspense>
  );
}
