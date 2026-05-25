CREATE TABLE public.market_candles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  candle_time timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  tick_volume bigint,
  spread integer,
  UNIQUE (symbol, timeframe, candle_time)
);

CREATE INDEX idx_market_candles_lookup
  ON public.market_candles (symbol, timeframe, candle_time DESC);

ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read market_candles"
  ON public.market_candles
  FOR SELECT
  USING (true);

ALTER TABLE public.market_candles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_candles;