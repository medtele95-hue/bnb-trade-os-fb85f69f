export const mockMetrics = {
  totalPnl: 794096,
  tradesToday: 47,
  totalTrades: 40266,
  winRate: 67,
  dailyPnl: 312.44,
  averageTicket: 19.72,
  profitFactor: 1.84,
  maxDrawdown: 2.8,
  openPositions: 3,
};

export const mockMarkov = {
  symbol: "BTCUSD",
  timeframe: "5-MIN",
  currentState: "UP",
  predictedState: "UP",
  probability: 0.91,
  signal: "ENTER",
  signals: 14,
  entered: 9,
  skipped: 5,
};

export const mockKelly = {
  formula: "Kelly f* = p − (1−p) / b",
  modelProbability: 0.68,
  rewardRisk: 2.0,
  edge: 13,
  fractionalKelly: 0.25,
  finalRisk: 0.5,
  lotSize: 0.03,
  status: "APPROVED",
};

export const mockDecision = {
  symbol: "BTCUSD",
  timeframe: "M5",
  marketState: "STRONG_UPTREND",
  markovProbability: 0.91,
  strategy: "EMA_PULLBACK",
  signal: "BUY",
  confidence: 74,
  riskStatus: "APPROVED",
  lotSize: 0.03,
  entry: 77860,
  sl: 77450,
  tp: 78600,
  decision: "ENTER",
  reason: "Trend aligned on M15 and H1. M5 pullback confirmed. Spread acceptable.",
  blockedReason: "None",
};

export const mockStrategies = [
  { name: "EMA PULLBACK", status: "ACTIVE", signal: "BUY", confidence: 74, winRate: 65, pnl: 184.20, reason: "M5 pullback confirmed at EMA21" },
  { name: "BREAKOUT RETEST", status: "WAITING", signal: "WAIT", confidence: 58, winRate: 61, pnl: 42.50, reason: "Awaiting retest of 77900 level" },
  { name: "SECOND ENTRY PA", status: "SCANNING", signal: "WAIT", confidence: 52, winRate: 63, pnl: -18.10, reason: "No valid swing high yet" },
  { name: "SCALPING AGENT", status: "ACTIVE", signal: "SKIP", confidence: 44, winRate: 59, pnl: 103.84, reason: "Spread above threshold" },
];

export const mockSkipped = [
  { time: "14:09:12", symbol: "BTCUSD", strategy: "EMA_PULLBACK", reason: "Spread too high" },
  { time: "14:02:48", symbol: "XAUUSD", strategy: "BREAKOUT", reason: "Consolidation" },
  { time: "13:55:01", symbol: "EURUSD", strategy: "SCALPING", reason: "Low confidence" },
  { time: "13:48:30", symbol: "BTCUSD", strategy: "SECOND_ENTRY", reason: "Bad reward/risk" },
  { time: "13:30:14", symbol: "XAUUSD", strategy: "EMA_PULLBACK", reason: "Max open trades reached" },
];

export const mockStack = [
  { name: "CODEX PRO", desc: "Builds and fixes backend logic", uptime: "99.98%", health: "OK", latency: "12ms", status: "ONLINE" },
  { name: "HERMES AGENT", desc: "Markov, Kelly, Self-Learn brain", uptime: "99.92%", health: "OK", latency: "44ms", status: "ONLINE" },
  { name: "WINDOWS RDP", desc: "Runs MT5 and Python bridge 24/7", uptime: "99.81%", health: "OK", latency: "28ms", status: "CONNECTED" },
  { name: "MT5 TERMINAL", desc: "Reads market data and existing robots", uptime: "99.74%", health: "OK", latency: "9ms", status: "CONNECTED" },
  { name: "TELEGRAM BOT", desc: "Sends alerts and nightly reports", uptime: "100.00%", health: "OK", latency: "118ms", status: "ONLINE" },
];

export const mockRobots = [
  { id: "ROBOT 1", magic: 1001, status: "RUNNING", symbol: "XAUUSD", trades: 1, pnl: 42.10 },
  { id: "ROBOT 2", magic: 1002, status: "RUNNING", symbol: "BTCUSD", trades: 2, pnl: 118.40 },
  { id: "ROBOT 3", magic: 1003, status: "RUNNING", symbol: "EURUSD", trades: 0, pnl: -12.30 },
];

export const mockJournal = [
  { time: "14:11:20", magic: 1002, symbol: "BTCUSD", dir: "BUY", entry: 77860, sl: 77450, tp: 78600, lot: 0.03, pnl: 47, result: "WIN", strategy: "EMA_PULLBACK", confidence: 74, reason: "Trend aligned" },
  { time: "14:02:11", magic: 1001, symbol: "XAUUSD", dir: "SELL", entry: 2384.5, sl: 2390.0, tp: 2374.0, lot: 0.02, pnl: 31, result: "WIN", strategy: "BREAKOUT", confidence: 68, reason: "Resistance rejection" },
  { time: "13:48:55", magic: 1003, symbol: "EURUSD", dir: "BUY", entry: 1.0842, sl: 1.0825, tp: 1.0875, lot: 0.05, pnl: -12, result: "LOSS", strategy: "SECOND_ENTRY", confidence: 55, reason: "Failed continuation" },
  { time: "13:30:08", magic: 1002, symbol: "BTCUSD", dir: "BUY", entry: 77640, sl: 77400, tp: 78100, lot: 0.03, pnl: 62, result: "WIN", strategy: "EMA_PULLBACK", confidence: 71, reason: "Higher TF aligned" },
  { time: "12:55:42", magic: 1001, symbol: "XAUUSD", dir: "BUY", entry: 2378.0, sl: 2372.0, tp: 2388.0, lot: 0.02, pnl: 18, result: "WIN", strategy: "SCALPING", confidence: 61, reason: "Momentum spike" },
  { time: "12:10:19", magic: 1003, symbol: "EURUSD", dir: "SELL", entry: 1.0861, sl: 1.0878, tp: 1.0834, lot: 0.04, pnl: 28, result: "WIN", strategy: "BREAKOUT", confidence: 66, reason: "Support break" },
  { time: "11:42:01", magic: 1002, symbol: "BTCUSD", dir: "SELL", entry: 77920, sl: 78150, tp: 77500, lot: 0.03, pnl: -18, result: "LOSS", strategy: "SCALPING", confidence: 48, reason: "Whipsaw" },
];

export const mockLogs = [
  "[14:11:02] MT5 connected",
  "[14:11:04] Existing robots detected",
  "[14:11:07] Robot magic 1001 synced",
  "[14:11:08] BTCUSD M5 candles loaded",
  "[14:11:10] Markov state: UP",
  "[14:11:12] Kelly risk approved",
  "[14:11:15] Signal skipped: spread too high",
  "[14:11:20] Dashboard updated",
  "[14:11:24] Telegram alert dispatched",
  "[14:11:31] Robot magic 1002 opened BUY 0.03 @ 77860",
  "[14:11:42] Heartbeat OK :: RDP=CONNECTED MT5=CONNECTED",
];

// Mock OHLC candles for BTCUSD M5
export const mockCandles = (() => {
  const candles: { o: number; h: number; l: number; c: number }[] = [];
  let price = 77400;
  for (let i = 0; i < 60; i++) {
    const o = price;
    const move = (Math.sin(i / 4) + (Math.random() - 0.45)) * 90;
    const c = o + move;
    const h = Math.max(o, c) + Math.random() * 40;
    const l = Math.min(o, c) - Math.random() * 40;
    candles.push({ o, h, l, c });
    price = c;
  }
  return candles;
})();
