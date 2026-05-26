import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Allowlist of writable tables and how to write them.
// Column filtering is done dynamically from live information_schema (cached),
// so adding a column via migration is enough — no code change required here.
const TABLES: Record<string, { mode: "insert" | "upsert"; conflict?: string }> = {
  account_snapshots: { mode: "insert" },
  ai_decisions: { mode: "insert" },
  bot_logs: { mode: "insert" },
  bot_status: { mode: "upsert", conflict: "component" },
  execution_events: { mode: "insert" },
  hermes_agents: { mode: "upsert", conflict: "name" },
  kelly_risk: { mode: "insert" },
  market_candles: { mode: "insert" },
  market_states: { mode: "insert" },
  markov_predictions: { mode: "insert" },
  nightly_reports: { mode: "insert" },
  settings: { mode: "upsert", conflict: "key" },
  strategy_signals: { mode: "insert" },
  trades: { mode: "insert" },
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

// Cache live column lists per table for 60s
const columnCache: Record<string, { cols: Set<string>; at: number }> = {};
const CACHE_MS = 60_000;

async function getColumns(table: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = columnCache[table];
  if (cached && now - cached.at < CACHE_MS) return cached.cols;

  // Probe one row to learn column names. Falls back to empty select.
  const { data, error } = await supabaseAdmin
    .from(table as any)
    .select("*")
    .limit(1);

  if (error) throw error;

  let cols = new Set<string>();
  if (data && data.length > 0) {
    cols = new Set(Object.keys(data[0] as object));
  } else {
    // Empty table: insert a probe-free no-op by selecting head with count.
    // As a fallback when there are no rows, allow any field through on first
    // insert; PostgREST will reject unknown columns with a clear error.
    cols = new Set<string>();
  }
  columnCache[table] = { cols, at: now };
  return cols;
}

function cleanRow(row: Record<string, unknown>, allowed: Set<string>) {
  const out: Record<string, unknown> = {};
  const useAllowlist = allowed.size > 0;
  for (const [k, v] of Object.entries(row)) {
    if (useAllowlist && !allowed.has(k)) continue;
    if (v === undefined) continue;
    if (typeof v === "string" && v === "") {
      out[k] = null;
      continue;
    }
    if (typeof v === "number" && !Number.isFinite(v)) {
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

        let allowed: Set<string>;
        try {
          allowed = await getColumns(table);
        } catch (e: any) {
          return json(500, {
            ok: false,
            table,
            error: "schema_lookup_failed",
            details: e?.message ?? String(e),
          });
        }

        const rows = rawRows.map((r) =>
          cleanRow(r as Record<string, unknown>, allowed),
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
            // Bust cache in case schema changed
            delete columnCache[table];
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
