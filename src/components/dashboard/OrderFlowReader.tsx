import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useDashboardStatusPayload } from "./DemoCenter";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useBackendHealth } from "@/hooks/useBackendHealth";
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

/** Normalize a raw snapshot blob into the field names the UI expects. */
function normalizeSnap(raw: any, fallbackSym?: string): Snap | null {
  if (!raw || typeof raw !== "object") return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") return raw[k];
    }
    return undefined;
  };
  const symbol = pick("symbol", "broker_symbol", "brokerSymbol") ?? fallbackSym;
  const out: Snap = {
    ...raw,
    symbol,
    broker_symbol: pick("broker_symbol", "brokerSymbol"),
    status: pick("status", "mode"),
    poc: pick("poc", "POC", "point_of_control"),
    vah: pick("vah", "VAH", "value_area_high"),
    val: pick("val", "VAL", "value_area_low"),
    vwap: pick("vwap", "VWAP"),
    cvd_slope: pick("cvd_slope", "CVD_SLOPE", "cvdSlope"),
    cvd_proxy: pick("cvd_proxy", "CVD_PROXY", "cvd"),
    delta_proxy: pick("delta_proxy", "DELTA", "delta", "latest_delta"),
    divergence: pick("divergence", "DIVERGENCE"),
    last_update: pick("last_update", "updated_at", "created_at"),
  };
  return out;
}

