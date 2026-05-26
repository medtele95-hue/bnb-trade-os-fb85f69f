REVOKE ALL ON FUNCTION public.hermes_table_columns(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hermes_table_columns(text) FROM anon;
REVOKE ALL ON FUNCTION public.hermes_table_columns(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_table_columns(text) TO service_role;

NOTIFY pgrst, 'reload schema';