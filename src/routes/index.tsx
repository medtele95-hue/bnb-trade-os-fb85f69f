import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/terminal/TopBar";
import { SafetyStrip } from "@/components/terminal/SafetyStrip";
import { BackendHealthBar } from "@/components/terminal/HealthBar";
import { OverviewTab } from "@/components/terminal/tabs/OverviewTab";
import { LiveMarketsTab } from "@/components/terminal/tabs/LiveMarketsTab";
import { OrderFlowTab } from "@/components/terminal/tabs/OrderFlowTab";
import { StubTab } from "@/components/terminal/tabs/StubTab";
import { T } from "@/components/terminal/primitives";

export const Route = createFileRoute("/")({ component: Terminal });

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "markets", label: "Live Markets" },
  { id: "hunter", label: "Setup Hunter" },
  { id: "strategy", label: "Strategy Engine" },
  { id: "flow", label: "Order Flow" },
  { id: "risk", label: "Risk & PnL" },
  { id: "trades", label: "Trades / Journal" },
  { id: "audit", label: "Audit / Safety" },
  { id: "logs", label: "Logs" },
] as const;

type TabId = typeof TABS[number]["id"];

function Terminal() {
  const [active, setActive] = useState<TabId>("overview");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: T.bg, color: T.txt, fontFamily: "Archivo, sans-serif" }}
    >
      <TopBar />
      <SafetyStrip />
      <BackendHealthBar />

      <nav
        className="px-2 flex flex-wrap items-center gap-1 sticky top-0 z-10"
        style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className="px-3 py-2 text-[10.5px] uppercase tracking-[0.16em] transition-colors"
            style={{
              background: active === t.id ? T.panel : "transparent",
              color: active === t.id ? T.acc : T.dim,
              borderBottom: active === t.id ? `2px solid ${T.acc}` : "2px solid transparent",
              fontWeight: active === t.id ? 700 : 500,
              fontFamily: "Archivo, sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto pr-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>
          <a href="/legacy" style={{ color: T.dim }}>↗ Legacy Dashboard</a>
        </div>
      </nav>

      <main className="flex-1 p-3 overflow-x-hidden">
        {active === "overview" && <OverviewTab />}
        {active === "markets" && <LiveMarketsTab />}
        {active === "flow" && <OrderFlowTab />}
        {active === "hunter" && <StubTab name="Setup Hunter" plan="Per (symbol × strategy) timeline: signal → contract validation → confirmation → SetupHunter → SafetyGuard → DemoRouter. Will bind to bot_logs SETUP_HUNTER_* tokens." />}
        {active === "strategy" && <StubTab name="Strategy Engine" plan="Three sections: ACTIVE_EXECUTION_STRATEGY, CONFIRMATION_MODULE, INTERNAL_DATA_FEED. ORDER_FLOW_READER lives under feed only, EXECUTION_AGENT under active only." />}
        {active === "risk" && <StubTab name="Risk & PnL" plan="MT5 snapshot as PnL source of truth. Equity curve from account_snapshots. BTC concentration card." />}
        {active === "trades" && <StubTab name="Trades / Journal" plan="Open + closed tables. Reconciled rows visually distinct. Filter by symbol/strategy." />}
        {active === "audit" && <StubTab name="Audit / Safety" plan="Immutable safety checklist, route-chain visualization, SAFETY_GUARD log tail." />}
        {active === "logs" && <StubTab name="Logs" plan="bot_logs viewer with token filter chips: CANDIDATE, SETUP_HUNTER, CONFIRMATION, ORDER_FLOW, SAFETY_GUARD, DEMO_ORDER, ERROR, WARNING." />}
      </main>
    </div>
  );
}
