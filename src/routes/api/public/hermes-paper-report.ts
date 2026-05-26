import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toNum(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
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
        const hoursRaw = parseFloat(url.searchParams.get("hours") || "1");
        const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 24 * 30) : 1;
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
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(500),
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

        const paperEvents = paperEventsRes.data ?? [];
        const allEvents = allEventsRes.data ?? [];
        const trades = tradesRes.data ?? [];
        const aiDecisions = aiDecisionsRes.data ?? [];
        const kellyRisk = kellyRiskRes.data ?? [];
        const strategySignals = strategySignalsRes.data ?? [];
        const logs = logsRes.data ?? [];

        // Detect demo/live orders
        const demoOrLiveDetected = allEvents.some((e: any) => {
          const m = (e.mode || "").toUpperCase();
          const et = (e.event_type || "").toUpperCase();
          return (
            (m && m !== "PAPER" && m !== "READ_ONLY" && (m === "DEMO" || m === "LIVE")) ||
            et.startsWith("DEMO") ||
            et.startsWith("LIVE")
          );
        });

        // Paper opened / closed counts from execution_events
        let opened = 0;
        let closed = 0;
        for (const e of paperEvents as any[]) {
          const et = (e.event_type || "").toUpperCase();
          if (et.includes("OPEN")) opened++;
          else if (et.includes("CLOSE")) closed++;
        }

        // Closed trades (have closed_at or result/pnl)
        const closedTrades = (trades as any[]).filter(
          (t) => t.closed_at || t.result || t.pnl != null,
        );

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
          const s = t.strategy || "unknown";
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

        const skippedCount = (aiDecisions as any[]).filter((d) => {
          const dec = (d.decision || "").toUpperCase();
          const rs = (d.risk_status || "").toUpperCase();
          return dec === "SKIP" || dec === "BLOCK" || dec === "BLOCKED" || rs === "BLOCKED" || d.blocked_reason;
        }).length;

        const confidences = (aiDecisions as any[])
          .map((d) => toNum(d.confidence))
          .filter((n) => n > 0);
        const avgConfidence =
          confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;

        const lots = (trades as any[])
          .map((t) => toNum(t.lot_size ?? t.lot))
          .filter((n) => n > 0);
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
        for (const e of errors) safetyIssues.push(`query_error: ${(e as any).message}`);
        if (demoOrLiveDetected) safetyIssues.push("demo_or_live_orders_detected");
        for (const l of logs as any[]) {
          const lvl = (l.level || "").toUpperCase();
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
            closed_trades: closedTrades.length,
            recent_ai_decisions: aiDecisions.length,
            recent_kelly_risk: kellyRisk.length,
            recent_strategy_signals: strategySignals.length,
            recent_logs: logs.length,
            trades_total: trades.length,
          },
          paper_events: paperEvents,
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
