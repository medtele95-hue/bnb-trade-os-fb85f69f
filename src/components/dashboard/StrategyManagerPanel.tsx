import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

type Strat = {
  name: string;
  mode?: string;
  route_allowed?: boolean;
  enabled?: boolean;
  role?: string;
  allowed_symbols?: string[] | string;
  last_status?: string;
  last_reason?: string;
  stale?: boolean;
  last_update?: string;
};

const ACTIVE_DEFAULT = [
  "SIMO_ATM_BREAKOUT",
  "BTC_SCALPING_AGENT",
  "EUR_EMA_RSI_ATR_CROSSOVER",
  "GOLD_LIQUIDITY_HUNTER_PRO",
  "GOLD_M1_M5_EMA_SWEEP_SCALPER",
];

const OBSERVE_DEFAULT = [
  "ORDER_FLOW_READER",
  "TOP_DOWN_MARKET_READER",
  "SMC_TAGGER",
  "MTFA",
  "MTF_STRUCTURE",
  "BIG_SETUP_DETECTOR",
  "SECOND_ENTRY",
  "SCALPING_AGENT",
];

function pickList(sm: any, key: string): Strat[] {
  const raw = sm?.[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s: any) => (typeof s === "string" ? { name: s } : s));
  if (typeof raw === "object") return Object.entries(raw).map(([name, v]: [string, any]) => ({ name, ...(v ?? {}) }));
  return [];
}

function asList(v: any): string {
  if (!v) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function StratRow({ s, observeOnly }: { s: Strat; observeOnly: boolean }) {
  const mode = (s.mode ?? (observeOnly ? "OBSERVATION_ONLY" : "ACTIVE_EXECUTION")).toString().toUpperCase();
  const routeAllowed = observeOnly ? false : (s.route_allowed ?? true);
  const enabled = s.enabled !== false;
  const role = s.role ?? (observeOnly ? "OBSERVER" : "EXECUTOR");
  const last = s.last_status ?? "—";
  const stale = s.stale === true;
  return (
    <div className="border border-black p-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-[11px] truncate" title={s.name}>{s.name}</div>
        <div className="flex gap-1 flex-wrap">
          <Badge value={mode} tone={observeOnly ? "gray" : "green"} />
          <Badge value={routeAllowed ? "ROUTE: YES" : "ROUTE: NO"} tone={routeAllowed ? "green" : "red"} />
          <Badge value={enabled ? "ON" : "OFF"} tone={enabled ? "green" : "gray"} />
          {stale && <Badge value="STALE" tone="orange" />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 mt-1">
        <KV k="Role" v={role} />
        <KV k="Last Status" v={String(last).toUpperCase()} />
        <KV k="Symbols" v={asList(s.allowed_symbols)} />
        <KV k="Update" v={s.last_update ? String(s.last_update).slice(11, 19) : "—"} />
      </div>
      {s.last_reason && (
        <div className="mt-1 text-[10px] opacity-80 italic line-clamp-2">"{s.last_reason}"</div>
      )}
    </div>
  );
}

export function StrategyManagerPanel() {
  const ds = useDashboardStatusPayload();
  const sm =
    (ds as any).strategy_manager ??
    (ds as any).STRATEGY_MANAGER ??
    (ds as any).raw_payload?.strategy_manager ??
    {};

  const activeRaw = [
    ...pickList(sm, "active_execution"),
    ...pickList(sm, "ACTIVE_EXECUTION"),
    ...pickList(sm, "active"),
  ];
  const observeRaw = [
    ...pickList(sm, "observation_only"),
    ...pickList(sm, "OBSERVATION_ONLY"),
    ...pickList(sm, "observe"),
    ...pickList(sm, "observers"),
  ];

  const byName = (list: Strat[]) => {
    const map = new Map<string, Strat>();
    list.forEach((s) => map.set(s.name, s));
    return map;
  };
  const activeMap = byName(activeRaw);
  const observeMap = byName(observeRaw);

  const active = ACTIVE_DEFAULT.map((n) => activeMap.get(n) ?? { name: n });
  // append any additional active strategies the backend reports
  activeRaw.forEach((s) => { if (!ACTIVE_DEFAULT.includes(s.name)) active.push(s); });

  const observe = OBSERVE_DEFAULT.map((n) => observeMap.get(n) ?? { name: n });
  observeRaw.forEach((s) => { if (!OBSERVE_DEFAULT.includes(s.name)) observe.push(s); });

  return (
    <Panel
      title="STRATEGY MANAGER"
      right={<Badge value="OBSERVATION STRATEGIES NEVER ROUTE TO EXECUTION" tone="orange" />}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
            <Badge value="ACTIVE EXECUTION" tone="green" />
            <span className="opacity-60">{active.length}</span>
          </div>
          <div className="space-y-1.5">
            {active.map((s) => <StratRow key={s.name} s={s} observeOnly={false} />)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
            <Badge value="OBSERVATION ONLY" tone="gray" />
            <span className="opacity-60">{observe.length}</span>
          </div>
          <div className="space-y-1.5">
            {observe.map((s) => <StratRow key={s.name} s={s} observeOnly={true} />)}
          </div>
        </div>
      </div>
    </Panel>
  );
}
