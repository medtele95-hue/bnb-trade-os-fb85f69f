import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useDashboardStatusPayload } from "./DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { isSameSymbol, normalizeSymbol } from "@/lib/symbol";

const STRATEGY = "ORDER_FLOW_READER";
const DEFAULT_SYMBOLS = ["BTCUSD", "XAUUSD", "EURUSD"] as const;

function fmt(v: any, digits = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(digits) : "—";
  const n = Number(v);
  if (Number.isFinite(n)) return n.toFixed(digits);
  return String(v);
}

function ageSecFrom(ts: any): number | null {
  if (!ts) return null;
  const d = new Date(String(ts).replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
}

type Snap = Record<string, any>;

/** Find an order-flow snapshot for a given symbol from various possible locations. */
function collectSnapshots(ds: Snap, decisions: any[]): Record<string, Snap> {
  const out: Record<string, Snap> = {};

  const tryMerge = (sym: string | undefined | null, snap: any) => {
    if (!snap || typeof snap !== "object") return;
    const s = normalizeSymbol(sym ?? snap.symbol ?? "");
    if (!s) return;
    // Prefer the freshest snapshot we see first.
    if (!out[s]) out[s] = { ...snap, symbol: snap.symbol ?? sym };
  };

  // dashboard_status keyed payloads
  const containers: any[] = [
    ds.order_flow_reader,
    ds.ORDER_FLOW_READER,
    ds.order_flow,
    ds.raw_payload?.order_flow_reader,
    ds.raw_payload?.ORDER_FLOW_READER,
  ].filter(Boolean);

  for (const c of containers) {
    if (Array.isArray(c)) {
      c.forEach((snap) => tryMerge(snap?.symbol, snap));
    } else if (typeof c === "object") {
      // Could be keyed by symbol or a single snapshot
      if (c.symbol) {
        tryMerge(c.symbol, c);
      }
      for (const [k, v] of Object.entries(c)) {
        if (v && typeof v === "object" && !Array.isArray(v) && (("poc" in (v as any)) || ("vwap" in (v as any)) || ("symbol" in (v as any)) || ("status" in (v as any)))) {
          tryMerge(k, v);
        }
      }
    }
  }

  // ai_decisions raw_payload
  for (const d of decisions) {
    const rp = d?.raw_payload ?? {};
    const ofr =
      rp.order_flow_reader ??
      rp.ORDER_FLOW_READER ??
      rp[STRATEGY] ??
      null;
    if (ofr) {
      if (Array.isArray(ofr)) ofr.forEach((s) => tryMerge(s?.symbol, s));
      else if (typeof ofr === "object") {
        if (ofr.symbol) tryMerge(ofr.symbol, ofr);
        for (const [k, v] of Object.entries(ofr)) {
          if (v && typeof v === "object" && !Array.isArray(v)) tryMerge(k, v);
        }
      }
    }
  }

  return out;
}

const CORE_FIELDS = ["status", "symbol", "poc", "vah", "val", "vwap", "cvd_slope", "cvd_proxy", "delta_proxy", "divergence", "last_update"];

function missingFieldsOf(snap: Snap): string[] {
  const list = Array.isArray(snap.missing_fields) ? snap.missing_fields.map((s: any) => String(s)) : [];
  const computed = CORE_FIELDS.filter((f) => {
    const v = snap[f];
    return v === undefined || v === null || v === "";
  });
  return Array.from(new Set([...list, ...computed]));
}

/** Tiny SVG sparkline. */
function Spark({
  data,
  height = 28,
  width = 160,
  stroke = "currentColor",
  zeroLine = false,
  bars = false,
  label,
}: {
  data: Array<number | null | undefined>;
  height?: number;
  width?: number;
  stroke?: string;
  zeroLine?: boolean;
  bars?: boolean;
  label?: string;
}) {
  const pts = (data ?? []).map((v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v)));
  const valid = pts.filter((v): v is number => v != null);
  if (valid.length < 2) {
    return (
      <div className="text-[9px] opacity-60 uppercase tracking-wider">{label ?? "chart"}: no data</div>
    );
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const stepX = width / Math.max(1, pts.length - 1);
  const y = (v: number) => height - ((v - min) / range) * height;
  const zeroY = min <= 0 && max >= 0 ? y(0) : null;
  return (
    <svg width={width} height={height} className="block">
      {zeroLine && zeroY != null && (
        <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 2" />
      )}
      {bars ? (
        pts.map((v, i) => {
          if (v == null) return null;
          const yv = y(v);
          const y0 = zeroY ?? height;
          return (
            <rect
              key={i}
              x={i * stepX}
              y={Math.min(yv, y0)}
              width={Math.max(1, stepX - 1)}
              height={Math.max(1, Math.abs(yv - y0))}
              fill={v >= 0 ? "var(--profit,#16a34a)" : "var(--loss,#dc2626)"}
              opacity={0.7}
            />
          );
        })
      ) : (
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          points={pts
            .map((v, i) => (v == null ? null : `${i * stepX},${y(v)}`))
            .filter(Boolean)
            .join(" ")}
        />
      )}
    </svg>
  );
}

function MiniCharts({ snap }: { snap: Snap }) {
  const hist = snap.history ?? snap.charts ?? {};
  const price: any[] = hist.price ?? snap.price_history ?? [];
  const vwap: any[] = hist.vwap ?? snap.vwap_history ?? [];
  const cvd: any[] = hist.cvd_slope ?? hist.cvd ?? snap.cvd_history ?? [];
  const delta: any[] = hist.delta ?? snap.delta_history ?? [];

  const poc = Number(snap.poc);
  const vah = Number(snap.vah);
  const val = Number(snap.val);
  const valid = [poc, vah, val].filter((n) => Number.isFinite(n));
  const vaMin = valid.length ? Math.min(...valid) : null;
  const vaMax = valid.length ? Math.max(...valid) : null;
  const vaRange = vaMin != null && vaMax != null ? vaMax - vaMin || 1 : 1;
  const W = 160, H = 28;
  const yVA = (v: number) => H - ((v - (vaMin ?? 0)) / vaRange) * H;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="border border-black/30 p-1.5">
        <div className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5">Price vs VWAP</div>
        <div className="relative" style={{ height: H }}>
          <div className="absolute inset-0 opacity-70"><Spark data={price} label="price" /></div>
          <div className="absolute inset-0 text-blue-700 opacity-80"><Spark data={vwap} label="vwap" /></div>
        </div>
      </div>
      <div className="border border-black/30 p-1.5">
        <div className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5">CVD Slope</div>
        <Spark data={cvd} zeroLine label="cvd" />
      </div>
      <div className="border border-black/30 p-1.5">
        <div className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5">Delta Proxy</div>
        <Spark data={delta} zeroLine bars label="delta" />
      </div>
      <div className="border border-black/30 p-1.5">
        <div className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5">Value Area · POC / VAH / VAL</div>
        {vaMin == null ? (
          <div className="text-[9px] opacity-60 uppercase tracking-wider">no value area</div>
        ) : (
          <svg width={W} height={H} className="block">
            {Number.isFinite(vah) && Number.isFinite(val) && (
              <rect x={0} y={Math.min(yVA(vah), yVA(val))} width={W} height={Math.max(1, Math.abs(yVA(vah) - yVA(val)))} fill="currentColor" opacity={0.1} />
            )}
            {Number.isFinite(vah) && (
              <line x1={0} x2={W} y1={yVA(vah)} y2={yVA(vah)} stroke="currentColor" strokeOpacity={0.6} strokeDasharray="2 2" />
            )}
            {Number.isFinite(val) && (
              <line x1={0} x2={W} y1={yVA(val)} y2={yVA(val)} stroke="currentColor" strokeOpacity={0.6} strokeDasharray="2 2" />
            )}
            {Number.isFinite(poc) && (
              <line x1={0} x2={W} y1={yVA(poc)} y2={yVA(poc)} stroke="var(--profit,#16a34a)" strokeWidth={1.5} />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

function SymbolTab({ snap }: { snap: Snap | null }) {
  if (!snap) {
    return (
      <div className="p-3 text-[11px] opacity-70 uppercase tracking-wider">
        Waiting for ORDER_FLOW_READER backend payload for this symbol.
      </div>
    );
  }
  const status = String(snap.status ?? "WAIT").toUpperCase();
  const age = ageSecFrom(snap.last_update ?? snap.updated_at);
  const staleThreshold = Number(snap.stale_after_sec ?? 60);
  const stale = snap.stale === true || (age != null && age > staleThreshold) || status === "STALE";
  const statusTone: "green" | "yellow" | "red" | "gray" =
    status === "OBSERVE_ONLY" || status === "OBSERVE" ? "green" :
    status === "STALE" ? "red" :
    status === "WAIT" ? "yellow" : "gray";
  const missing = missingFieldsOf(snap);
  const divergence = String(snap.divergence ?? "none").toLowerCase();
  const divTone: "green" | "red" | "gray" =
    divergence === "bullish" ? "green" : divergence === "bearish" ? "red" : "gray";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 border border-black/40 p-2">
        <Badge value={status} tone={statusTone} />
        <Badge value="OBSERVE-ONLY" tone="gray" />
        {stale && <Badge value="STALE" tone="red" />}
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          Symbol: <b>{snap.symbol ?? "—"}</b>
        </span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          Last Update: <b>{snap.last_update ? String(snap.last_update).replace("T", " ").slice(0, 19) : "—"}</b>
        </span>
        {age != null && (
          <span className={`text-[10px] uppercase tracking-wider ${stale ? "text-loss" : "opacity-70"}`}>
            Age: <b>{age}s</b>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <KV k="POC" v={fmt(snap.poc, 5)} />
          <KV k="VAH" v={fmt(snap.vah, 5)} />
          <KV k="VAL" v={fmt(snap.val, 5)} />
          <KV k="VWAP" v={fmt(snap.vwap, 5)} />
        </div>
        <div>
          <KV k="CVD Proxy" v={fmt(snap.cvd_proxy ?? snap.cvd, 4)} />
          <KV k="CVD Slope" v={fmt(snap.cvd_slope, 4)} />
          <KV k="Delta Proxy" v={fmt(snap.delta_proxy ?? snap.latest_delta ?? snap.delta, 4)} />
          <KV
            k="Divergence"
            v={<Badge value={divergence.toUpperCase()} tone={divTone} />}
          />
        </div>
      </div>

      <MiniCharts snap={snap} />

      <div className="border border-black/40 p-2">
        <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Missing Fields</div>
        {missing.length === 0 ? (
          <div className="text-[10px] opacity-60">All core fields present</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {missing.map((m) => (
              <Badge key={m} value={m} tone="orange" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderFlowReaderPanel() {
  const ds = useDashboardStatusPayload();
  const { rows: decisions } = useLiveTable<any>("ai_decisions", { limit: 50 });

  const snaps = React.useMemo(() => collectSnapshots(ds as Snap, decisions ?? []), [ds, decisions]);

  // Tabs: defaults first (in fixed order), then any extra detected symbols.
  const tabs = React.useMemo(() => {
    const defaults = DEFAULT_SYMBOLS.map(normalizeSymbol);
    const extras = Object.keys(snaps).filter(
      (s) => !defaults.some((d) => isSameSymbol(d, s)),
    );
    return [...defaults, ...extras];
  }, [snaps]);

  const [active, setActive] = React.useState<string>(tabs[0] ?? "BTCUSD");
  React.useEffect(() => {
    if (!tabs.includes(active)) setActive(tabs[0] ?? "BTCUSD");
  }, [tabs, active]);

  const activeSnap =
    snaps[active] ??
    Object.entries(snaps).find(([k]) => isSameSymbol(k, active))?.[1] ??
    null;

  const labelFor = (s: string) =>
    isSameSymbol(s, "XAUUSD") ? "GOLD" : isSameSymbol(s, "BTCUSD") ? "BTCUSD" : isSameSymbol(s, "EURUSD") ? "EURUSD" : s;

  return (
    <Panel
      title="ORDER_FLOW_READER — Per-Symbol Snapshots"
      right={<Badge value="OBSERVE-ONLY · NO EXECUTION" tone="gray" />}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((s) => {
            const snap = snaps[s] ?? Object.entries(snaps).find(([k]) => isSameSymbol(k, s))?.[1];
            const has = !!snap;
            const status = String(snap?.status ?? "").toUpperCase();
            const age = ageSecFrom(snap?.last_update ?? snap?.updated_at);
            const stale = snap?.stale === true || status === "STALE" || (age != null && age > Number(snap?.stale_after_sec ?? 60));
            return (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 border border-black flex items-center gap-1.5 ${active === s ? "bg-foreground text-background" : ""}`}
              >
                <span>{labelFor(s)}</span>
                {!has && <span className="opacity-60">·</span>}
                {!has && <span className="opacity-60">no data</span>}
                {has && stale && <span className="text-loss">●</span>}
                {has && !stale && <span className="text-profit">●</span>}
              </button>
            );
          })}
        </div>

        <SymbolTab snap={activeSnap} />

        <div className="border border-black/40 p-2 text-[10px] uppercase tracking-wider">
          Order Flow Reader is observe-only. It does not execute trades and does not block other strategies.
        </div>
      </div>
    </Panel>
  );
}
