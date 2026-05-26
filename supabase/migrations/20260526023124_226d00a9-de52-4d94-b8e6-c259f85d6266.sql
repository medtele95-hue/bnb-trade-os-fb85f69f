ALTER TABLE public.bot_status
  ALTER COLUMN component SET DEFAULT 'hermes_core',
  ALTER COLUMN component SET NOT NULL;

UPDATE public.bot_status
SET component = 'hermes_core'
WHERE component IS NULL;

NOTIFY pgrst, 'reload schema';