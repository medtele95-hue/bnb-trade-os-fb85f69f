import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/terminal/TopBar";
import { SafetyStrip } from "@/components/terminal/SafetyStrip";
import { BackendHealthBar } from "@/components/terminal/HealthBar";
import { OverviewTab } from "@/components/terminal/tabs/OverviewTab";
import { LiveMarketsTab } from "@/components/terminal/tabs/LiveMarketsTab";
import { OrderFlowTab } from "@/components/terminal/tabs/OrderFlowTab";
import { SetupHunterTab } from "@/components/terminal/tabs/SetupHunterTab";
import { StrategyEngineTab } from "@/components/terminal/tabs/StrategyEngineTab";
import { RiskPnlTab } from "@/components/terminal/tabs/RiskPnlTab";
import { TradesTab } from "@/components/terminal/tabs/TradesTab";
import { AuditTab } from "@/components/terminal/tabs/AuditTab";
import { LogsTab } from "@/components/terminal/tabs/LogsTab";
import { T } from "@/components/terminal/primitives";
import { ReconnectIndicator } from "@/components/terminal/ReconnectIndicator";

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
        <div className="ml-auto pr-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em]" style={{ color: T.dim }}>
          <ReconnectIndicator />
          <a href="/quad-terminal" style={{ color: T.acc }}>↗ Quad Terminal</a>
          <a href="/legacy" style={{ color: T.dim }}>↗ Legacy Dashboard</a>
        </div>
      </nav>

      <main className="flex-1 p-3 overflow-x-hidden">
        {active === "overview" && <OverviewTab />}
        {active === "markets" && <LiveMarketsTab />}
        {active === "flow" && <OrderFlowTab />}
        {active === "hunter" && <SetupHunterTab />}
        {active === "strategy" && <StrategyEngineTab />}
        {active === "risk" && <RiskPnlTab />}
        {active === "trades" && <TradesTab />}
        {active === "audit" && <AuditTab />}
        {active === "logs" && <LogsTab />}
      </main>
    </div>
  );
}
