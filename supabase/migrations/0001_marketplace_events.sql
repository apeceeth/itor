-- FevoStable Marketplace — Supabase schema & migration
-- Run in Supabase Dashboard → SQL Editor (or via `supabase db push`).
-- Blockchain stays the source of truth; this table only mirrors CONFIRMED on-chain events.

create table if not exists public.marketplace_events (
  id                    bigint generated always as identity primary key,
  created_at            timestamptz not null default now(),
  block_number          bigint,
  transaction_hash      text not null,
  log_index             integer not null default 0,
  event_type            text not null,
  token_id              text,
  collection            text default 'FevoStable Genesis',
  nft_contract          text,
  marketplace_contract  text,
  seller                text,
  buyer                 text,
  offer_maker           text,
  wallet_from           text,
  wallet_to             text,
  price                 numeric,
  currency              text default 'USDT0',
  status                text default 'Confirmed',
  network               text default 'Stable Mainnet',
  image_url             text,
  explorer_url          text,
  metadata_json         jsonb
);

-- Never insert the same blockchain event twice.
create unique index if not exists marketplace_events_tx_log_uidx
  on public.marketplace_events (transaction_hash, log_index);

-- Query indexes
create index if not exists marketplace_events_tx_idx      on public.marketplace_events (transaction_hash);
create index if not exists marketplace_events_token_idx   on public.marketplace_events (token_id);
create index if not exists marketplace_events_type_idx    on public.marketplace_events (event_type);
create index if not exists marketplace_events_seller_idx  on public.marketplace_events (seller);
create index if not exists marketplace_events_buyer_idx   on public.marketplace_events (buyer);
create index if not exists marketplace_events_created_idx on public.marketplace_events (created_at desc);

-- Row Level Security ---------------------------------------------------------
alter table public.marketplace_events enable row level security;

-- Public (anon) may READ everything.
drop policy if exists "public read" on public.marketplace_events;
create policy "public read"
  on public.marketplace_events for select
  using (true);

-- Public (anon) may INSERT confirmed events (client-side app has only the anon key).
-- Visitors may never UPDATE or DELETE (no such policies → denied by RLS).
drop policy if exists "anon insert" on public.marketplace_events;
create policy "anon insert"
  on public.marketplace_events for insert
  with check (true);

-- NOTE: If you prefer inserts to come only from a trusted backend, drop the
-- "anon insert" policy above and insert with the service_role key from a server
-- (Edge Function / API route) instead. The frontend would then only read.

-- Realtime -------------------------------------------------------------------
-- Broadcast row changes to subscribed browsers.
alter publication supabase_realtime add table public.marketplace_events;
