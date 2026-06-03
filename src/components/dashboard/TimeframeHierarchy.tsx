import { Panel } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

type Row = { key: string; label: string; role: string };

const ROWS: Row[] = [
  { key: "d1", label: "D1", role: "Macro" },
  { key: "h4", label: "H4", role: "Main Direction" },
  { key: "h1", label: "H1", role: "Internal Structure" },
  { key: "m15", label: "M15", role: "Confirmation" },
  { key: "m5", label: "M5", role: "Context" },
  { key: "m1", label: "M1", role: "Trigger Only" },
];

function biasTone(v: string | null | undefined): "green" | "red" | "orange" | "gray" {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("BULL") || s === "BUY" || s === "LONG" || s === "UP") return "green";
  if (s.includes("BEAR") || s === "SELL" || s === "SHORT" || s === "DOWN") return "red";
  if (s === "NEUTRAL" || s === "RANGE" || s === "WAIT" || s === "MIXED") return "orange";
  return "gray";
}

export function TimeframeHierarchyPanel() {
  const { rows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const ds = useDashboardStatusPayload();
  const d = rows[0];
  const rp = (d?.raw_payload ?? {}) as any;
  const inner = (rp?.raw_payload ?? {}) as any;
  const latest = (rp?.latest_decision ?? ds?.latest_decision ?? {}) as any;
  const tfh = (rp?.timeframe_hierarchy ?? inner?.timeframe_hierarchy ?? latest?.timeframe_hierarchy ?? ds?.timeframe_hierarchy ?? {}) as any;
  const m = { ...ds, ...rp, ...inner, ...latest, ...tfh };

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = m?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const biasOf = (tf: string) =>
    pick(
      `${tf}_bias`,
      `bias_${tf}`,
      `${tf.toUpperCase()}_bias`,
      `${tf}`,
      `${tf}_direction`,
      `${tf}_trend`,
    );

  const score = pick("timeframe_alignment_score", "tf_alignment_score", "alignment_score");
  const m1Signal = pick("m1_signal", "m1_trigger");

  const d1 = biasOf("d1");
  const h4 = biasOf("h4");
  const h1 = biasOf("h1");
  const m15 = biasOf("m15");
  const m5 = biasOf("m5");
  const m1 = biasOf("m1") ?? m1Signal;

  const hasAny = [d1, h4, h1, m15, m5, m1, score].some((v) => v !== undefined && v !== null && v !== "");

  const values: Record<string, any> = { d1, h4, h1, m15, m5, m1 };

  const ready = (v: any) => {
    const s = String(v ?? "").toUpperCase();
    return s && s !== "—" && s !== "UNKNOWN" && s !== "WAIT" && s !== "NEUTRAL";
  };
  const m1HasSignal = ready(m1);
  const htfReady = ready(h4) && ready(h1) && ready(m15);
  const showM1Only = m1HasSignal && !htfReady;

  const scoreTone =
    typeof score === "number"
      ? score >= 75
        ? "text-profit"
        : score >= 50
          ? "text-orange-700"
          : "text-loss"
      : "opacity-70";

  return (
    <Panel title="TIMEFRAME HIERARCHY" right="READ-ONLY">
      {!hasAny ? (
        <div className="text-[11px] italic opacity-80 p-2">Waiting for timeframe hierarchy data</div>
      ) : (
        <>
          <div className="flex items-baseline justify-between border-b border-black pb-1 mb-2">
            <div className="text-[10px] uppercase opacity-70">Timeframe Alignment Score</div>
            <div className={`pixel text-[16px] ${scoreTone}`}>
              {score != null ? `${score}/100` : "—/100"}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {ROWS.map((r) => {
              const v = values[r.key];
              const label = v ? String(v).toUpperCase() : "—";
              return (
                <div
                  key={r.key}
                  className="grid grid-cols-12 items-center gap-2 border border-black/40 px-1.5 py-1"
                >
                  <div className="col-span-2 pixel text-[12px]">{r.label}</div>
                  <div className="col-span-5 text-[10px] uppercase opacity-80">{r.role}</div>
                  <div className="col-span-5 text-right">
                    <Badge value={label} tone={biasTone(v)} />
                  </div>
                </div>
              );
            })}
          </div>

          {showM1Only && (
            <div className="mt-2 border border-black bg-orange-200 text-orange-950 px-2 py-1 text-[11px] font-bold uppercase tracking-wider">
              ⚠ M1 Signal Only — No Trade
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
