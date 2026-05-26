ALTER TABLE public.bot_status
  ADD COLUMN IF NOT EXISTS component text NOT NULL DEFAULT 'hermes_core',
  ADD COLUMN IF NOT EXISTS symbols jsonb NULL;

ALTER TABLE public.hermes_agents
  ADD COLUMN IF NOT EXISTS symbols jsonb NULL;

ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS server text NULL;

ALTER TABLE public.markov_predictions
  ADD COLUMN IF NOT EXISTS transition_count integer NULL;

ALTER TABLE public.kelly_risk
  ADD COLUMN IF NOT EXISTS drawdown_pct numeric NULL;

ALTER TABLE public.execution_events
  ADD COLUMN IF NOT EXISTS event_type text NULL;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS magic_number bigint NULL;

CREATE UNIQUE INDEX IF NOT EXISTS market_candles_symbol_timeframe_candle_time_key
  ON public.market_candles (symbol, timeframe, candle_time);

NOTIFY pgrst, 'reload schema';