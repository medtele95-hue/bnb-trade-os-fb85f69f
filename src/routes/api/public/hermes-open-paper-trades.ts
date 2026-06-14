import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type TradeRow = Database["public"]["Tables"]["trades"]["Row"];
type RawPayloadObj = Record<string, unknown>;

const QuerySchema = z.object({
  magic_number: z.coerce.number().int().positive().default(909001),
});

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

function asRawPayload(v: unknown): RawPayloadObj {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as RawPayloadObj;
}

function getMode(t: TradeRow): string {
  const rp = asRawPayload(t.raw_payload);
  const inner = asRawPayload(rp.raw_payload);
  return String(rp.mode ?? inner.mode ?? (t as unknown as RawPayloadObj).mode ?? "").toUpperCase();
}

function getStatus(t: TradeRow): string {
  const rp = asRawPayload(t.raw_payload);
  const inner = asRawPayload(rp.raw_payload);
  return String(rp.status ?? inner.status ?? "").toUpperCase();
}

function getDir(t: TradeRow): string {
  const rp = asRawPayload(t.raw_payload);
  return String(t.dir ?? rp.dir ?? rp.direction ?? "").toUpperCase();
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export const Route = createFileRoute("/api/public/hermes-open-paper-trades")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const qParsed = QuerySchema.safeParse({
            magic_number: url.searchParams.get("magic_number") ?? "909001",
          });
          const magic = qParsed.success ? qParsed.data.magic_number : 909001;

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

          const rows = (data ?? [])
            .filter((t: TradeRow) => {
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
            })
            .map((t: TradeRow) => ({
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
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return json({ ok: false, error: msg, rows: [] }, 500);
        }
      },
    },
  },
});
