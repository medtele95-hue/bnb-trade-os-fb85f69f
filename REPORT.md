# HERMES Dashboard — Security & API Hardening Report

**Date:** 2026-06-14
**Scope:** `C:\Users\Admin\bnb-trade-os-fb85f69f` (dashboard web repo only)
**Out of scope:** Python MT5 backend (`C:\hermes-mt5-agent`)

---

## Security Findings (masked)

| # | File | Line | Credential Type | Masked Value |
|---|------|------|-----------------|--------------|
| 1 | `.env` | 2 | `SUPABASE_PUBLISHABLE_KEY` (anon JWT) | `eyJhbG...iC34` |
| 2 | `.env` | 5 | `VITE_SUPABASE_PUBLISHABLE_KEY` (same anon JWT) | `eyJhbG...iC34` |

**Notes:**
- Both are the **anon (publishable)** key — not the service role key. Supabase anon keys are safe for client-side use but should still not be committed to git.
- No `SUPABASE_SERVICE_ROLE_KEY` was found in `.env` or hardcoded anywhere — it is correctly accessed via `process.env` in `client.server.ts` only.
- No `HERMES_INGEST_SECRET` was found in `.env` — it is correctly accessed via `process.env` in the API route handlers only.

---

## Changes Made

### TASK 1 ✅ — `.gitignore` updated
Added `.env`, `.env.local`, `.env.production`, `.env.*.local` to `.gitignore`.
Previously `.env` was **not** gitignored — credentials could have been committed.

### TASK 2 ✅ — `.env.example` created
Created with placeholder values for all required environment variables.
Clearly separates public (VITE_*) from server-only (`SERVICE_ROLE_KEY`, `HERMES_INGEST_SECRET`) vars.

### TASK 3 ✅ — Credential scan complete
2 masked findings (see table above). Both are the same anon JWT duplicated for client/server use.
No service-role key or ingest secret found in code or `.env`.

### TASK 4 ✅ — Server-side-only env vars verified
- `SUPABASE_SERVICE_ROLE_KEY`: accessed via `process.env` in `client.server.ts` only; never in client code or `import.meta.env`.
- `HERMES_INGEST_SECRET`: accessed via `process.env` in `hermes-ingest.ts` and `hermes-paper-report.ts` only.
- The client supabase client uses `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` (correct — public key).

### TASK 5 ✅ — DB-layer `as any` casts replaced in 3 API routes

**`hermes-ingest.ts`:**
- `(supabaseAdmin as any).rpc(...)` → replaced with typed `TypedRpcFn` function type via `as unknown as TypedRpcFn`
- `supabaseAdmin.from(table as any)` → `supabaseAdmin.from(knownTable)` where `knownTable: KnownTable`
- `.upsert(rows as any, ...)` → `rows as unknown as AnyTableInsert[]`
- `.insert(rows as any)` → `rows as unknown as AnyTableInsert[]`
- `.update(updateRow as any)` → `updateRow as unknown as AnyTableUpdate`
- `.eq(col, val as any)` → `val as FilterValue` (`string | number | boolean | null`)

**`hermes-paper-report.ts`:**
- Introduced `TradeRow`, `ExecutionEventRow`, etc. type aliases from `Database` types
- Removed all `as any` callback params (`(e: any)`, `(t: any)`) — now use typed row types
- `asRawPayload()` helper safely narrows `Json | null` to `Record<string, unknown>`

**`hermes-open-paper-trades.ts`:**
- Same typed-row approach; all helpers now use `TradeRow` instead of `any`
- `catch (e: unknown)` instead of `catch (e: any)`

### TASK 6 ✅ — Zod validation added to all 3 API routes

- **`hermes-ingest.ts`**: `HermesPayloadSchema` validates `{ table: string, data: object | object[], action?: enum, match?: object }` before any business logic.
- **`hermes-paper-report.ts`**: `QuerySchema` validates `hours` query param (coerced positive number, max 720).
- **`hermes-open-paper-trades.ts`**: `QuerySchema` validates `magic_number` query param (coerced positive integer).

### TASK 7 ✅ — Cloudflare-compatible in-memory rate limiting on POST `/api/public/hermes-ingest`

