-- Cat Go foundation: shared map sightings, AI analyses, and cross-provider identities.
-- Apply in Supabase SQL Editor. Public map reads are allowed only for published sightings.
-- Writes should go through the catgo-player Edge Function after validating Telegram initData
-- or a Supabase Auth access token. Never expose the service-role key to the client.

create extension if not exists pgcrypto;

create table if not exists public.cat_sightings (
  id uuid primary key default gen_random_uuid(),
  created_by_telegram_id bigint,
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  cat_name text not null default 'Котик' check (char_length(cat_name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  photo_url text,
  photo_storage_path text,
  status text not null default 'published' check (status in ('published','hidden','removed')),
  approximate_location boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cat_sightings_creator_required check (
    created_by_telegram_id is not null or created_by_auth_user_id is not null
  )
);

create index if not exists cat_sightings_published_created_idx
  on public.cat_sightings (created_at desc) where status = 'published';
create index if not exists cat_sightings_lat_lng_idx
  on public.cat_sightings (latitude, longitude) where status = 'published';
create index if not exists cat_sightings_telegram_creator_idx
  on public.cat_sightings (created_by_telegram_id, created_at desc);

alter table public.cat_sightings enable row level security;
drop policy if exists "Published sightings are readable" on public.cat_sightings;
create policy "Published sightings are readable"
  on public.cat_sightings for select to anon, authenticated
  using (status = 'published');
-- Deliberately no direct client INSERT/UPDATE/DELETE policies. Edge Function uses service role
-- only after authenticating the player and validating image, coordinates, rate limits and content.

create table if not exists public.cat_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid references public.cat_sightings(id) on delete cascade,
  discovery_id text,
  player_telegram_id bigint,
  model_provider text not null,
  model_version text,
  cat_detected boolean,
  cat_confidence numeric(5,4) check (cat_confidence is null or cat_confidence between 0 and 1),
  breed_candidates jsonb not null default '[]'::jsonb,
  coat_color jsonb not null default '[]'::jsonb,
  coat_pattern jsonb not null default '[]'::jsonb,
  eye_color jsonb not null default '[]'::jsonb,
  visible_features jsonb not null default '[]'::jsonb,
  face_features jsonb not null default '{}'::jsonb,
  mood_estimate jsonb not null default '{}'::jsonb,
  pose_estimate jsonb not null default '{}'::jsonb,
  background_removed_url text,
  moderation_flags jsonb not null default '[]'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cat_ai_analysis_target check (sighting_id is not null or discovery_id is not null)
);
create index if not exists cat_ai_sightings_idx on public.cat_ai_analyses (sighting_id, created_at desc);
create index if not exists cat_ai_player_idx on public.cat_ai_analyses (player_telegram_id, created_at desc);
alter table public.cat_ai_analyses enable row level security;
-- No direct client policies: AI calls and reads go through the authenticated Edge Function.

create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','apple','email','telegram')),
  provider_subject text not null,
  telegram_id bigint,
  created_at timestamptz not null default now(),
  linked_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (auth_user_id, provider),
  constraint auth_identity_subject_nonempty check (char_length(provider_subject) > 0)
);
create unique index if not exists auth_identities_telegram_id_unique
  on public.auth_identities (telegram_id) where telegram_id is not null;
alter table public.auth_identities enable row level security;
drop policy if exists "Users can read own linked identities" on public.auth_identities;
create policy "Users can read own linked identities"
  on public.auth_identities for select to authenticated
  using (auth.uid() = auth_user_id);
-- Identity linking must be performed server-side after validating BOTH sessions.
