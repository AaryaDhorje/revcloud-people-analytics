"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, filtersToQuery } from "./api";
import { useFilters } from "@/components/dashboard/FilterContext";
import { useLiveUpdates } from "./use-live-updates";

/**
 * Fetches a filtered analytics endpoint and keeps it live.
 *
 * Refetches when the filters change and again whenever the SSE stream reports
 * that the underlying data moved — so an admin's upload appears on everyone
 * else's dashboard without a manual refresh.
 */
export function useAnalytics<T>(path: string) {
  const { filters } = useFilters();
  const query = filtersToQuery(filters);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow earlier response overwriting a newer one when
  // filters change quickly.
  const requestId = useRef(0);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const id = ++requestId.current;
      if (options.silent) setRefreshing(true);
      else setLoading(true);

      try {
        const result = await apiFetch<T>(`${path}${query}`);
        if (id === requestId.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (id === requestId.current) {
          setError(err instanceof Error ? err.message : "Unable to load data.");
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, query],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onLiveChange = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const { status, lastEventAt } = useLiveUpdates(onLiveChange);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => load({ silent: true }),
    liveStatus: status,
    lastEventAt,
  };
}
