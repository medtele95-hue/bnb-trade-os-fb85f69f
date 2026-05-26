CREATE UNIQUE INDEX IF NOT EXISTS bot_status_component_key
  ON public.bot_status (component);

CREATE UNIQUE INDEX IF NOT EXISTS hermes_agents_name_key
  ON public.hermes_agents (name);

NOTIFY pgrst, 'reload schema';