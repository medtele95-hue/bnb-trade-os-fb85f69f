import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

function gradeBadge(g: string) {
  const v = String(g ?? "").toUpperCase();
  if (v === "A+" || v === "A") return <Badge value={v} tone="strong-green" />;
  if (v === "B") return <Badge value={v} tone="green" />;
  if (v === "C") return <Badge value={v} tone="orange" />;
  if (v === "D") return <Badge value={v} tone="red" />;
  return <Badge value={v || "—"} tone="gray" />;
}

function gradeLabel(g: string) {
  const v = String(g ?? "").toUpperCase();
  if (v === "A+" || v === "A") return "STRONG";
  if (v === "B") return "ACCEPTABLE";
  if (v === "C") return "WEAK";
  if (v === "D") return "NO TRADE";
  return "—";
}

export function ConfluenceEnginePanel() {
  const ds = useDashboardStatusPayload() as any;
  const raw =
    ds?.confluence_engine ??
    ds?.CONFLUENCE_ENGINE ??
    ds?.raw_payload?.confluence_engine ??
    null;

  if (!raw) {
    return (
      <Panel title="CONFLUENCE ENGINE" right="LATEST">
        <div className="border border-dashed border-black/40 p-3 text-[11px] italic opacity-80">
          Waiting for Confluence Engine backend payload
        </div>
      </Panel>
    );
  }

  const grade = String(raw.grade ?? "—").toUpperCase();
  const score = raw.score ?? raw.confluence_score ?? null;

  return (
    <Panel
      title="CONFLUENCE ENGINE"
      right={
        <span className="flex items-center gap-2">
          {gradeBadge(grade)}
          <span className="opacity-80">{gradeLabel(grade)}</span>
          {raw.stale && <Badge value="STALE" tone="orange" />}
        </span>
      }
    >
      <div className="grid grid-cols-3 items-center gap-2 mb-2">
        <div>
          <div className="text-[10px] opacity-70 uppercase">Symbol</div>
          <div className="pixel text-[18px]">{raw.symbol ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] opacity-70 uppercase">Strategy</div>
          <div className="pixel text-[14px]">{raw.strategy ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] opacity-70 uppercase">Score</div>
          <div className="pixel text-[28px] leading-none">{score != null ? `${score}/100` : "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <KV k="Recommendation" v={String(raw.recommendation ?? "—").toUpperCase()} />
        <KV k="Trend" v={raw.trend ?? raw.trend_component ?? "—"} />
        <KV k="ATR Impulse" v={raw.atr_impulse ?? raw.volatility_component ?? "—"} />
        <KV k="Zone" v={String(raw.zone ?? raw.premium_discount ?? "—").toUpperCase()} />
        <KV k="Fib OTE" v={raw.fib_ote ?? raw.fibonacci_ote_zone ?? "—"} />
        <KV k="S/R Proximity" v={raw.sr_proximity ?? raw.support_resistance_proximity ?? "—"} />
        <KV k="SMC" v={String(raw.smc_status ?? "—").toUpperCase()} />
        <KV k="MTFA" v={String(raw.mtfa_status ?? "—").toUpperCase()} />
        <KV k="Order Flow Bonus" v={raw.order_flow_bonus ?? raw.orderflow_bonus ?? "—"} />
        <KV k="Order Flow Warning" v={raw.order_flow_warning ?? raw.orderflow_warning ?? "—"} />
      </div>
    </Panel>
  );
}