/** Find an order-flow snapshot for a given symbol from various possible locations. */
function collectSnapshots(
  ds: Snap,
  decisions: any[],
): { snaps: Record<string, Snap>; sources: Record<string, string> } {
  const out: Record<string, Snap> = {};
  const sources: Record<string, string> = {};

  const tryMerge = (sym: string | undefined | null, raw: any, srcLabel: string) => {
    const snap = normalizeSnap(raw, sym ?? undefined);
    if (!snap) return;
    const s = normalizeSymbol(sym ?? snap.symbol ?? "");
    if (!s || s === "—") return;
    if (!out[s]) {
      out[s] = snap;
      sources[s] = srcLabel;
    }
  };

  // dashboard_status containers — including the `.tabs` object shape used by HERMES.
  type Container = { value: any; label: string };
  const rp = (ds as any).raw_payload ?? {};
  const containers: Container[] = [
    { value: ds.order_flow_snapshot, label: "dashboard_status.order_flow_snapshot" },
    { value: ds.latest_order_flow, label: "dashboard_status.latest_order_flow" },
    { value: ds.order_flow_snapshots, label: "dashboard_status.order_flow_snapshots" },
    { value: ds.order_flow_reader, label: "dashboard_status.order_flow_reader" },
    { value: ds.ORDER_FLOW_READER, label: "dashboard_status.ORDER_FLOW_READER" },
    { value: ds.order_flow, label: "dashboard_status.order_flow" },
    { value: (ds.order_flow as any)?.tabs, label: "dashboard_status.order_flow.tabs" },
    { value: (ds.order_flow_reader as any)?.tabs, label: "dashboard_status.order_flow_reader.tabs" },
    { value: rp.order_flow_reader, label: "raw_payload.order_flow_reader" },
    { value: rp.order_flow, label: "raw_payload.order_flow" },
    { value: rp.order_flow?.tabs, label: "raw_payload.order_flow.tabs" },
  ].filter((c) => c.value);

  for (const { value: c, label } of containers) {
    if (Array.isArray(c)) {
      c.forEach((snap) => tryMerge(snap?.symbol, snap, label));
    } else if (typeof c === "object") {
      if (c.symbol) tryMerge(c.symbol, c, label);
      for (const [k, v] of Object.entries(c)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const vo = v as any;
          if ("poc" in vo || "vwap" in vo || "VWAP" in vo || "symbol" in vo || "status" in vo || "mode" in vo) {
            tryMerge(k, vo, `${label}.${k}`);
          }
        }
      }
    }
  }

  // ai_decisions fallbacks: nested ORDER_FLOW keys, OR flat raw_payload from GOLD_ORDER_FLOW strategy.
  for (const d of decisions) {
    const drp = d?.raw_payload ?? {};
    const inner = drp.raw_payload ?? {};
    const candidates: Array<[any, string]> = [
      [drp.order_flow_reader, "ai_decisions.raw_payload.order_flow_reader"],
      [drp.ORDER_FLOW_READER, "ai_decisions.raw_payload.ORDER_FLOW_READER"],
      [drp.order_flow, "ai_decisions.raw_payload.order_flow"],
      [drp.order_flow_snapshot, "ai_decisions.raw_payload.order_flow_snapshot"],
      [inner.order_flow, "ai_decisions.raw_payload.raw_payload.order_flow"],
    ];
    for (const [c, label] of candidates) {
      if (!c) continue;
      if (Array.isArray(c)) c.forEach((s) => tryMerge(s?.symbol, s, label));
      else if (typeof c === "object") {
        if (c.symbol) tryMerge(c.symbol, c, label);
        if (c.tabs && typeof c.tabs === "object") {
          for (const [k, v] of Object.entries(c.tabs)) tryMerge(k, v, `${label}.tabs.${k}`);
        }
        for (const [k, v] of Object.entries(c)) {
          if (v && typeof v === "object" && !Array.isArray(v) && ("poc" in (v as any) || "vwap" in (v as any))) {
            tryMerge(k, v, `${label}.${k}`);
          }
        }
      }
    }
    // Flat shape: ai_decision row itself has poc/vwap/etc (e.g. GOLD_ORDER_FLOW_CVD_VWAP).
    const flat = inner.poc != null || inner.vwap != null ? inner : (drp.poc != null || drp.vwap != null ? drp : null);
    if (flat) {
      const sym = flat.symbol ?? flat.broker_symbol ?? d?.symbol;
      tryMerge(sym, flat, `ai_decisions[${d?.strategy ?? "?"}].raw_payload`);
    }
  }

  return { snaps: out, sources };
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
  const { verdict } = useBackendHealth();
  const [debugOpen, setDebugOpen] = React.useState(false);

  const { snaps, sources } = React.useMemo(
    () => collectSnapshots(ds as Snap, decisions ?? []),
    [ds, decisions],
  );

  // Tabs: defaults first (in fixed order), then any extra detected symbols.
  const tabs = React.useMemo(() => {
    const defaults = DEFAULT_SYMBOLS.map((s) => normalizeSymbol(s));
    const extras = Object.keys(snaps).filter(
      (s) => !defaults.some((d) => isSameSymbol(d, s)),
    );
    return [...defaults, ...extras];
  }, [snaps]);

  const [active, setActive] = React.useState<string>(tabs[0] ?? "BTCUSD");
  React.useEffect(() => {
    if (!tabs.includes(active)) setActive(tabs[0] ?? "BTCUSD");
  }, [tabs, active]);

  const lookupSnap = (s: string): Snap | null =>
    snaps[s] ?? Object.entries(snaps).find(([k]) => isSameSymbol(k, s))?.[1] ?? null;

  const activeSnap = lookupSnap(active);
  const activeSource =
    sources[active] ??
    Object.entries(sources).find(([k]) => isSameSymbol(k, active))?.[1] ??
    null;

  const labelFor = (s: string) =>
    isSameSymbol(s, "XAUUSD") ? "GOLD" : isSameSymbol(s, "BTCUSD") ? "BTCUSD" : isSameSymbol(s, "EURUSD") ? "EURUSD" : s;

  const showDegradedNotice = !activeSnap && verdict !== "ONLINE";

  return (
    <Panel
      title="ORDER_FLOW_READER — Per-Symbol Snapshots"
      right={<Badge value="OBSERVE-ONLY · NO EXECUTION" tone="gray" />}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((s) => {
            const snap = lookupSnap(s);
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

        {showDegradedNotice && (
          <div className="border border-loss p-2 text-[10px] uppercase tracking-wider text-loss">
            ORDER FLOW COMPUTED BY BACKEND BUT REMOTE SNAPSHOT NOT AVAILABLE — INGEST {verdict}
          </div>
        )}

        <SymbolTab snap={activeSnap} />

        <div className="border border-black/40 p-2">
          <button
            onClick={() => setDebugOpen((v) => !v)}
            className="text-[10px] uppercase tracking-wider opacity-80 hover:opacity-100"
          >
            {debugOpen ? "▾" : "▸"} DEBUG ORDER FLOW PAYLOAD
            {activeSource && <span className="opacity-60 ml-2">· source: {activeSource}</span>}
          </button>
          {debugOpen && (
            <pre className="mt-2 text-[10px] leading-tight max-h-64 overflow-auto whitespace-pre-wrap break-all opacity-80">
{JSON.stringify(
  {
    active_symbol: active,
    source: activeSource,
    health_verdict: verdict,
    normalized_payload: activeSnap,
    available_symbols: Object.keys(snaps),
  },
  null,
  2,
)}
            </pre>
          )}
        </div>

        <div className="border border-black/40 p-2 text-[10px] uppercase tracking-wider">
          Order Flow Reader is observe-only. It does not execute trades and does not block other strategies.
        </div>
      </div>
    </Panel>
  );
}

