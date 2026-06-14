import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type TradeRow = Database["public"]["Tables"]["trades"]["Row"];
type ExecutionEventRow = Database["public"]["Tables"]["execution_events"]["Row"];
type AiDecisionRow = Database["public"]["Tables"]["ai_decisions"]["Row"];
type KellyRiskRow = Database["public"]["Tables"]["kelly_risk"]["Row"];
type StrategySignalRow = Database["public"]["Tables"]["strategy_signals"]["Row"];
type BotLogRow = Database["public"]["Tables"]["bot_logs"]["Row"];

type RawPayloadObj = Record<string, unknown>;

const QuerySchema = z.object({
  hours: z.coerce
    .number()
    .positive()
    .max(24 * 30)
    .default(1),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function asRawPayload(v: unknown): RawPayloadObj {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as RawPayloadObj;
}

function getTradeMode(t: TradeRow): string {
  const rp = asRawPayload(t.raw_payload);
  const inner = asRawPayload(rp.raw_payload);
  return String(rp.mode ?? inner.mode ?? "").toUpperCase();
}

function getTradeStatus(t: TradeRow): string {
  const rp = asRawPayload(t.raw_payload);
  const inner = asRawPayload(rp.raw_payload);
  return String(rp.status ?? inner.status ?? "").toUpperCase();
}

export const Route = createFileRoute("/api/public/hermes-paper-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = request.headers.get("x-hermes-secret");
        const expected = process.env.HERMES_INGEST_SECRET;
        if (!expected || !secret || secret !== expected) {
          return jsonResponse({ ok: false, error: "unauthorized" }, 401);
        }

        const url = new URL(request.url);
        const qParsed = QuerySchema.safeParse({ hours: url.searchParams.get("hours") ?? "1" });
        const hours = qParsed.success ? qParsed.data.hours : 1;
        const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

        // Fetch in parallel
        const [
          paperEventsRes,
          allEventsRes,
          tradesRes,
          aiDecisionsRes,
          kellyRiskRes,
          strategySignalsRes,
          logsRes,
        ] = await Promise.all([
          supabaseAdmin
            .from("execution_events")
            .select("*")
            .gte("created_at", sinceIso)
            .or("mode.eq.PAPER,event_type.ilike.PAPER%")
            .order("created_at", { ascending: false })
            .limit(500),
          supabaseAdmin
            .from("execution_events")
            .select("mode,event_type,created_at")
            .gte("created_at", sinceIso)
            .limit(1000),
          supabaseAdmin
            .from("trades")
            .select("*")
            .or(`created_at.gte.${sinceIso},opened_at.gte.${sinceIso}`)
            .order("created_at", { ascending: false })
            .limit(1000),
          supabaseAdmin
            .from("ai_decisions")
            .select("*")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("kelly_risk")
            .select("*")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("strategy_signals")
            .select("*")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("bot_logs")
            .select("*")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        const paperEvents: ExecutionEventRow[] = paperEventsRes.data ?? [];
        const allEvents: Pick<ExecutionEventRow, "mode" | "event_type" | "created_at">[] =
          allEventsRes.data ?? [];
        const trades: TradeRow[] = tradesRes.data ?? [];
        const aiDecisions: AiDecisionRow[] = aiDecisionsRes.data ?? [];
        const kellyRisk: KellyRiskRow[] = kellyRiskRes.data ?? [];
        const strategySignals: StrategySignalRow[] = strategySignalsRes.data ?? [];
        const logs: BotLogRow[] = logsRes.data ?? [];

        // Detect demo/live orders
        const demoOrLiveDetected = allEvents.some((e) => {
          const m = String(e.mode ?? "").toUpperCase();
          const et = String(e.event_type ?? "").toUpperCase();
          return (
            (m && m !== "PAPER" && m !== "READ_ONLY" && (m === "DEMO" || m === "LIVE")) ||
            et.startsWith("DEMO") ||
            et.startsWith("LIVE")
          );
        });

        // Filter PAPER trades from trades table
        const sinceMs = new Date(sinceIso).getTime();
        const paperTrades = trades.filter((t) => {
          if (!t.dir || !t.symbol || t.entry == null) return false;
          const lot = toNum(t.lot_size ?? t.lot);
          if (!(lot > 0)) return false;
          const mode = getTradeMode(t);
          const isPaper = mode === "PAPER" || Number(t.magic_number) === 909001;
          if (!isPaper) return false;
          const openedAt = t.opened_at ? new Date(t.opened_at).getTime() : 0;
          const createdAt = t.created_at ? new Date(t.created_at).getTime() : 0;
          return Math.max(openedAt, createdAt) >= sinceMs;
        });

        const isClosed = (t: TradeRow) => t.closed_at != null || getTradeStatus(t) === "CLOSED";
        const openTrades = paperTrades.filter((t) => !isClosed(t));
        const closedTrades = paperTrades.filter(isClosed);

        const opened = paperTrades.length;
        const closed = closedTrades.length;

        let wins = 0;
        let losses = 0;
        let pnlSum = 0;
        let biggestWin = 0;
        let biggestLoss = 0;
        const strategyPnl: Record<string, number> = {};
        for (const t of closedTrades) {
          const pnl = toNum(t.pnl);
          pnlSum += pnl;
          if (pnl > 0) wins++;
          else if (pnl < 0) losses++;
          if (pnl > biggestWin) biggestWin = pnl;
          if (pnl < biggestLoss) biggestLoss = pnl;
          const rp = asRawPayload(t.raw_payload);
          const s = String(t.strategy ?? rp.strategy ?? "unknown");
          strategyPnl[s] = (strategyPnl[s] || 0) + pnl;
        }

        let bestStrategy: string | null = null;
        let worstStrategy: string | null = null;
        let bestVal = -Infinity;
        let worstVal = Infinity;
        for (const [s, v] of Object.entries(strategyPnl)) {
          if (v > bestVal) {
            bestVal = v;
            bestStrategy = s;
          }
          if (v < worstVal) {
            worstVal = v;
            worstStrategy = s;
          }
        }

        const skippedCount = aiDecisions.filter((d) => {
          const dec = String(d.decision ?? "").toUpperCase();
          const rs = String(d.risk_status ?? "").toUpperCase();
          return (
            dec === "SKIP" ||
            dec === "BLOCK" ||
            dec === "BLOCKED" ||
            rs === "BLOCKED" ||
            d.blocked_reason
          );
        }).length;

        const confidences = aiDecisions.map((d) => toNum(d.confidence)).filter((n) => n > 0);
        const avgConfidence =
          confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

        const lots = paperTrades.map((t) => toNum(t.lot_size ?? t.lot)).filter((n) => n > 0);
        const avgLot = lots.length > 0 ? lots.reduce((a, b) => a + b, 0) / lots.length : 0;

        const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;

        const safetyIssues: string[] = [];
        const errors = [
          paperEventsRes.error,
          allEventsRes.error,
          tradesRes.error,
          aiDecisionsRes.error,
          kellyRiskRes.error,
          strategySignalsRes.error,
          logsRes.error,
        ].filter(Boolean);
        for (const e of errors)
          safetyIssues.push(`query_error: ${(e as { message: string }).message}`);
        if (demoOrLiveDetected) safetyIssues.push("demo_or_live_orders_detected");
        for (const l of logs) {
          const lvl = String(l.level ?? "").toUpperCase();
          if (lvl === "ERROR" || lvl === "CRITICAL" || lvl === "FATAL") {
            safetyIssues.push(`log_${lvl.toLowerCase()}: ${l.message}`);
          }
        }

        return jsonResponse({
          ok: true,
          hours,
          summary: {
            paper_trades_opened: opened,
            paper_trades_closed: closed,
            paper_pnl: pnlSum,
            wins,
            losses,
            win_rate: winRate,
            best_strategy: bestStrategy,
            worst_strategy: worstStrategy,
            skipped_count: skippedCount,
            average_confidence: avgConfidence,
            average_lot_size: avgLot,
            biggest_win: biggestWin,
            biggest_loss: biggestLoss,
            safety_issues: safetyIssues,
            demo_or_live_orders_detected: demoOrLiveDetected,
          },
          counts: {
            paper_events: paperEvents.length,
            paper_trades: paperTrades.length,
            open_trades: openTrades.length,
            closed_trades: closedTrades.length,
            recent_ai_decisions: aiDecisions.length,
            recent_kelly_risk: kellyRisk.length,
            recent_strategy_signals: strategySignals.length,
            recent_logs: logs.length,
            trades_total: paperTrades.length,
          },
          paper_events: paperEvents,
          open_trades: openTrades,
          closed_trades: closedTrades,
          recent_ai_decisions: aiDecisions,
          recent_kelly_risk: kellyRisk,
          recent_strategy_signals: strategySignals,
          recent_logs: logs,
        });
      },
    },
  },
});
