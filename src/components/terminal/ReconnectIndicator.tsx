import { useHealthAutoReconnect } from "@/hooks/useHealthAutoReconnect";
import { T } from "./primitives";

/**
 * Live status indicator with auto-reconnect feedback.
 * Read-only: no buttons, no execution controls.
 */
export function ReconnectIndicator() {
  const r = useHealthAutoReconnect();

  const dotColor =
    r.status === "ONLINE" ? "#16a34a" :
    r.status === "RECONNECTING" ? "#f59e0b" : "#dc2626";

  const label =
    r.status === "ONLINE" ? "LIVE" :
    r.status === "RECONNECTING" ? "RECONNECTING" : "OFFLINE";

  const detail =
    r.status === "ONLINE"
      ? (r.lastRecoveredAt ? "recovered" : "stable")
      : r.nextInSec != null
        ? `attempt ${r.attempt + 1} · next ${r.nextInSec}s`
        : `attempt ${r.attempt}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] tabular-nums"
      style={{
        border: `1px solid ${T.border}`,
        background: T.panel,
        color: T.dim,
        fontFamily: "JetBrains Mono, monospace",
      }}
      title={
        r.lastAttemptAt
          ? `Last reconnect attempt: ${new Date(r.lastAttemptAt).toLocaleTimeString()}`
          : "Auto-reconnect armed"
      }
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
          boxShadow: `0 0 0 0 ${dotColor}`,
          animation: r.status === "ONLINE"
            ? "rc-pulse 1.6s ease-out infinite"
            : r.status === "RECONNECTING"
              ? "rc-blink 0.9s ease-in-out infinite"
              : "none",
        }}
      />
      <span style={{ color: dotColor, fontWeight: 700 }}>{label}</span>
      <span style={{ color: T.faint }}>· {detail}</span>
      <style>{`
        @keyframes rc-pulse {
          0%   { box-shadow: 0 0 0 0   ${dotColor}80; }
          70%  { box-shadow: 0 0 0 6px ${dotColor}00; }
          100% { box-shadow: 0 0 0 0   ${dotColor}00; }
        }
        @keyframes rc-blink {
          0%, 100% { opacity: 1;   }
          50%      { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
