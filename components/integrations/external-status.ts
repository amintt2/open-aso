"use client";

import useSWR from "swr";
import { api, ApiError } from "@/lib/client/api";

export type AscStatusLite = {
  configured: boolean;
  connected: boolean;
  error: string | null;
  sampleApp?: { name?: string } | string | null;
  keyId?: string | null;
};
export type AdsStatusLite = {
  connection: {
    configured: boolean;
    connected: boolean;
    orgName: string | null;
    orgId: string | null;
    currency?: string;
    lastError?: string | null;
    lastCheckedAt?: string | null;
  };
};

async function optional<T>(url: string): Promise<T | null> {
  try {
    return await api<T>(url);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 405)
    )
      return null;
    throw error;
  }
}

export function useOptionalApi<T>(url: string) {
  return useSWR<T | null>(url, optional<T>, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}
