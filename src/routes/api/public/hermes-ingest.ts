import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TableSpec = {
  mode: "insert" | "upsert";
  conflict?: string;
  columns: string[];
};

// Writable table allowlist. Unknown-field stripping uses these real schema
// columns before insert/upsert so PostgREST never receives unexpected keys.
const TABLES: Record<string, TableSpec> = {
  account_snapshots: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "balance",
      "equity",
      "margin",
      "free_margin",
      "daily_pnl",
      "total_pnl",
      "trades_today",
      "total_trades",
      "win_rate",
      "profit_factor",
      "max_drawdown",
      "open_positions",
      "currency",
      "login",
      "margin_level",
      "profit",
      "server",
      "snapshot_time",
      "raw_payload",
    ],
  },
  ai_decisions: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "market_state",
      "symbol",
      "timeframe",
      "decision",
      "reason",
      "blocked_reason",
      "tp",
      "sl",
      "entry",
      "lot_size",
      "risk_status",
      "confidence",
      "signal",
      "strategy",
      "markov_probability",
      "kelly_fraction",
      "raw_payload",
    ],
  },
  bot_logs: {
    mode: "insert",
    columns: ["id", "created_at", "level", "message", "source", "context", "raw_payload"],
  },
  bot_status: {
    mode: "upsert",
    conflict: "component",
    columns: [
      "id",
      "updated_at",
      "component",
      "status",
      "last_heartbeat",
      "uptime",
      "latency_ms",
      "meta",
      "bot_name",
      "symbols",
      "allow_live_trading",
      "magic_number",
      "demo_trading",
      "mode",
      "read_only",
      "paper_trading",
      "raw_payload",
    ],
  },
  execution_events: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "symbol",
      "side",
      "lot",
      "price",
      "magic",
      "mode",
      "payload",
      "result",
      "decision",
      "event_type",
      "magic_number",
      "raw_payload",
    ],
  },
  hermes_agents: {
    mode: "upsert",
    conflict: "name",
    columns: [
      "id",
      "updated_at",
      "name",
      "tag",
      "status",
      "symbol",
      "timeframe",
      "latest_signal",
      "confidence",
      "pnl_today",
      "meta",
      "display_name",
      "magic_number",
      "mode",
      "symbols",
      "active_symbol",
      "last_update",
      "raw_payload",
    ],
  },
  kelly_risk: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "model_probability",
      "reward_risk",
      "edge",
      "lot_size",
      "status",
      "kelly_fraction",
      "symbol",
      "final_risk",
      "blocked_reason",
      "daily_loss_pct",
      "drawdown_pct",
      "fractional_kelly",
      "max_daily_loss",
      "max_drawdown",
      "max_risk_per_trade",
      "open_hermes_trades",
      "probability",
      "spread",
      "timeframe",
      "raw_payload",
    ],
  },
  market_candles: {
    mode: "upsert",
    conflict: "symbol,timeframe,candle_time",
    columns: [
      "id",
      "created_at",
      "symbol",
      "timeframe",
      "candle_time",
      "open",
      "high",
      "low",
      "close",
      "tick_volume",
      "spread",
      "broker_symbol",
      "raw_payload",
    ],
  },
  market_states: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "symbol",
      "timeframe",
      "state",
      "trend",
      "price",
      "spread",
      "volatility",
      "atr",
      "ema20",
      "ema50",
      "ema200",
      "rsi",
      "session",
      "raw_payload",
    ],
  },
  markov_predictions: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "symbol",
      "timeframe",
      "current_state",
      "predicted_state",
      "probability",
      "persistence_bars",
      "transitions",
      "signal",
      "confidence",
      "persistence",
      "predicted_next_state",
      "transition_count",
      "raw_payload",
    ],
  },
  nightly_reports: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "report_date",
      "payload",
      "summary",
      "suggestion",
      "best_session",
      "worst_setup",
      "best_setup",
      "trades_reviewed",
      "status",
      "raw_payload",
    ],
  },
  settings: {
    mode: "upsert",
    conflict: "key",
    columns: ["id", "updated_at", "key", "value"],
  },
  strategy_signals: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "strategy",
      "symbol",
      "signal",
      "status",
      "confidence",
      "win_rate",
      "pnl",
      "reason",
      "blocked_reason",
      "entry",
      "sl",
      "tp",
      "timeframe",
      "raw_payload",
    ],
  },
  trades: {
    mode: "insert",
    columns: [
      "id",
      "created_at",
      "symbol",
      "dir",
      "magic",
      "ticket",
      "entry",
      "sl",
      "tp",
      "lot",
      "pnl",
      "result",
      "strategy",
      "confidence",
      "reason",
      "opened_at",
      "closed_at",
      "lot_size",
      "magic_number",
      "signal",
      "raw_payload",
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

type DbWriteError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function normalizeValue(v: unknown) {
  if (v === undefined) return undefined;
  if (typeof v === "string" && v === "") return null;
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  return v;
}

function cleanRow(
  row: Record<string, unknown>,
  allowed: Set<string>,
  rawRow: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!allowed.has(k)) continue;
    const normalized = normalizeValue(v);
    if (normalized === undefined) continue;
    out[k] = normalized;
  }
  if (allowed.has("raw_payload")) {
    out.raw_payload = rawRow;
  }
  return out;
}

