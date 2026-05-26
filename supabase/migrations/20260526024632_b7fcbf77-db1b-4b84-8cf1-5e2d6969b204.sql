CREATE OR REPLACE FUNCTION public.hermes_table_columns(_table_name text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(array_agg(c.column_name::text ORDER BY c.ordinal_position), ARRAY[]::text[])
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'public'
    AND c.table_name = _table_name
    AND _table_name = ANY (ARRAY[
      'bot_status',
      'hermes_agents',
      'account_snapshots',
      'market_candles',
      'market_states',
      'markov_predictions',
      'kelly_risk',
      'strategy_signals',
      'ai_decisions',
      'execution_events',
      'trades',
      'bot_logs',
      'nightly_reports',
      'settings'
    ]::text[]);
$$;

NOTIFY pgrst, 'reload schema';