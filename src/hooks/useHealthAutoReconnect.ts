import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBackendHealth } from "@/hooks/useBackendHealth";

export type ReconnectState = {
  status: "ONLINE" | "RECONNECTING" | "OFFLINE";
  attempt: number;
  nextInSec: number | null;
  lastAttemptAt: number | null;
  lastRecoveredAt: number | null;
};

const RECONNECT_EVENT = "health:reconnect";

/** Trigger refetch in any subscriber (useLiveTable listens to this). */
export function broadcastReconnect() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RECONNECT_EVENT));
  }
}

export const HEALTH_RECONNECT_EVENT = RECONNECT_EVENT;

/**
 * Auto-reconnect strategy when the backend health verdict drops out of ONLINE.
 *
 * - Exponential backoff (2s → 4s → 8s → … capped at 30s).
 * - Each attempt: re-open Supabase realtime socket and broadcast a refetch
 *   event so every useLiveTable hook re-queries immediately.
 * - Also retries on `online` / `visibilitychange` events.
 * - When the verdict returns to ONLINE, resets attempt counter and emits
 *   a single "recovered" tick.
 */
export function useHealthAutoReconnect(): ReconnectState {
  const h = useBackendHealth();
  const [attempt, setAttempt] = useState(0);
  const [nextInSec, setNextInSec] = useState<number | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [lastRecoveredAt, setLastRecoveredAt] = useState<number | null>(null);
  const wasOnlineRef = useRef<boolean>(h.verdict === "ONLINE");
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const verdict = h.verdict;
  const isDown = verdict !== "ONLINE";

  // Reset on recovery.
  useEffect(() => {
    if (verdict === "ONLINE") {
      if (!wasOnlineRef.current) setLastRecoveredAt(Date.now());
      wasOnlineRef.current = true;
      attemptRef.current = 0;
      setAttempt(0);
      setNextInSec(null);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else {
      wasOnlineRef.current = false;
    }
  }, [verdict]);

  // Backoff scheduler.
  useEffect(() => {
    if (!isDown) return;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const n = attemptRef.current;
      const delay = Math.min(30_000, 2_000 * Math.pow(2, n)); // 2,4,8,16,30,30…
      const startedAt = Date.now();
      setNextInSec(Math.ceil(delay / 1000));

      const tick = window.setInterval(() => {
        const remain = Math.max(0, Math.ceil((delay - (Date.now() - startedAt)) / 1000));
        setNextInSec(remain);
        if (remain <= 0) window.clearInterval(tick);
      }, 1000);

      timerRef.current = window.setTimeout(() => {
        window.clearInterval(tick);
        if (cancelled) return;
        attemptRef.current = n + 1;
        setAttempt(attemptRef.current);
        setLastAttemptAt(Date.now());
        try {
          // Re-open realtime socket and refetch every live table.
          (supabase as any)?.realtime?.connect?.();
        } catch {}
        broadcastReconnect();
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    const kick = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try { (supabase as any)?.realtime?.connect?.(); } catch {}
      broadcastReconnect();
      setLastAttemptAt(Date.now());
      attemptRef.current = attemptRef.current + 1;
      setAttempt(attemptRef.current);
      scheduleNext();
    };
    const onOnline = () => kick();
    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isDown]);

  return {
    status: verdict === "ONLINE" ? "ONLINE" : verdict === "OFFLINE" ? "OFFLINE" : "RECONNECTING",
    attempt,
    nextInSec,
    lastAttemptAt,
    lastRecoveredAt,
  };
}
