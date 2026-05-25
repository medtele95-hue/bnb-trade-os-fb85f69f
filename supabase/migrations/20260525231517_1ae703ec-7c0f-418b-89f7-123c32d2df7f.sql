
-- Hermes AI Trading Agent schema

create table public.hermes_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text,
  status text,
  symbol text,
  timeframe text,
  latest_signal text,
  confidence numeric,
  pnl_today numeric,
  meta jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.market_states (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  state text not null,
  trend text,
  volatility numeric,
  spread numeric,
  price numeric,
  created_at timestamptz not null default now()
);

create table public.markov_predictions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  current_state text not null,
  predicted_state text not null,
  probability numeric not null,
  persistence_bars int,
  transitions int,
  signal text,
  created_at timestamptz not null default now()
);

create table public.kelly_risk (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  model_probability numeric,
  reward_risk numeric,
  edge numeric,
  kelly_fraction numeric,
  final_risk numeric,
  lot_size numeric,
  status text,
  created_at timestamptz not null default now()
);

create table public.strategy_signals (
  id uuid primary key default gen_random_uuid(),
  strategy text not null,
  symbol text,
  status text,
  signal text,
  confidence numeric,
  win_rate numeric,
  pnl numeric,
  reason text,
  created_at timestamptz not null default now()
);

create table public.ai_decisions (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  timeframe text,
  market_state text,
  markov_probability numeric,
  strategy text,
  signal text,
  confidence numeric,
  risk_status text,
  lot_size numeric,
  entry numeric,
  sl numeric,
  tp numeric,
  decision text,
  reason text,
  blocked_reason text,
  created_at timestamptz not null default now()
);

create table public.execution_events (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  side text,
  lot numeric,
  price numeric,
  result text,
  magic int,
  mode text default 'READ_ONLY',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  ticket bigint,
  magic int,
  symbol text not null,
  dir text not null,
  entry numeric,
  sl numeric,
  tp numeric,
  lot numeric,
  pnl numeric,
  result text,
  strategy text,
  confidence numeric,
  reason text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bot_logs (
  id uuid primary key default gen_random_uuid(),
  level text default 'INFO',
  source text,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.nightly_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  trades_reviewed int,
  best_setup text,
  worst_setup text,
  best_session text,
  suggestion text,
  summary text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  total_pnl numeric,
  daily_pnl numeric,
  trades_today int,
  total_trades int,
  win_rate numeric,
  profit_factor numeric,
  max_drawdown numeric,
  open_positions int,
  created_at timestamptz not null default now()
);

create table public.bot_status (
  id uuid primary key default gen_random_uuid(),
  component text not null unique,
  status text not null,
  latency_ms int,
  uptime text,
  last_heartbeat timestamptz default now(),
  meta jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Indexes for time-ordered queries
create index on public.market_states (symbol, created_at desc);
create index on public.markov_predictions (symbol, created_at desc);
create index on public.kelly_risk (created_at desc);
create index on public.strategy_signals (created_at desc);
create index on public.ai_decisions (created_at desc);
create index on public.execution_events (created_at desc);
create index on public.trades (created_at desc);
create index on public.bot_logs (created_at desc);
create index on public.nightly_reports (report_date desc);
create index on public.account_snapshots (created_at desc);

-- RLS: read-only dashboard. Anyone can read; writes restricted to service role.
do $$
declare t text;
begin
  for t in select unnest(array[
    'hermes_agents','market_states','markov_predictions','kelly_risk',
    'strategy_signals','ai_decisions','execution_events','trades',
    'bot_logs','nightly_reports','account_snapshots','bot_status','settings'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read %1$s" on public.%1$I for select using (true)', t);
    execute format('alter table public.%I replica identity full', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
