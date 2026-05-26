ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS spread numeric;
ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS timeframe text;
NOTIFY pgrst, 'reload schema';