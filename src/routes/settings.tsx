import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KV } from "@/components/dashboard/Panel";
import { Clock } from "@/components/dashboard/Clock";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const fields: { k: string; v: string; lock?: boolean }[] = [
    { k: "Supabase Status", v: "MOCK (not connected)" },
    { k: "RDP Status", v: "CONNECTED" },
    { k: "MT5 Status", v: "CONNECTED" },
    { k: "Telegram Enabled", v: "TRUE" },
    { k: "Allowed Symbols", v: "BTCUSD, XAUUSD, EURUSD" },
    { k: "Markov Threshold", v: "p ≥ 0.65" },
    { k: "Kelly Max Risk", v: "0.5% per trade" },
    { k: "Max Daily Loss", v: "−3.0%" },
    { k: "Read-Only Mode", v: "LOCKED", lock: true },
  ];

  return (
    <div className="min-h-screen p-3 max-w-[1100px] mx-auto">
      <header className="panel border-b-2">
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-6 border-r border-black p-3">
            <div className="text-[22px] font-black tracking-tight leading-none">
              MT5 × HERMES — SETTINGS
            </div>
            <div className="text-[10px] mt-1.5 uppercase tracking-wider opacity-80">
              SYSTEM CONFIGURATION · READ-ONLY POLICY
            </div>
          </div>
          <div className="col-span-6 p-3 text-[10px] uppercase tracking-wider flex items-center justify-end gap-4">
            <span>TIME</span>
            <Clock />
          </div>
        </div>
        <nav className="border-t border-black flex text-[10px] uppercase tracking-widest">
          <Link to="/" className="px-3 py-1.5 border-r border-black hover:bg-foreground hover:text-background">
            Command Center
          </Link>
          <Link
            to="/settings"
            className="px-3 py-1.5 border-r border-black bg-foreground text-background"
          >
            Settings
          </Link>
        </nav>
      </header>

      <div className="grid grid-cols-12 gap-3 mt-3">
        <div className="col-span-7">
          <Panel title="SYSTEM CONFIGURATION">
            <div className="space-y-1">
              {fields.map((f) => (
                <div
                  key={f.k}
                  className="grid grid-cols-12 gap-2 items-center border border-black px-2 py-1.5"
                >
                  <div className="col-span-5 text-[11px] uppercase tracking-widest">{f.k}</div>
                  <div className="col-span-6 pixel text-[13px]">{f.v}</div>
                  <div className="col-span-1 text-right">
                    <span className="text-[9px] border border-black px-1">
                      {f.lock ? "LOCKED" : "OK"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col-span-5 space-y-3">
          <Panel title="CONNECTIONS">
            <KV k="Supabase" v="MOCK" />
            <KV k="RDP" v="CONNECTED" accent="profit" />
            <KV k="MT5 Bridge" v="CONNECTED" accent="profit" />
            <KV k="Telegram Bot" v="ONLINE" accent="profit" />
            <KV k="Webhook" v="HEALTHY" />
          </Panel>

          <Panel title="POLICY">
            <div className="text-[11px] leading-snug">
              The dashboard operates in <b>READ-ONLY</b> mode. It monitors MT5 over the Python
              bridge running on Windows RDP. Trade execution, modification, and closure are
              <b> never</b> performed from this terminal.
            </div>
            <div className="mt-2 border border-dashed border-black/60 p-2 text-[10px] uppercase tracking-widest text-center">
              ⚠ READ-ONLY MODE IS LOCKED
            </div>
          </Panel>

          <Panel title="DANGER ZONE">
            <button className="w-full border border-black py-2 text-[11px] tracking-widest font-bold uppercase bg-background hover:bg-foreground hover:text-background">
              REQUEST WRITE ACCESS (DISABLED)
            </button>
          </Panel>
        </div>
      </div>

      <footer className="mt-4 border-t border-black pt-2 text-[10px] uppercase tracking-widest flex justify-between opacity-80">
        <div>HERMES TRADING TERMINAL · BUILD 0.1.0 · MOCK DATA MODE</div>
        <div>© {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
