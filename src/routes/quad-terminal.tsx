import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/terminal/TopBar";
import { SafetyStrip } from "@/components/terminal/SafetyStrip";
import { BackendHealthBar } from "@/components/terminal/HealthBar";
import { T } from "@/components/terminal/primitives";
import { SymbolCard } from "@/components/terminal/quad/SymbolCard";

export const Route = createFileRoute("/quad-terminal")({ component: QuadTerminal });

const SYMBOLS = ["BTCUSD#", "GOLD#", "EURUSD", "US100Cash#"] as const;

function QuadTerminal() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: T.bg, color: T.txt, fontFamily: "Archivo, sans-serif" }}
    >
      <TopBar />
      <SafetyStrip />
      <BackendHealthBar />

      <nav
        className="px-3 py-2 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}
      >
        <a
          href="/"
          className="text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: T.dim }}
        >
          ← Terminal
        </a>
        <span
          className="text-[11px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: T.acc }}
        >
          Quad Terminal · Multi-Chart
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>
          READ-ONLY · 4 SYMBOLS
        </span>
      </nav>

      <main className="flex-1 p-3 overflow-x-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {SYMBOLS.map((s) => (
            <SymbolCard key={s} broker={s} />
          ))}
        </div>
      </main>
    </div>
  );
}
