export function Waiting({ label = "WAITING FOR HERMES LIVE DATA" }: { label?: string }) {
  return (
    <div className="border border-dashed border-black/60 p-3 text-center text-[10px] uppercase tracking-[0.25em] font-bold">
      <span className="opacity-70">::</span> {label} <span className="blink">_</span>
    </div>
  );
}
