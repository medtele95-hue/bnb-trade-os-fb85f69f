import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filter?: { column: string; value: string | number };
  pollMs?: number;
};

const DEFAULT_POLL_BY_TABLE: Record<string, number> = {
  bot_status: 3000,
  ai_decisions: 3000,
  trades: 3000,
  bot_logs: 5000,
  market_candles: 5000,
  account_snapshots: 5000,
  markov_predictions: 5000,
  kelly_risk: 5000,
  strategy_signals: 5000,
  market_states: 5000,
  execution_events: 5000,
  hermes_agents: 5000,
  nightly_reports: 10000,
};

const DEV = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

export function useLiveTable<T = any>(table: string, opts: Options = {}) {
  const { orderBy = "created_at", ascending = false, limit = 100, filter, pollMs } = opts;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let q = supabase.from(table as any).select("*").order(orderBy, { ascending }).limit(limit);
      if (filter) q = q.eq(filter.column, filter.value);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as T[]);
        if (DEV) console.debug(`[live:${table}] refetch ok (${(data ?? []).length})`);
      }
    };
    loadRef.current = load;

    load();

    const channel = supabase
      .channel(`live:${table}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (DEV) console.debug(`[live:${table}] realtime event → invalidate`);
          load();
        },
      )
      .subscribe();

    // Polling fallback
    const interval = pollMs ?? DEFAULT_POLL_BY_TABLE[table] ?? 5000;
    const poll = window.setInterval(load, interval);

    // Window focus / online refetch
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderBy, ascending, limit, filter?.column, filter?.value, pollMs]);

  return {
    rows: rows ?? [],
    loading: rows === null,
    empty: rows !== null && rows.length === 0,
    error,
    refetch: () => loadRef.current?.(),
  };
}
