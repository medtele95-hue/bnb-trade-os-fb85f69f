import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global last-event timestamp per table (ms epoch). Updated by realtime
// subscriptions started in useTableHeartbeat. Multiple components can read
// the same table heartbeat without spawning more channels.

type Listener = () => void;
const lastEventMs: Record<string, number> = {};
const subscriberCounts: Record<string, number> = {};
const channels: Record<string, any> = {};
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function subscribeTable(table: string) {
  subscriberCounts[table] = (subscriberCounts[table] ?? 0) + 1;
  if (channels[table]) return;
  const ch = supabase
    .channel(`heartbeat:${table}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        lastEventMs[table] = Date.now();
        emit();
      },
    )
    .subscribe();
  channels[table] = ch;
}

function unsubscribeTable(table: string) {
  subscriberCounts[table] = Math.max(0, (subscriberCounts[table] ?? 0) - 1);
  if (subscriberCounts[table] === 0 && channels[table]) {
    try {
      supabase.removeChannel(channels[table]);
    } catch {}
    delete channels[table];
  }
}

function subscribeStore(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Subscribe to a table's heartbeat. Returns last event ms (or null). */
export function useTableHeartbeat(table: string): number | null {
  useEffect(() => {
    subscribeTable(table);
    return () => unsubscribeTable(table);
  }, [table]);
  return useSyncExternalStore(
    subscribeStore,
    () => lastEventMs[table] ?? null,
    () => null,
  );
}
