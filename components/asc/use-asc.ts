"use client";

import { useApi } from "@/lib/client/api";
import type { AscStatus } from "@/lib/asc/types";

export function useAscStatus() {
  const { data, error, isLoading, mutate } = useApi<AscStatus>("/api/asc/status");
  return { status: data, error, isLoading, mutate, ready: !!data?.connected };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error";
}
