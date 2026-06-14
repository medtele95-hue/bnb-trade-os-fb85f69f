import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

type KnownTable = keyof Database["public"]["Tables"];
type AnyTableInsert = Database["public"]["Tables"][KnownTable]["Insert"];
type AnyTableUpdate = Database["public"]["Tables"][KnownTable]["Update"];
type CleanedRow = Record<string, Json | undefined>;
type FilterValue = string | number | boolean | null;

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

// ============ RATE LIMITING ============
// Per-instance in-memory limiter — Cloudflare Worker instances are single-threaded.
// State does not persist across instances but limits abuse within a single isolate.
const ipRequests = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    ipRequests.set(ip, { count: 1, windowStart: now });
    return { limited: false, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  entry.count += 1;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetAt = entry.windowStart + RATE_LIMIT_WINDOW_MS;

  return { limited: entry.count > RATE_LIMIT_MAX, remaining, resetAt };
}

// ============ ZOD SCHEMA ============
const HermesPayloadSchema = z.object({
  table: z.string().min(1, "table is required"),
  data: z.union([z.array(z.record(z.unknown())), z.record(z.unknown())]),
  action: z.enum(["insert", "upsert", "update"]).optional(),
  match: z.record(z.unknown()).optional(),
});

// ============ CORS & HELPERS ============
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

function applyTableDefaults(table: KnownTable, row: Record<string, unknown>) {
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
    const key = conflictKeys.map((column) => String(row[column] ?? "")).join(" ");
    byConflictKey.set(key, row);
  }
  return [...byConflictKey.values()];
}

// Typed RPC helper — avoids casting the entire supabaseAdmin client as any.
type RpcResult = { data: string[] | null; error: { message: string } | null };
type TypedRpcFn = (fn: string, params: Record<string, unknown>) => Promise<RpcResult>;

async function getLiveColumns(table: KnownTable, spec: TableSpec): Promise<string[]> {
  const { data, error } = await (supabaseAdmin.rpc as unknown as TypedRpcFn)(
    "hermes_table_columns",
    { _table_name: table },
  );

  if (error || !Array.isArray(data) || data.length === 0) {
    console.log(
      `[hermes-ingest] live_schema_fallback table=${table} error=${error?.message ?? "empty result"}`,
    );
    return spec.columns;
  }

  return data;
}

