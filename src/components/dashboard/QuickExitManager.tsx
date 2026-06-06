import * as React from "react";
import { Panel, KV } from "./Panel";
import { Badge } from "./Badges";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useDashboardStatusPayload } from "./DemoCenter";

const DEMO_MAGIC = 909002;

function getRP(row: any): Record<string, any> {
  if (!row) return {};
  const rp = (row as any).raw_payload;
  if (rp && typeof rp === "object") return rp as Record<string, any>;
  return {};
}

function pick(srcs: Array<Record<string, any> | undefined | null>, keys: string[]): any {
  for (const s of srcs) {
    if (!s) continue;
    for (const k of keys) {
      if (s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
    }
  }
  return undefined;
}

function fmtUsd(v: any): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}$${n.toFixed(2)}`;
}

function actionTone(action: string): "green" | "yellow" | "orange" | "red" | "gray" {
  const a = action.toUpperCase();
  if (a === "CLOSE_TP") return "green";
  if (a === "MOVE_BREAKEVEN" || a === "BREAKEVEN") return "yellow";
  if (a === "TRAIL_SL" || a === "TRAIL") return "orange";
  if (a === "SKIP" || a === "SKIPPED") return "gray";
  if (a === "HOLD") return "gray";
  return "gray";
}

export function QuickExitManager() {
  const ds = useDashboardStatusPayload();
  const { rows: decRows } = useLiveTable<any>("ai_decisions", { limit: 1 });
  const { rows: bsRows } = useLiveTable<any>("bot_status", { orderBy: "updated_at", ascending: false, limit: 10 });
  const { rows: trades } = useLiveTable<any>("trades", { limit: 200 });

  const dec = decRows[0];
  const decRP = getRP(dec);
  const qx =
    (ds as any).quick_exit ??
    (ds as any).quick_exit_manager ??
    decRP?.quick_exit ??
    decRP?.quick_exit_manager ??
    null;

  // Quick exit may also be reported as its own bot_status component
  const qxStatusRow = bsRows.find(
    (r: any) =>
      String(r.component ?? "").toUpperCase().includes("QUICK_EXIT") ||
      String(r.component ?? "").toUpperCase().includes("QUICKEXIT"),
  );
  const qxStatusRP = getRP(qxStatusRow);

  const srcs = [qx ?? {}, qxStatusRP, qxStatusRow ?? {}, ds, decRP];

  const enabledRaw = pick(srcs, ["enabled", "quick_exit_enabled"]);
  const enabled = enabledRaw === undefined ? true : enabledRaw === true || String(enabledRaw).toUpperCase() === "TRUE";

  const tpClose = pick(srcs, ["tp_quick_close", "quick_close_tp", "tp_close_usd"]) ?? 1.5;
  const beTrigger = pick(srcs, ["breakeven_trigger", "be_trigger", "be_trigger_usd"]) ?? 0.8;
  const beBuffer = pick(srcs, ["be_buffer", "breakeven_buffer", "be_buffer_usd"]) ?? 0.1;
  const trailStart = pick(srcs, ["trailing_start", "trail_start", "trail_start_usd"]) ?? 1.0;
  const trailGap = pick(srcs, ["trailing_gap", "trail_gap", "trail_gap_usd"]) ?? 0.6;

  const openDemo = trades.filter(
    (t: any) =>
      Number(t.magic_number ?? t.magic ?? getRP(t).magic_number) === DEMO_MAGIC &&
      String(t.result ?? "").toUpperCase() === "OPEN" && t.closed_at == null,
  );
  const managedCount =
    Number(pick(srcs, ["managed_count", "open_count", "managed_open_positions"])) ||
    openDemo.length;

  const lastAction = String(pick(srcs, ["last_action", "action"]) ?? "—").toUpperCase();
  const lastTicket = pick(srcs, ["last_ticket", "ticket"]);
  const lastSymbol = pick(srcs, ["last_symbol", "symbol"]);
  const lastProfit = pick(srcs, ["last_profit", "last_profit_usd", "profit_usd", "profit"]);
  const lastPeak = pick(srcs, ["last_peak", "last_peak_usd", "peak_usd", "peak"]);
  const lastReason = pick(srcs, ["last_reason", "reason", "last_error", "error"]);

  const hasPayload =
    !!qx ||
    !!qxStatusRow ||
    pick(srcs, ["last_action", "managed_count", "tp_quick_close"]) !== undefined;

  return (
    <Panel
      title="QUICK EXIT MANAGER"
      right={<Badge value="READ-ONLY · DEMO ONLY · MAGIC 909002" tone="gray" />}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge value={`ENABLED: ${enabled ? "TRUE" : "FALSE"}`} tone={enabled ? "green" : "red"} />
          <Badge value="DEMO ONLY: TRUE" tone="green" />
          <Badge value="MAGIC: 909002" tone="gray" />
          <Badge value="DOES NOT OPEN NEW TRADES" tone="gray" />
          <Badge value="LIVE TRADING BLOCKED" tone="red" />
        </div>

        <div className="border border-dashed border-black/50 p-2 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
          <KV k="TP Quick Close" v={fmtUsd(tpClose)} />
          <KV k="Breakeven Trigger" v={fmtUsd(beTrigger)} />
          <KV k="BE Buffer" v={fmtUsd(beBuffer)} />
          <KV k="Trailing Start" v={fmtUsd(trailStart)} />
          <KV k="Trailing Gap" v={`$${Number(trailGap).toFixed(2)}`} />
          <KV k="Managed Open Positions" v={String(managedCount)} />
        </div>

        <div className="border border-black p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest opacity-70">Last Action</span>
            <Badge value={lastAction} tone={actionTone(lastAction)} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px]">
            <KV k="Last Ticket" v={lastTicket != null ? String(lastTicket) : "—"} />
            <KV k="Last Symbol" v={lastSymbol != null ? String(lastSymbol) : "—"} />
            <KV
              k="Last Profit USD"
              v={fmtUsd(lastProfit)}
              accent={lastProfit != null && Number(lastProfit) < 0 ? "loss" : lastProfit != null ? "profit" : undefined}
            />
            <KV k="Last Peak USD" v={fmtUsd(lastPeak)} />
          </div>
          {lastReason && (
            <div className="mt-1 text-[10px] italic opacity-80">"{String(lastReason)}"</div>
          )}
          {!hasPayload && (
            <div className="mt-1 text-[10px] italic opacity-70">
              Waiting for QUICK_EXIT backend payload — defaults shown above
            </div>
          )}
        </div>

        <div className="text-[9px] opacity-60 uppercase tracking-wider">
          Quick Exit is integrated inside HERMES normal cycle. It manages exits only for
          magic 909002. It never opens new trades and never targets non-HERMES magics.
        </div>
      </div>
    </Panel>
  );
}
