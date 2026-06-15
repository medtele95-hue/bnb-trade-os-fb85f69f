DROP POLICY IF EXISTS "public read account_snapshots" ON public.account_snapshots;

REVOKE SELECT ON public.account_snapshots FROM anon;

CREATE POLICY "authenticated read account_snapshots"
  ON public.account_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);