function prepareRows(
  table: KnownTable,
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

async function writeRows(table: KnownTable, spec: TableSpec, rows: CleanedRow[]) {
  const query = supabaseAdmin.from(table);
  const op =
    spec.mode === "upsert"
      ? query.upsert(rows as unknown as AnyTableInsert[], {
          onConflict: spec.conflict,
          ignoreDuplicates: false,
        })
      : query.insert(rows as unknown as AnyTableInsert[]);
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
  const duplicateConstraints: Record<string, string> = {
    bot_status: "bot_status_component_key",
    hermes_agents: "hermes_agents_name_key",
    market_candles: "market_candles_symbol_timeframe_candle_time_key",
  };
  const constraint = duplicateConstraints[table];
  if (!constraint) return false;

  const text = [error.message, error.details, error.hint, error.code].filter(Boolean).join("\n");

  return error.code === "23505" || text.includes(constraint);
}

function duplicateConflictResult(table: string) {
  return {
    ok: true,
    table,
    conflict_ignored: true,
  };
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

// ============ HANDLER ============
// Exported so tests can import and call it directly with a mocked supabaseAdmin.
export async function handleHermesPost({ request }: { request: Request }): Promise<Response> {
  // 1. Rate limit — checked BEFORE secret validation
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip);

  if (rl.limited) {
    const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ ok: false, error: "rate_limit_exceeded", retry_after: retryAfterSecs }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          ...corsHeaders,
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      },
    );
  }

  // 2. Secret check
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

  // 3. Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (e: unknown) {
    return json(400, {
      ok: false,
      table: null,
      error: "invalid_json",
      details: (e instanceof Error ? e.message : null) ?? "could not parse JSON body",
    });
  }

  // 4. Zod schema validation
  const parsed = HermesPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(400, {
      ok: false,
      table: null,
      error: "validation_error",
      details: parsed.error.issues
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; "),
    });
  }

  const { table, data, action = "insert", match } = parsed.data;

  // 5. Table allowlist check
  const spec = TABLES[table];
  if (!spec) {
    return json(400, {
      ok: false,
      table,
      error: "invalid_table",
      details: `table '${table}' is not allowed`,
    });
  }

  // table is a valid key of TABLES which equals KnownTable
  const knownTable = table as KnownTable;

  if (data === undefined || data === null) {
    return json(400, {
      ok: false,
      table,
      error: "missing_data",
      details: "payload.data is required",
    });
  }

  // 6. UPDATE path
  if (action === "update") {
    if (!match || typeof match !== "object" || Array.isArray(match)) {
      return json(400, {
        ok: false,
        table,
        error: "missing_match",
        details: "payload.match object is required for action=update",
      });
    }
    const matchEntries = Object.entries(match as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null,
    );
    if (matchEntries.length === 0) {
      return json(400, {
        ok: false,
        table,
        error: "empty_match",
        details: "payload.match must contain at least one filter",
      });
    }

    const updateRaw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    if (!updateRaw || typeof updateRaw !== "object" || Array.isArray(updateRaw)) {
      return json(400, {
        ok: false,
        table,
        error: "invalid_row",
        details: "payload.data must be an object for action=update",
      });
    }

    const liveColumns = await getLiveColumns(knownTable, spec);
    const allowed = new Set(liveColumns);
    const updateRow: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updateRaw)) {
      if (!allowed.has(k)) continue;
      const normalized = normalizeValue(v);
      if (normalized === undefined) continue;
      updateRow[k] = normalized;
    }
    if (allowed.has("raw_payload")) {
      updateRow.raw_payload = updateRaw;
    }

    if (Object.keys(updateRow).length === 0) {
      return json(400, {
        ok: false,
        table,
        error: "empty_update",
        details: "no allowed columns in payload.data",
      });
    }

    try {
      let q = supabaseAdmin.from(knownTable).update(updateRow as unknown as AnyTableUpdate);
      for (const [col, val] of matchEntries) {
        q = q.eq(col, val as FilterValue);
      }
      const { data: updated, error } = await q.select();

      if (error) {
        console.log(
          `[hermes-ingest] update_db_error table=${table} match=${JSON.stringify(match)} message=${error.message} code=${error.code ?? ""}`,
        );
        return json(400, {
          ok: false,
          table,
          action: "update",
          error: error.message,
          code: error.code ?? null,
          hint: error.hint ?? null,
        });
      }

      const count = updated?.length ?? 0;
      if (count === 0) {
        console.log(
          `[hermes-ingest] update_no_match table=${table} match=${JSON.stringify(match)}`,
        );
        return json(404, {
          ok: false,
          table,
          action: "update",
          error: "NO_MATCHING_ROW",
          match,
        });
      }

      const result = { ok: true, table, action: "update", updated: count };
      console.log(`[hermes-ingest] update_success ${JSON.stringify(result)}`);
      return json(200, result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[hermes-ingest] update_exception table=${table} message=${msg}`);
      return json(400, { ok: false, table, action: "update", error: msg });
    }
  }

  // 7. INSERT / UPSERT path
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
  const liveColumns = await getLiveColumns(knownTable, spec);
  let allowedKeys = [...liveColumns].sort();
  let rows = prepareRows(knownTable, spec, rawRows as Record<string, unknown>[], liveColumns);
  let allowed = new Set(liveColumns);
  const strippedKeys = receivedKeys.filter((key) => !allowed.has(key));

  console.log(
    `[hermes-ingest] table=${table} rows=${rows.length} received_keys=${JSON.stringify(receivedKeys)} allowed_keys=${JSON.stringify(allowedKeys)} stripped_keys=${JSON.stringify(strippedKeys)} write_keys=${JSON.stringify(rows.map((r) => Object.keys(r)))}`,
  );

  try {
    let { data: inserted, error } = await writeRows(knownTable, spec, rows as CleanedRow[]);

    if (error) {
      console.log(
        `[hermes-ingest] db_error table=${table} received_keys=${JSON.stringify(receivedKeys)} allowed_keys=${JSON.stringify(allowedKeys)} stripped_keys=${JSON.stringify(strippedKeys)} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""} code=${error.code ?? ""}`,
      );

      const missingColumn = extractMissingColumn(error);
      if (missingColumn) {
        const retryColumns = liveColumns.filter((column) => column !== missingColumn);
        allowedKeys = [...retryColumns].sort();
        allowed = new Set(retryColumns);
        rows = prepareRows(knownTable, spec, rawRows as Record<string, unknown>[], retryColumns);
        console.log(
          `[hermes-ingest] retry_without_missing_column table=${table} column=${missingColumn} allowed_keys=${JSON.stringify(allowedKeys)} write_keys=${JSON.stringify(rows.map((r) => Object.keys(r)))}`,
        );
        const retry = await writeRows(knownTable, spec, rows as CleanedRow[]);
        inserted = retry.data;
        error = retry.error;
      }

      if (error && isDuplicateCandleOk(table, error)) {
        const result = duplicateConflictResult(table);
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[hermes-ingest] exception table=${table} message=${msg}`);
    const error: DbWriteError = {
      message: msg,
      details: (e as DbWriteError)?.details,
      hint: (e as DbWriteError)?.hint,
      code: (e as DbWriteError)?.code,
    };
    if (isDuplicateCandleOk(table, error)) {
      const result = duplicateConflictResult(table);
      console.log(`[hermes-ingest] duplicate_exception_ok ${JSON.stringify(result)}`);
      return json(200, result);
    }
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

export const Route = createFileRoute("/api/public/hermes-ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: handleHermesPost,
    },
  },
});
