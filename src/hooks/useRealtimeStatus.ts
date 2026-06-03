import { useEffect, useState } from "react";

export type RealtimeStatus = "CONNECTED" | "RECONNECTING" | "OFFLINE";

type Listener = (s: RealtimeStatus) => void;

let current: RealtimeStatus = "RECONNECTING";
const channels = new Map<string, RealtimeStatus>();
const listeners = new Set<Listener>();

function recompute() {
  const states = Array.from(channels.values());
  let next: RealtimeStatus;
  if (states.length === 0) next = "RECONNECTING";
  else if (states.every((s) => s === "CONNECTED")) next = "CONNECTED";
  else if (states.some((s) => s === "CONNECTED")) next = "CONNECTED";
  else if (states.some((s) => s === "RECONNECTING")) next = "RECONNECTING";
  else next = "OFFLINE";
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l(current));
  }
}

export function reportChannelStatus(key: string, status: RealtimeStatus) {
  channels.set(key, status);
  recompute();
}

export function clearChannelStatus(key: string) {
  channels.delete(key);
  recompute();
}

export function useRealtimeStatus(): RealtimeStatus {
  const [s, setS] = useState<RealtimeStatus>(current);
  useEffect(() => {
    const l: Listener = (next) => setS(next);
    listeners.add(l);
    setS(current);
    return () => { listeners.delete(l); };
  }, []);
  return s;
}