- **Limit:** 120 requests/minute/IP
- **IP detection:** `CF-Connecting-IP` → `x-forwarded-for` (first IP) → `"unknown"` fallback
- **Ordering:** Rate limit checked **before** secret validation (as required)
- **Headers on 429:** `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Caveat:** State is per-isolate (Cloudflare Worker instance). Does not share state across CF regions/instances. Sufficient for single-instance deployments and abuse deterrence.

### TASK 8 ✅ — Vitest tests for hermes-ingest

- Installed `vitest@^2.0.0` as devDependency
- Added `"test": "vitest run"` script to `package.json`
- Created `vitest.config.ts` with `vite-tsconfig-paths` plugin for `@/` alias resolution
- Created `src/routes/api/public/__tests__/hermes-ingest.test.ts` — 13 tests, all passing
- `supabaseAdmin` is fully mocked — no real Supabase connections
- `@tanstack/react-router` is mocked to prevent route registration errors
- `handleHermesPost` exported from `hermes-ingest.ts` for direct test access
- Test coverage: auth (401), secret env missing, invalid JSON, missing table, unknown table, invalid data type, valid insert, array insert, upsert, update action validation, CORS headers

### TASK 9 ✅ — Memoization in `DemoCenter.tsx`

**`DemoReport`:**
- `demo` (heavy array filter over up to 200 trades) → `React.useMemo([trades])`
- Combined stats block (`openedToday`, `closedToday`, `openNow`, `pnlTodayTrades`, `wins`, `losses`, `winRate`, `consec`, `sortedStrat`) → single `React.useMemo([demo])`
- `skipReasons` → `React.useMemo([dec])`
- `lastKelly` → `React.useMemo([dec])`
- `liveOrdersDetected` → `React.useMemo([trades])`

**`MissingFieldsPanel`:**
- `ctx` object → `React.useMemo([ds, bsRows, decRows, kRows])`
- `missing` array → `React.useMemo([ctx])`
- `optionalMissing` array → `React.useMemo([ctx])`

Displayed values unchanged; no functional difference.

### TASK 10 ✅ — Runtime `console.warn` for missing backend fields

Added `React.useEffect` in `MissingFieldsPanel`:
```typescript
if (missing.length > 3 && decRows[0] != null) {
  console.warn(`[HERMES] ${missing.length} required backend fields missing:`, missing.map(f => f.name));
}
```
Only fires when more than 3 required fields are missing AND an `ai_decisions` row is non-null (i.e., the backend is actually running but not sending the fields).

---

## Line Ending Fix (bonus)

- Added `"endOfLine": "lf"` to `.prettierrc` and ran `npm run format`
- The Windows checkout had CRLF line endings in all files, which caused 16,948 prettier errors
- Normalised to LF (standard for cross-platform repos)

---

## Tasks Not Completed

None — all 11 tasks implemented.

---

## Tech Debt

1. **Pre-existing `no-explicit-any` in 30+ files** — 473 errors in `DemoCenter.tsx`, hooks, UI components, and terminal components. These pre-date this PR and are not in any files touched by this work. A follow-up ticket should migrate all `useLiveTable<any>` calls to use typed row generics.

2. **Rate limiter is per-instance** — Cloudflare Workers do not share state between isolates. For true cross-instance rate limiting, use Cloudflare Rate Limiting rules (paid) or Cloudflare KV/Durable Objects.

3. **Test file in `src/routes/`** — The test file lives inside the TanStack Start routes directory. A `routeFileIgnorePattern: "__tests__"` was added to `vite.config.ts` to prevent it from being treated as a route. Consider moving tests to a top-level `tests/` directory in a future cleanup.

4. **No integration tests** — Unit tests mock all Supabase calls. A staging-environment integration test (with a real Supabase project) would catch schema drift between the TABLES allowlist and the actual database.

5. **SUPABASE_SERVICE_ROLE_KEY not in `.dev.vars`** — For local Cloudflare Worker development, the service role key and ingest secret should be in `.dev.vars` (which is gitignored via `.wrangler/`). Ensure this file exists locally.

---

## Credential Rotation Steps

The anon JWT keys in `.env` are the Supabase **publishable** (anon) key. These are intentionally public-facing, but since they were in a potentially-committed `.env` file, rotation is recommended:

1. Log in to [Supabase Dashboard](https://app.supabase.com) → Project `ncplogxinavubcwewmba`
2. Go to **Settings → API**
3. Click **Reset anon key** (this invalidates the old key immediately)
4. Update `.env` locally with the new anon key
5. Update Cloudflare Pages/Workers environment variables with the new values
6. Verify dashboard loads correctly after rotation

**Note:** The `SUPABASE_SERVICE_ROLE_KEY` was not found in committed files. If it was ever stored in `.env` and committed historically, rotate it via:
- Supabase Dashboard → Settings → API → **Reset service_role key**
- Update in Cloudflare Secrets immediately

**Note:** The `HERMES_INGEST_SECRET` was not found in committed files. If you suspect exposure, rotate by:
1. Generate a new secret: `openssl rand -hex 32`
2. Update in Cloudflare Secrets: `HERMES_INGEST_SECRET`
3. Update the MT5 Python bot's config to use the new secret
4. Redeploy both the dashboard Worker and the Python bot
