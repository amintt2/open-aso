"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatDate } from "@/lib/explore/format";
import type { CountryReview } from "@/lib/reviews/types";
import Stars from "./stars";

export default function ReviewCard({ review, showCountry }: { review: CountryReview; showCountry: boolean }) {
  const [open, setOpen] = useState(false);
  const long = review.content.length > 360;
  const country = COUNTRY_BY_CODE.get(review.country);
  return (
    <article className="bg-card border-border flex flex-col gap-2.5 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Stars value={review.rating} />
        <h3 className="lead-style min-w-0 flex-1 truncate font-medium">{review.title || "Untitled review"}</h3>
        <span className="caption-style text-subtle">{formatDate(review.updated)}</span>
      </header>
      <p className="text-soft leading-[1.5] break-words whitespace-pre-line">{open || !long ? review.content : `${review.content.slice(0, 360).trimEnd()}…`}</p>
      <footer className="caption-style text-subtle flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate">{review.author}</span>
        {review.version && <span>· v{review.version}</span>}
        {showCountry && country && (
          <span>
            · {country.flag} {country.name}
          </span>
        )}
        {long && (
          <Button variant="link" size="none" className="caption-style ml-auto" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Show less" : "Read more"}
          </Button>
        )}
      </footer>
    </article>
  );
}
