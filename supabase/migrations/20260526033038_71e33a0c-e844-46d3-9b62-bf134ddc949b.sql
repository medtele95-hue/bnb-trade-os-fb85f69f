ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS open_hermes_trades integer;
NOTIFY pgrst, 'reload schema';