function applyTableDefaults(table: string, row: Record<string, unknown>) {
  const next = { ...row };

  if (
    table === "bot_status" &&
    (next.component === undefined || next.component === null || next.component === "")
  ) {
    next.component = "hermes_core";
  }

  if (table === "markov_predictions") {
    if (
      (next.predicted_state === undefined ||
        next.predicted_state === null ||
        next.predicted_state === "") &&
      next.predicted_next_state !== undefined &&
      next.predicted_next_state !== null &&
      next.predicted_next_state !== ""
    ) {
      next.predicted_state = next.predicted_next_state;
    }
    if (
      next.predicted_state === undefined ||
      next.predicted_state === null ||
      next.predicted_state === ""
    ) {
      next.predicted_state = "UNKNOWN";
    }
  }

  return next;
}

function rowKeys(rows: Record<string, unknown>[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).sort();
}

function dedupeUpsertRows(rows: Record<string, unknown>[], spec: TableSpec) {
  if (spec.mode !== "upsert" || !spec.conflict) return rows;
  const conflictKeys = spec.conflict.split(",").map((key) => key.trim());
  const byConflictKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = conflictKeys.map((column) => String(row[column] ?? "")).join("\u0000");
    byConflictKey.set(key, row);
  }
  return [...byConflictKey.values()];
}

async function getLiveColumns(table: string, spec: TableSpec) {
  const { data, error } = await (supabaseAdmin as any).rpc("hermes_table_columns", {
    _table_name: table,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    console.log(
      `[hermes-ingest] live_schema_fallback table=${table} error=${error?.message ?? "empty result"}`,
    );
    return spec.columns;
  }

  return data as string[];
}

function prepareRows(
  table: string,
  spec: TableSpec,
  rawRows: Record<string, unknown>[],
  allowedColumns: string[],
) {
  const allowed = new Set(allowedColumns);
  const cleanedRows = rawRows.map((rawRow) =>
    applyTableDefaults(table, cleanRow(rawRow, allowed, rawRow)),
  );
  return dedupeUpsertRows(cleanedRows, spec);
}

async function writeRows(table: string, spec: TableSpec, rows: Record<string, unknown>[]) {
  const query = supabaseAdmin.from(table as any);
  const op =
    spec.mode === "upsert"
      ? query.upsert(rows as any, {
          onConflict: spec.conflict,
          ignoreDuplicates: false,
        })
      : query.insert(rows as any);
  return op.select();
}

function extractMissingColumn(error: DbWriteError) {
  const text = [error.message, error.details, error.hint].filter(Boolean).join("\n");
  const quotedColumn = text.match(/Could not find the '([^']+)' column/i)?.[1];
  if (quotedColumn) return quotedColumn;
  const plainColumn = text.match(/Could not find column\s+([a-zA-Z0-9_]+)/i)?.[1];
  if (plainColumn) return plainColumn;
  const schemaCacheColumn = text.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+.*schema cache/i)?.[1];
  return schemaCacheColumn ?? null;
}

