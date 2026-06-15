import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { T } from "@/components/terminal/primitives";

export const Route = createFileRoute("/export")({ component: ExportPage });

type TableKey =
  | "trades"
  | "ai_decisions"
  | "execution_events"
  | "strategy_signals"
  | "bot_logs";

const TABLES: { key: TableKey; label: string; orderCol: string }[] = [
  { key: "trades", label: "Trades / Journal", orderCol: "created_at" },
  { key: "ai_decisions", label: "AI Decisions", orderCol: "created_at" },
  { key: "execution_events", label: "Execution Events (paper/demo)", orderCol: "created_at" },
  { key: "strategy_signals", label: "Strategy Signals / Setup History", orderCol: "created_at" },
  { key: "bot_logs", label: "Bot Logs", orderCol: "created_at" },
];

const PAGE = 1000;

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set())
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchAll(
  table: TableKey,
  orderCol: string,
  onProgress: (n: number) => void
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  // Paginate by range until we get a short page.
  // Order desc so newest first.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    onProgress(all.length);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

type RowState = {
  status: "idle" | "loading" | "done" | "error";
  count: number;
  error?: string;
};

function ExportPage() {
  const [state, setState] = useState<Record<TableKey, RowState>>(
    () =>
      Object.fromEntries(
        TABLES.map((t) => [t.key, { status: "idle", count: 0 }])
      ) as Record<TableKey, RowState>
  );

  const run = async (
    key: TableKey,
    orderCol: string,
    format: "csv" | "json"
  ) => {
    setState((s) => ({ ...s, [key]: { status: "loading", count: 0 } }));
    try {
      const rows = await fetchAll(key, orderCol, (n) =>
        setState((s) => ({ ...s, [key]: { status: "loading", count: n } }))
      );
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (format === "csv") {
        download(`${key}_${stamp}.csv`, toCSV(rows), "text/csv");
      } else {
        download(
          `${key}_${stamp}.json`,
          JSON.stringify(rows, null, 2),
          "application/json"
        );
      }
      setState((s) => ({ ...s, [key]: { status: "done", count: rows.length } }));
    } catch (e) {
      setState((s) => ({
        ...s,
        [key]: {
          status: "error",
          count: 0,
          error: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: T.bg, color: T.txt, fontFamily: "Archivo, sans-serif" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg uppercase tracking-[0.16em]" style={{ color: T.acc }}>
            HERMES Journal Export
          </h1>
          <a href="/" className="text-[11px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>
            ← Back
          </a>
        </div>

        <p className="text-[11px] mb-6" style={{ color: T.dim }}>
          Read-only export of historical journal tables. Large tables paginate in
          batches of {PAGE}. Strategy signals can take a minute.
        </p>

        <div className="flex flex-col gap-3">
          {TABLES.map((t) => {
            const st = state[t.key];
            const busy = st.status === "loading";
            return (
              <div
                key={t.key}
                className="p-4 border"
                style={{ borderColor: T.border, background: T.panel }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[12px] uppercase tracking-[0.12em]">
                      {t.label}
                    </div>
                    <div className="text-[10px] tabular-nums" style={{ color: T.dim }}>
                      {t.key}
                    </div>
                  </div>
                  <div className="text-[10px] tabular-nums" style={{ color: T.dim }}>
                    {st.status === "loading" && `loading… ${st.count.toLocaleString()} rows`}
                    {st.status === "done" && `done — ${st.count.toLocaleString()} rows`}
                    {st.status === "error" && (
                      <span style={{ color: "#f87171" }}>error: {st.error}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => run(t.key, t.orderCol, "csv")}
                    className="px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border"
                    style={{
                      borderColor: T.border,
                      background: busy ? T.panel : T.bg,
                      color: busy ? T.dim : T.acc,
                      cursor: busy ? "wait" : "pointer",
                    }}
                  >
                    ↓ CSV
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => run(t.key, t.orderCol, "json")}
                    className="px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border"
                    style={{
                      borderColor: T.border,
                      background: busy ? T.panel : T.bg,
                      color: busy ? T.dim : T.txt,
                      cursor: busy ? "wait" : "pointer",
                    }}
                  >
                    ↓ JSON
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
