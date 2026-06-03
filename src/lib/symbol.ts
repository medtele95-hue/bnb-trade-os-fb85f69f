// Symbol display normalization helpers.
// Backend keeps raw symbol + broker_symbol. UI should display broker_symbol
// when present, with broker suffixes stripped for readability.
//
// Treats these as the same instrument for display:
//   GOLD ≡ GOLD# ≡ XAUUSD
//   BTCUSD ≡ BTCUSD#
//
// Always prefer broker_symbol when supplied (matches what MT5/XM shows).

const ALIASES: Record<string, string> = {
  XAUUSD: "GOLD",
  "XAUUSD#": "GOLD",
  "GOLD#": "GOLD",
  GOLD: "GOLD",
  "BTCUSD#": "BTCUSD",
  BTCUSD: "BTCUSD",
};

export function stripBrokerSuffix(s: string): string {
  return s.endsWith("#") ? s.slice(0, -1) : s;
}

/** Returns the canonical display label for a symbol. */
export function normalizeSymbol(rawSymbol?: string | null, brokerSymbol?: string | null): string {
  const src = (brokerSymbol ?? rawSymbol ?? "").toString().trim();
  if (!src) return "—";
  const upper = src.toUpperCase();
  if (ALIASES[upper]) return ALIASES[upper];
  return stripBrokerSuffix(upper);
}

/** Same instrument regardless of suffix / alias. */
export function isSameSymbol(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeSymbol(a) === normalizeSymbol(b);
}
