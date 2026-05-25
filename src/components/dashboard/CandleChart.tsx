import { mockCandles } from "@/lib/mock-data";

export function CandleChart() {
  const candles = mockCandles;
  const w = 900;
  const h = 280;
  const padL = 50;
  const padR = 60;
  const padT = 12;
  const padB = 20;
  const cw = (w - padL - padR) / candles.length;
  const allHigh = Math.max(...candles.map((c) => c.h));
  const allLow = Math.min(...candles.map((c) => c.l));
  const range = allHigh - allLow;
  const y = (p: number) => padT + ((allHigh - p) / range) * (h - padT - padB);

  const entry = 77860;
  const sl = 77450;
  const tp = 78600;
  const support = allLow + range * 0.15;
  const resistance = allLow + range * 0.85;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full tick" preserveAspectRatio="none">
      {/* Horizontal lines */}
      {[
        { p: support, label: "SUPPORT" },
        { p: resistance, label: "RESISTANCE" },
        { p: entry, label: "ENTRY 77860", dash: "4 2" },
        { p: sl, label: "SL 77450", dash: "2 2" },
        { p: tp, label: "TP 78600", dash: "2 2" },
      ].map((l, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={w - padR}
            y1={y(l.p)}
            y2={y(l.p)}
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray={l.dash || "6 4"}
          />
          <text
            x={w - padR + 4}
            y={y(l.p) + 3}
            fontSize="9"
            fill="currentColor"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = padL + i * cw + cw / 2;
        const up = c.c >= c.o;
        const top = y(Math.max(c.o, c.c));
        const bot = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke="black" strokeWidth="0.7" />
            <rect
              x={x - cw / 2.6}
              y={top}
              width={cw / 1.3}
              height={Math.max(1, bot - top)}
              fill={up ? "white" : "black"}
              stroke="black"
              strokeWidth="0.7"
            />
          </g>
        );
      })}

      {/* Trade annotation */}
      <g>
        <circle cx={padL + cw * 40} cy={y(entry)} r="4" fill="black" />
        <text x={padL + cw * 40 + 8} y={y(entry) - 6} fontSize="9" fontFamily="monospace">
          ENTER · FILLED · +$47
        </text>
        <text x={padL + cw * 55} y={y(entry) - 18} fontSize="9" fontFamily="monospace">
          EXIT
        </text>
        <line
          x1={padL + cw * 40}
          x2={padL + cw * 55}
          y1={y(entry)}
          y2={y(entry) - 12}
          stroke="black"
          strokeWidth="0.7"
          strokeDasharray="2 2"
        />
      </g>
    </svg>
  );
}
