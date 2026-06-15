import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportChannelStatus, clearChannelStatus } from "./useRealtimeStatus";

type Options = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filter?: { column: string; value: string | number };
  pollMs?: number;
};

// Light fallback polling only — realtime is primary.
const DEFAULT_POLL_BY_TABLE: Record<string, number> = {
  bot_status: 30000,
  ai_decisions: 30000,
  trades: 30000,
  bot_logs: 30000,
  market_candles: 30000,
  account_snapshots: 30000,
  execution_events: 30000,
  markov_predictions: 60000,
  kelly_risk: 60000,
  strategy_signals: 60000,
  market_states: 60000,
  hermes_agents: 60000,
  nightly_reports: 120000,
};

const DEV = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

export function useLiveTable<T = any>(table: string, opts: Options = {}) {
  const { orderBy = "created_at", ascending = false, limit = 100, filter, pollMs } = opts;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const channelKey = `live:${table}:${filter?.column ?? ""}:${filter?.value ?? ""}:${Math.random().toString(36).slice(2)}`;

    const load = async () => {
      let data: unknown[] | null = null;
      let queryError: { message?: string } | null = null;
      try {
        let q = supabase.from(table as any).select("*").order(orderBy, { ascending }).limit(limit);
        if (filter) q = q.eq(filter.column, filter.value);
        const result = await q;
        data = result.data as unknown[] | null;
        queryError = result.error;
      } catch (err) {
        queryError = { message: err instanceof Error ? err.message : String(err) };
      }
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message ?? "Backend read unavailable");
        // keep previous rows to avoid UI flicker; only set [] if first load
        setRows((prev) => prev ?? []);
      } else {
        setRows((data ?? []) as T[]);
        setError(null);
        if (DEV) console.debug(`[live:${table}] refetch ok (${(data ?? []).length})`);
      }
    };
    loadRef.current = load;

    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelKey)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            if (DEV) console.debug(`[live:${table}] realtime event → invalidate`);
            load();
          },
        )
        .subscribe((status) => {
          if (DEV) console.debug(`[live:${table}] channel status: ${status}`);
          if (status === "SUBSCRIBED") reportChannelStatus(channelKey, "CONNECTED");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reportChannelStatus(channelKey, "RECONNECTING");
          else if (status === "CLOSED") reportChannelStatus(channelKey, "OFFLINE");
        });
    } catch (err) {
      reportChannelStatus(channelKey, "OFFLINE");
      if (DEV) console.debug(`[live:${table}] realtime unavailable`, err);
    }

    // Light fallback polling
    const interval = pollMs ?? DEFAULT_POLL_BY_TABLE[table] ?? 30000;
    const poll = window.setInterval(load, interval);

    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onReconnect = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("health:reconnect", onReconnect as EventListener);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
      clearChannelStatus(channelKey);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("health:reconnect", onReconnect as EventListener);
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
