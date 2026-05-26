ALTER TABLE public.hermes_agents ADD COLUMN IF NOT EXISTS active_symbol text;
ALTER TABLE public.hermes_agents ADD COLUMN IF NOT EXISTS last_update timestamptz;
ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS max_drawdown numeric;
NOTIFY pgrst, 'reload schema';