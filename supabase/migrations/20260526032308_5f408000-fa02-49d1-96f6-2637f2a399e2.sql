ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS max_risk_per_trade numeric;
NOTIFY pgrst, 'reload schema';