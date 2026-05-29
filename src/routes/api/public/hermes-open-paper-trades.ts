import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-hermes-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function getMode(t: any): string {
  const rp = t.raw_payload || {};
  const inner = rp.raw_payload || {};
  return String(rp.mode ?? inner.mode ?? t.mode ?? "").toUpperCase();
}
function getStatus(t: any): string {
  const rp = t.raw_payload || {};
  const inner = rp.raw_payload || {};
  return String(rp.status ?? inner.status ?? "").toUpperCase();
}
function getDir(t: any): string {
  const rp = t.raw_payload || {};
  return String(t.dir ?? rp.dir ?? rp.direction ?? "").toUpperCase();
}
function num(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export const Route = createFileRoute("/api/public/hermes-open-paper-trades")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const magicParam = url.searchParams.get("magic_number");
          const magic = magicParam ? Number(magicParam) : 909001;

          const { data, error } = await supabaseAdmin
            .from("trades")
            .select("*")
            .eq("magic_number", magic)
            .is("closed_at", null)
            .order("opened_at", { ascending: false })
            .limit(500);

          if (error) {
            return json({ ok: false, error: error.message, rows: [] }, 500);
          }

          const rows = (data ?? []).filter((t: any) => {
            if (t.closed_at != null) return false;
            const result = t.result;
            if (result != null && result !== "-" && result !== "") return false;
            const status = getStatus(t);
            if (status && status !== "OPEN") return false;
            const mode = getMode(t);
            const isPaper = mode === "PAPER" || Number(t.magic_number) === 909001;
            if (!isPaper) return false;
            const dir = getDir(t);
            if (!t.symbol || !dir) return false;
            const entry = num(t.entry);
            const sl = num(t.sl);
            const tp = num(t.tp);
            if (entry == null || sl == null || tp == null) return false;
            const lot = num(t.lot_size ?? t.lot);
            if (lot == null || lot <= 0) return false;
            return true;
          }).map((t: any) => ({
            id: t.id,
            symbol: t.symbol,
            dir: getDir(t),
            entry: num(t.entry),
            sl: num(t.sl),
            tp: num(t.tp),
            lot_size: num(t.lot_size ?? t.lot),
            magic_number: t.magic_number,
            opened_at: t.opened_at,
            closed_at: t.closed_at,
            result: t.result,
            raw_payload: t.raw_payload,
          }));

          return json({ ok: true, rows });
        } catch (e: any) {
          return json({ ok: false, error: String(e?.message || e), rows: [] }, 500);
        }
      },
    },
  },
});