function isDuplicateCandleOk(table: string, error: DbWriteError) {
  if (error.code !== "23505") return false;
  return (
    table === "market_candles" ||
    table === "bot_status" ||
    table === "hermes_agents"
  );
}

function errorBody(args: {
  table: string;
  error: DbWriteError;
  receivedKeys: string[];
  allowedKeys: string[];
  strippedKeys: string[];
}) {
  return {
    ok: false,
    table: args.table,
    error: args.error.message,
    details: args.error.message,
    received_keys: args.receivedKeys,
    allowed_keys: args.allowedKeys,
    stripped_keys: args.strippedKeys,
    code: args.error.code ?? null,
    hint: args.error.hint ?? null,
    postgres_error: {
      message: args.error.message,
      details: args.error.details,
      hint: args.error.hint,
      code: args.error.code,
    },
  };
}

export const Route = createFileRoute("/api/public/hermes-ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
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

        const receivedKeys = rowKeys(rawRows as Record<string, unknown>[]);
        const liveColumns = await getLiveColumns(table, spec);
        let allowedKeys = [...liveColumns].sort();
        let rows = prepareRows(table, spec, rawRows as Record<string, unknown>[], liveColumns);
        let allowed = new Set(liveColumns);
        const strippedKeys = receivedKeys.filter((key) => !allowed.has(key));

        console.log(
          `[hermes-ingest] table=${table} rows=${rows.length} received_keys=${JSON.stringify(receivedKeys)} allowed_keys=${JSON.stringify(allowedKeys)} stripped_keys=${JSON.stringify(strippedKeys)} write_keys=${JSON.stringify(rows.map((r) => Object.keys(r)))}`,
        );

        try {
          let { data: inserted, error } = await writeRows(table, spec, rows);

          if (error) {
            console.log(
              `[hermes-ingest] db_error table=${table} received_keys=${JSON.stringify(receivedKeys)} allowed_keys=${JSON.stringify(allowedKeys)} stripped_keys=${JSON.stringify(strippedKeys)} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""} code=${error.code ?? ""}`,
            );

            const missingColumn = extractMissingColumn(error);
            if (missingColumn) {
              const retryColumns = liveColumns.filter((column) => column !== missingColumn);
              allowedKeys = [...retryColumns].sort();
              allowed = new Set(retryColumns);
              rows = prepareRows(table, spec, rawRows as Record<string, unknown>[], retryColumns);
              console.log(
                `[hermes-ingest] retry_without_missing_column table=${table} column=${missingColumn} allowed_keys=${JSON.stringify(allowedKeys)} write_keys=${JSON.stringify(rows.map((r) => Object.keys(r)))}`,
              );
              const retry = await writeRows(table, spec, rows);
              inserted = retry.data;
              error = retry.error;
            }

            if (error && isDuplicateCandleOk(table, error)) {
              const result: Record<string, unknown> = {
                ok: true,
                table,
                inserted: 0,
              };
              if (table === "market_candles") {
                result.duplicate_ignored = true;
              } else {
                result.upserted = true;
              }
              console.log(`[hermes-ingest] duplicate_ok ${JSON.stringify(result)}`);
              return json(200, result);
            }

            if (error) {
              return json(
                400,
                errorBody({
                  table,
                  error,
                  receivedKeys,
                  allowedKeys,
                  strippedKeys: receivedKeys.filter((key) => !allowed.has(key)),
                }),
              );
            }
          }

          const result = {
            ok: true,
            table,
            inserted: inserted?.length ?? rows.length,
          };
          console.log(`[hermes-ingest] success ${JSON.stringify(result)}`);
          return json(200, result);
        } catch (e: any) {
          console.log(`[hermes-ingest] exception table=${table} message=${e?.message}`);
          return json(
            400,
            errorBody({
              table,
              error: {
                message: e?.message ?? String(e),
                details: e?.details,
                hint: e?.hint,
                code: e?.code,
              },
              receivedKeys,
              allowedKeys,
              strippedKeys: receivedKeys.filter((key) => !allowed.has(key)),
            }),
          );
        }
      },
    },
  },
});
