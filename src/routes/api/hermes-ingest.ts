import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_TABLES = new Set([
  "account_snapshots",
  "bot_status",
  "hermes_agents",
  "market_candles",
  "market_states",
  "markov_predictions",
  "kelly_risk",
  "strategy_signals",
  "ai_decisions",
  "execution_events",
  "trades",
  "bot_logs",
  "nightly_reports",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hermes-secret",
};

export const Route = createFileRoute("/api/hermes-ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const secret = process.env.HERMES_INGEST_SECRET;
        const provided = request.headers.get("x-hermes-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json", ...corsHeaders },
          });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "content-type": "application/json", ...corsHeaders },
          });
        }

        const table = payload?.table as string | undefined;
        const data = payload?.data;
        if (!table || !ALLOWED_TABLES.has(table)) {
          return new Response(JSON.stringify({ error: "invalid table" }), {
            status: 400,
            headers: { "content-type": "application/json", ...corsHeaders },
          });
        }
        if (!data || (typeof data !== "object" && !Array.isArray(data))) {
          return new Response(JSON.stringify({ error: "missing data" }), {
            status: 400,
            headers: { "content-type": "application/json", ...corsHeaders },
          });
        }

        const rows = Array.isArray(data) ? data : [data];
        const { data: inserted, error } = await supabaseAdmin
          .from(table as any)
          .insert(rows as any)
          .select();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json", ...corsHeaders },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, table, inserted: inserted?.length ?? 0 }),
          { status: 200, headers: { "content-type": "application/json", ...corsHeaders } },
        );
      },
    },
  },
});
