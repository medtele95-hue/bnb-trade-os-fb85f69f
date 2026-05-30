import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";

function get(obj: any, key: string, fallback: any = undefined) {
  if (!obj) return fallback;
  const v = obj[key];
  return v == null ? fallback : v;
}

function unknownIf(v: any) {
  if (v == null || v === "") return "UNKNOWN";
  return v;
}

export function SafetyGuard() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 50 });
  const latest = rows[0];
  if (empty || !latest) {
    return (
      <Panel title="SAFETY GUARD" right="GUARD v1">
        <Waiting label="WAITING FOR SAFETY GUARD DATA" />
      </Panel>
    );
  }
  const rp = latest.raw_payload ?? {};

  const status = unknownIf(get(rp, "safety_guard_status"));
  const latestStatus = unknownIf(get(rp, "safety_guard_latest_status") ?? get(rp, "safety_guard_check"));
  const reason = unknownIf(get(rp, "safety_guard_reason"));
  const rules = get(rp, "safety_guard_rules_triggered", []) as any[];
  const action = unknownIf(get(rp, "safety_guard_action"));
  const localHour = unknownIf(get(rp, "safety_guard_local_hour"));
  const isWeekend = get(rp, "safety_guard_is_weekend");
  const tz = unknownIf(get(rp, "safety_guard_timezone"));

  // aggregate stats across recent decisions
  let blocked = 0, caution = 0, allowed = 0;
  const reasonCount: Record<string, number> = {};
  const symbolCount: Record<string, number> = {};
  const strategyCount: Record<string, number> = {};
  const hourCount: Record<string, number> = {};
  for (const r of rows) {
    const p = r.raw_payload ?? {};
    const s = String(p.safety_guard_status ?? "").toUpperCase();
    if (s === "BLOCK" || s === "BLOCKED") {
      blocked++;
      const reas = String(p.safety_guard_reason ?? "—");
      reasonCount[reas] = (reasonCount[reas] ?? 0) + 1;
      if (r.symbol) symbolCount[r.symbol] = (symbolCount[r.symbol] ?? 0) + 1;
      if (r.strategy) strategyCount[r.strategy] = (strategyCount[r.strategy] ?? 0) + 1;
      const hr = p.safety_guard_local_hour;
      if (hr != null) hourCount[String(hr)] = (hourCount[String(hr)] ?? 0) + 1;
    } else if (s === "CAUTION") caution++;
    else if (s === "PASS") allowed++;
  }

  const top = (m: Record<string, number>) =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <Panel title="SAFETY GUARD" right="GUARD v1">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge value={`STATUS: ${status}`} tone={statusTone(status)} />
        <Badge value={`LATEST: ${latestStatus}`} tone={statusTone(latestStatus)} />
        <Badge value={`ACTION: ${action}`} tone={statusTone(action)} />
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="Local Hour" v={String(localHour)} />
        <KV k="Weekend" v={isWeekend == null ? "UNKNOWN" : isWeekend ? "true" : "false"} />
        <KV k="Timezone" v={String(tz)} />
        <KV k="Rules Triggered" v={Array.isArray(rules) && rules.length ? rules.join(", ") : "—"} />
      </div>
      <div className="mt-1 text-[10px] opacity-80"><b>REASON:</b> {String(reason)}</div>

      <div className="mt-2 border-t border-dashed border-black/40 pt-1 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[9px] uppercase opacity-70">Allowed</div><div className="pixel text-[18px] text-profit">{allowed}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Caution</div><div className="pixel text-[18px]">{caution}</div></div>
        <div><div className="text-[9px] uppercase opacity-70">Blocked</div><div className="pixel text-[18px] text-loss">{blocked}</div></div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="font-bold uppercase opacity-70">Top Blocked Reasons</div>
          {top(reasonCount).length === 0 ? <div className="opacity-60">—</div> : top(reasonCount).map(([k, v]) => (
            <div key={k} className="truncate">{v}× {k}</div>
          ))}
        </div>
        <div>
          <div className="font-bold uppercase opacity-70">Blocked by Symbol</div>
          {top(symbolCount).length === 0 ? <div className="opacity-60">—</div> : top(symbolCount).map(([k, v]) => (
            <div key={k}>{v}× {k}</div>
          ))}
        </div>
        <div>
          <div className="font-bold uppercase opacity-70">Blocked by Strategy</div>
          {top(strategyCount).length === 0 ? <div className="opacity-60">—</div> : top(strategyCount).map(([k, v]) => (
            <div key={k}>{v}× {k}</div>
          ))}
        </div>
        <div>
          <div className="font-bold uppercase opacity-70">Blocked by Hour</div>
          {top(hourCount).length === 0 ? <div className="opacity-60">—</div> : top(hourCount).map(([k, v]) => (
            <div key={k}>{v}× h{k}</div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
