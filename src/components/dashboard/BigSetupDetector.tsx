import { Panel, KV } from "./Panel";
import { Waiting } from "./Waiting";
import { Badge, gradeTone, statusTone } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";

function unknownIf(v: any) {
  if (v == null || v === "") return "UNKNOWN";
  return v;
}

export function BigSetupDetector() {
  const { rows, empty } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const d = rows[0];
  if (empty || !d) {
    return (
      <Panel title="BIG SETUP DETECTOR" right="TAG-ONLY">
        <Waiting label="WAITING FOR BIG SETUP DATA" />
      </Panel>
    );
  }
  const rp = d.raw_payload ?? {};
  const grade = unknownIf(rp.big_setup_grade);
  const score = unknownIf(rp.big_setup_score);
  const status = unknownIf(rp.big_setup_status);
  const reason = unknownIf(rp.big_setup_reason);
  const bias = unknownIf(rp.big_setup_direction_bias);
  const tags = rp.big_setup_tags;
  const missing = rp.big_setup_missing_data;
  const riskOk = rp.big_setup_risk_ok;
  const timeOk = rp.big_setup_time_ok;
  const safetyOk = rp.big_setup_safety_ok;
  const premium = rp.big_setup_is_premium;
  const discount = rp.big_setup_is_discount;

  const okBadge = (label: string, v: any) => {
    const tone = v == null ? "gray" : v ? "green" : "red";
    const text = v == null ? "UNKNOWN" : v ? "OK" : "NO";
    return <Badge value={`${label}: ${text}`} tone={tone as any} />;
  };

  return (
    <Panel title="BIG SETUP DETECTOR" right={`${d.symbol ?? ""} ${d.timeframe ?? ""}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge value={`GRADE: ${grade}`} tone={gradeTone(grade)} />
        <Badge value={`STATUS: ${status}`} tone={statusTone(status)} />
        <Badge value={`SCORE: ${score}`} tone="gray" />
        <Badge value={`BIAS: ${bias}`} tone="gray" />
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {okBadge("RISK", riskOk)}
        {okBadge("TIME", timeOk)}
        {okBadge("SAFETY", safetyOk)}
        <Badge value={`PREMIUM: ${premium == null ? "UNKNOWN" : premium ? "YES" : "NO"}`} tone={premium ? "green" : "gray"} />
        <Badge value={`DISCOUNT: ${discount == null ? "UNKNOWN" : discount ? "YES" : "NO"}`} tone={discount ? "green" : "gray"} />
      </div>
      <KV k="Tags" v={Array.isArray(tags) && tags.length ? tags.join(", ") : "—"} />
      <KV k="Missing Data" v={Array.isArray(missing) && missing.length ? missing.join(", ") : "—"} />
      <div className="text-[10px] mt-1 opacity-80"><b>REASON:</b> {String(reason)}</div>
      <div className="mt-2 border border-dashed border-black/60 p-1 text-[10px] uppercase tracking-widest text-center">
        ⚠ BIG_SETUP_DETECTOR IS TAG_ONLY. IT DOES NOT APPROVE, BLOCK, OR EXECUTE TRADES.
      </div>
    </Panel>
  );
}
