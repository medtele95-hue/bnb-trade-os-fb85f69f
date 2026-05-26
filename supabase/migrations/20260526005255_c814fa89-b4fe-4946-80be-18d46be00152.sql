ALTER TABLE public.bot_status
  ADD COLUMN IF NOT EXISTS magic_number bigint,
  ADD COLUMN IF NOT EXISTS demo_trading boolean;

ALTER TABLE public.hermes_agents
  ADD COLUMN IF NOT EXISTS magic_number bigint;

ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS login bigint;

NOTIFY pgrst, 'reload schema';