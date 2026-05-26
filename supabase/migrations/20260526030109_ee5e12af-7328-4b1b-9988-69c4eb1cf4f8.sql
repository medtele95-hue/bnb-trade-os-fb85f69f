ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS max_daily_loss numeric;
NOTIFY pgrst, 'reload schema';