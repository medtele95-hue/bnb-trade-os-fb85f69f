ALTER TABLE public.bot_status
  ADD COLUMN IF NOT EXISTS read_only boolean,
  ADD COLUMN IF NOT EXISTS paper_trading boolean;

ALTER TABLE public.hermes_agents
  ADD COLUMN IF NOT EXISTS symbols jsonb;

ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS profit numeric;

ALTER TABLE public.market_states
  ADD COLUMN IF NOT EXISTS session text;

ALTER TABLE public.markov_predictions
  ADD COLUMN IF NOT EXISTS predicted_next_state text;

ALTER TABLE public.strategy_signals
  ADD COLUMN IF NOT EXISTS timeframe text;

ALTER TABLE public.kelly_risk
  ADD COLUMN IF NOT EXISTS daily_loss_pct numeric;

ALTER TABLE public.execution_events
  ADD COLUMN IF NOT EXISTS decision text;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS lot_size numeric;

NOTIFY pgrst, 'reload schema';