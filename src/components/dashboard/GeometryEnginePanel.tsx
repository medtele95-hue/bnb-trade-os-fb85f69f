import { Panel, KV } from "@/components/dashboard/Panel";
import { Badge } from "@/components/dashboard/Badges";
import { useDashboardStatusPayload } from "@/components/dashboard/DemoCenter";

export function GeometryEnginePanel() {
  const ds = useDashboardStatusPayload() as any;
  const raw =
    ds?.geometry_engine ??
    ds?.GEOMETRY_ENGINE ??
    ds?.raw_payload?.geometry_engine ??
    null;

  if (!raw) {
    return (
      <Panel title="GEOMETRY ENGINE" right="LATEST">
        <div className="border border-dashed border-black/40 p-3 text-[11px] italic opacity-80">
          Waiting for Geometry Engine backend payload
        </div>
      </Panel>
    );
  }

  const asList = (v: any) =>
    !v ? "—" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);

  return (
    <Panel
      title="GEOMETRY ENGINE"
      right={raw.stale ? <Badge value="STALE" tone="orange" /> : <Badge value="FRESH" tone="green" />}
    >
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="border border-black p-1.5">
          <div className="text-[10px] uppercase opacity-70">Range Compression</div>
          <div className="pixel text-[18px]">{raw.range_compression_score ?? raw.compression ?? "—"}</div>
        </div>
        <div className="border border-black p-1.5">
          <div className="text-[10px] uppercase opacity-70">Impulse</div>
          <div className="pixel text-[18px]">{raw.impulse_score ?? raw.impulse ?? "—"}</div>
        </div>
        <div className="border border-black p-1.5">
          <div className="text-[10px] uppercase opacity-70">Volatility Expansion</div>
          <div className="pixel text-[18px]">{raw.volatility_expansion_score ?? raw.volatility_expansion ?? "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <KV k="Regression Channel" v={String(raw.regression_channel_direction ?? raw.channel_direction ?? "—").toUpperCase()} />
        <KV k="Trendline Slope" v={raw.trendline_slope ?? "—"} />
        <KV k="Breakout Box High" v={raw.breakout_box_high ?? raw.box_high ?? "—"} accent="profit" />
        <KV k="Breakout Box Low" v={raw.breakout_box_low ?? raw.box_low ?? "—"} accent="loss" />
        <KV k="Support Zones" v={asList(raw.support_zones ?? raw.support)} />
        <KV k="Resistance Zones" v={asList(raw.resistance_zones ?? raw.resistance)} />
        <KV k="Zone" v={String(raw.premium_discount ?? raw.zone ?? "—").toUpperCase()} />
        <KV k="Fib OTE" v={raw.fib_ote ?? raw.fibonacci_ote_zone ?? "—"} />
        <KV k="Triangle/Wedge" v={raw.triangle ?? raw.wedge ?? raw.pattern ?? "—"} />
      </div>
    </Panel>
  );
}
