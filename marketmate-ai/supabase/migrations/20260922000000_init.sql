-- MarketMate AI — initial schema
--
-- Isolation model (two layers, both enforced by Postgres):
--   1. Row Level Security: every table has a NOT NULL user_id and policies that
--      only expose rows where user_id = auth.uid().
--   2. Composite foreign keys (child.parent_id, child.user_id) → parent(id, user_id):
--      a row can only reference a parent row owned by the SAME user. This blocks
--      "attach my row to someone else's business id" even though FK checks
--      themselves bypass RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users: one profile row per Supabase auth user (created by trigger on signup)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  industry text,
  description text,
  products text,
  target_audience text,
  location text,
  website text,
  social_handles jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index businesses_user_id_idx on public.businesses (user_id);
-- At most one primary business per user.
create unique index businesses_one_primary_per_user
  on public.businesses (user_id) where is_primary;

-- ---------------------------------------------------------------------------
-- brand_kits (one per business)
-- ---------------------------------------------------------------------------

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid not null,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  heading_font text,
  body_font text,
  logo_path text,
  brand_voice text,
  tagline text,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  unique (id, user_id),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade
);
create index brand_kits_user_id_idx on public.brand_kits (user_id);

-- ---------------------------------------------------------------------------
-- projects (group designs / content, e.g. "Holiday launch")
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade
);
create index projects_user_id_idx on public.projects (user_id);
create index projects_business_id_idx on public.projects (business_id);

-- ---------------------------------------------------------------------------
-- designs (Design Studio requests; image generation not connected yet)
-- ---------------------------------------------------------------------------

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  project_id uuid,
  title text not null default 'Untitled design',
  design_type text not null default 'social_post',
  brief jsonb not null default '{}'::jsonb,
  upload_paths text[] not null default '{}',
  -- 'not_connected' is the honest status while no image provider is wired up.
  status text not null default 'draft'
    check (status in ('draft', 'not_connected', 'queued', 'generating', 'completed', 'failed')),
  provider text,
  output_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade,
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id)
);
create index designs_user_id_idx on public.designs (user_id);

-- ---------------------------------------------------------------------------
-- social_content (captions, hashtags, ideas, repurposed posts, studio content)
-- ---------------------------------------------------------------------------

create table public.social_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  project_id uuid,
  content_type text not null check (content_type in (
    'caption', 'hashtags', 'content_idea', 'repurposed', 'blog_post',
    'email', 'product_description', 'ad_copy', 'video_script', 'other'
  )),
  platform text,
  title text,
  body text not null,
  input jsonb not null default '{}'::jsonb,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade,
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id)
);
create index social_content_user_created_idx on public.social_content (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- pricing_calculations
-- ---------------------------------------------------------------------------

create table public.pricing_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  product_name text not null check (char_length(product_name) between 1 and 200),
  inputs jsonb not null,
  results jsonb not null,
  cost_per_unit numeric(12, 4) not null,
  suggested_retail_price numeric(12, 2) not null,
  suggested_wholesale_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade
);
create index pricing_calculations_user_created_idx
  on public.pricing_calculations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- marketing_plans (audience analysis, personas, plans, campaigns)
-- ---------------------------------------------------------------------------

create table public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  plan_type text not null check (plan_type in (
    'audience_analysis', 'persona', 'marketing_plan', 'campaign'
  )),
  title text not null,
  body text not null,
  input jsonb not null default '{}'::jsonb,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade
);
create index marketing_plans_user_created_idx on public.marketing_plans (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- content_calendar_entries
-- ---------------------------------------------------------------------------

create table public.content_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  social_content_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  notes text,
  platform text not null,
  scheduled_for date not null,
  status text not null default 'planned'
    check (status in ('idea', 'planned', 'drafted', 'scheduled', 'posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade,
  foreign key (social_content_id, user_id)
    references public.social_content (id, user_id) on delete set null (social_content_id)
);
create index content_calendar_user_date_idx
  on public.content_calendar_entries (user_id, scheduled_for);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'businesses', 'brand_kits', 'projects', 'designs', 'social_content',
    'pricing_calculations', 'marketing_plans', 'content_calendar_entries'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

create policy "users: read own profile" on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy "users: update own profile" on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Inserts come from the signup trigger (security definer); no client insert/delete.

do $$
declare
  t text;
begin
  foreach t in array array[
    'businesses', 'brand_kits', 'projects', 'designs', 'social_content',
    'pricing_calculations', 'marketing_plans', 'content_calendar_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy "%s: select own" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t, t);
    execute format(
      'create policy "%s: insert own" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t, t);
    execute format(
      'create policy "%s: update own" on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format(
      'create policy "%s: delete own" on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for Design Studio uploads, one folder per user.
-- Object paths must look like "<user_id>/<anything>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-uploads', 'design-uploads', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "design-uploads: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "design-uploads: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'design-uploads'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "design-uploads: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'design-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "design-uploads: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'design-uploads'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
