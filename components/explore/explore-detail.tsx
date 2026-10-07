"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/_ui/button";
import CountrySelect from "@/components/shell/country-select";
import PageHeader from "@/components/shell/page-header";
import AppActions from "./app-actions";
import AppProfile from "./app-profile";

export default function ExploreDetail({ trackId, initialCountry }: { trackId: number; initialCountry: string }) {
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry);

  function changeCountry(code: string) {
    setCountry(code);
    router.replace(`/explore/${trackId}?country=${code}`, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" href={`/explore?country=${country}`} aria-label="Back to Explore">
              <ArrowLeft aria-hidden className="size-4" />
            </Button>
            Explore
          </span>
        }
        actions={<CountrySelect value={country} onChange={changeCountry} />}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AppProfile trackId={trackId} country={country} onCountryChange={changeCountry} actions={(detail) => <AppActions detail={detail} />} />
      </div>
    </>
  );
}
