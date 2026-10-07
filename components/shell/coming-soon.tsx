"use client";

import { Construction } from "lucide-react";
import EmptyState from "./empty-state";
import PageHeader from "./page-header";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={Construction} title={`${title} is being built`} description="This module is under construction." />
    </>
  );
}
