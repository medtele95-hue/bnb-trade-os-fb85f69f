import { Panel, StatePanel, T } from "../primitives";

export function StubTab({ name, plan }: { name: string; plan: string }) {
  return (
    <Panel title={name}>
      <StatePanel
        state="DEGRADED"
        message="TAB SCAFFOLDED — STAGE 2"
        hint={plan}
      />
      <div className="mt-3 text-[10.5px]" style={{ color: T.dim }}>
        Reachable in Stage 2. The current Stage 1 build ships the shell, dual health, Overview, Live Markets, and Order Flow.
        The previous dashboard is fully available at <a href="/legacy" style={{ color: T.acc }}>/legacy</a>.
      </div>
    </Panel>
  );
}
