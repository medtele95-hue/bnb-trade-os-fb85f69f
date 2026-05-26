import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// table -> { columns: Set<string>, conflict?: string[], mode: "insert" | "upsert" }
const TABLES: Record<
  string,
  { columns: string[]; mode: "insert" | "upsert"; conflict?: string }
> = {
  account_snapshots: {
    mode: "insert",
    columns: [
      "id", "created_at", "balance", "equity", "margin", "free_margin",
      "open_positions", "daily_pnl", "total_pnl", "max_drawdown",
      "profit_factor", "win_rate", "total_trades", "trades_today",
    ],
  },
  ai_decisions: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "timeframe", "market_state", "strategy",
      "signal", "confidence", "decision", "reason", "blocked_reason",
      "risk_status", "lot_size", "entry", "sl", "tp", "markov_probability",
    ],
  },
  bot_logs: {
    mode: "insert",
    columns: ["id", "created_at", "level", "source", "message"],
  },
  bot_status: {
    mode: "upsert",
    conflict: "component",
    columns: [
      "id", "component", "status", "latency_ms", "uptime", "last_heartbeat",
      "meta", "updated_at",
    ],
  },
  execution_events: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "side", "lot", "price", "result",
      "magic", "mode", "payload",
    ],
  },
  hermes_agents: {
    mode: "upsert",
    conflict: "name",
    columns: [
      "id", "name", "tag", "status", "symbol", "timeframe", "latest_signal",
      "confidence", "pnl_today", "meta", "updated_at",
    ],
  },
  kelly_risk: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "model_probability", "reward_risk",
      "edge", "kelly_fraction", "final_risk", "lot_size", "status",
    ],
  },
  market_candles: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "timeframe", "candle_time",
      "open", "high", "low", "close", "tick_volume", "spread",
    ],
  },
  market_states: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "timeframe", "state", "trend",
      "volatility", "price", "spread",
    ],
  },
  markov_predictions: {
    mode: "insert",
    columns: [
      "id", "created_at", "symbol", "timeframe", "current_state",
      "predicted_state", "probability", "persistence_bars", "transitions",
      "signal",
    ],
  },
  nightly_reports: {
    mode: "insert",
    columns: [
      "id", "created_at", "report_date", "trades_reviewed", "best_setup",
      "worst_setup", "best_session", "suggestion", "summary", "payload",
    ],
  },
  settings: {
    mode: "upsert",
    conflict: "key",
    columns: ["id", "key", "value", "updated_at"],
  },
  strategy_signals: {
    mode: "insert",
    columns: [
      "id", "created_at", "strategy", "symbol", "status", "signal",
      "confidence", "pnl", "reason", "win_rate",
    ],
  },
  trades: {
    mode: "insert",
    columns: [
      "id", "created_at", "opened_at", "closed_at", "symbol", "dir",
      "lot", "entry", "sl", "tp", "ticket", "magic", "strategy",
      "confidence", "reason", "result", "pnl",
    ],
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hermes-secret",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function cleanRow(row: Record<string, unknown>, allowed: string[]) {
  const allowedSet = new Set(allowed);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!allowedSet.has(k)) continue;
    if (v === undefined) continue;
    if (typeof v === "string" && v === "") {
      out[k] = null;
      continue;
    }
    if (typeof v === "number" && !Number.isFinite(v)) {
      // reject NaN / Infinity by dropping (use null)
      out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export const Route = createFileRoute("/api/public/hermes-ingest")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const secret = process.env.HERMES_INGEST_SECRET;
        const provided = request.headers.get("x-hermes-secret");
        if (!secret || !provided || provided !== secret) {
          return json(401, {
            ok: false,
            table: null,
            error: "unauthorized",
            details: "missing or invalid x-hermes-secret header",
          });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch (e: any) {
          return json(400, {
            ok: false,
            table: null,
            error: "invalid_json",
            details: e?.message ?? "could not parse JSON body",
          });
        }

        const table = payload?.table as string | undefined;
        const data = payload?.data;

        if (!table || typeof table !== "string") {
          return json(400, {
            ok: false,
            table: table ?? null,
            error: "missing_table",
            details: "payload.table is required",
          });
        }

        const spec = TABLES[table];
        if (!spec) {
          return json(400, {
            ok: false,
            table,
            error: "invalid_table",
            details: `table '${table}' is not allowed`,
          });
        }

        if (data === undefined || data === null) {
          return json(400, {
            ok: false,
            table,
            error: "missing_data",
            details: "payload.data is required",
          });
        }

        const rawRows = Array.isArray(data) ? data : [data];
        for (const r of rawRows) {
          if (!r || typeof r !== "object" || Array.isArray(r)) {
            return json(400, {
              ok: false,
              table,
              error: "invalid_row",
              details: "each data row must be an object",
            });
          }
        }

        const rows = rawRows.map((r) =>
          cleanRow(r as Record<string, unknown>, spec.columns),
        );

        console.log(
          `[hermes-ingest] table=${table} rows=${rows.length} keys=${JSON.stringify(
            rows.map((r) => Object.keys(r)),
          )}`,
        );

        try {
          const query = supabaseAdmin.from(table as any);
          const op =
            spec.mode === "upsert"
              ? query.upsert(rows as any, { onConflict: spec.conflict })
              : query.insert(rows as any);
          const { data: inserted, error } = await op.select();

          if (error) {
            console.log(
              `[hermes-ingest] db_error table=${table} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""} code=${error.code ?? ""}`,
            );
            return json(400, {
              ok: false,
              table,
              error: "db_error",
              details: error.message,
              hint: error.hint,
              code: error.code,
            });
          }

          const result = {
            ok: true,
            table,
            inserted: inserted?.length ?? rows.length,
          };
          console.log(`[hermes-ingest] success ${JSON.stringify(result)}`);
          return json(200, result);
        } catch (e: any) {
          console.log(
            `[hermes-ingest] exception table=${table} message=${e?.message}`,
          );
          return json(500, {
            ok: false,
            table,
            error: "exception",
            details: e?.message ?? String(e),
          });
        }
      },
    },
  },
});
