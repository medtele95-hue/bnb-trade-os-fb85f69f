ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_time timestamptz NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.ai_decisions
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.bot_logs
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.bot_status
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS symbols jsonb NULL;

ALTER TABLE public.bot_status
  ALTER COLUMN component SET DEFAULT 'hermes_core',
  ALTER COLUMN component SET NOT NULL;

ALTER TABLE public.execution_events
  ADD COLUMN IF NOT EXISTS magic_number bigint NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.hermes_agents
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS symbols jsonb NULL;

ALTER TABLE public.kelly_risk
  ADD COLUMN IF NOT EXISTS fractional_kelly numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.market_candles
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.market_states
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.markov_predictions
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.markov_predictions
  ALTER COLUMN predicted_state DROP NOT NULL,
  ALTER COLUMN predicted_state SET DEFAULT 'UNKNOWN';

ALTER TABLE public.nightly_reports
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.strategy_signals
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS signal text NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

CREATE UNIQUE INDEX IF NOT EXISTS market_candles_symbol_timeframe_candle_time_key
  ON public.market_candles (symbol, timeframe, candle_time);

NOTIFY pgrst, 'reload schema';