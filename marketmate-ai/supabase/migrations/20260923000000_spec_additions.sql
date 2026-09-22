-- MarketMate AI — additions for the full product spec.
-- Same isolation model as the init migration: RLS on user_id + composite
-- (parent_id, user_id) foreign keys so rows can only point at the owner's data.

-- ---------------------------------------------------------------------------
-- Business profile: contact details
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column phone text check (phone is null or char_length(phone) <= 40),
  add column email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ---------------------------------------------------------------------------
-- Social content: more content types for the Content Creation Studio
-- ---------------------------------------------------------------------------

alter table public.social_content drop constraint social_content_content_type_check;
alter table public.social_content add constraint social_content_content_type_check
  check (content_type in (
    'caption', 'hashtags', 'content_idea', 'repurposed', 'blog_post', 'email',
    'product_description', 'ad_copy', 'video_script', 'social_post', 'website_copy',
    'promo_message', 'cta', 'launch_announcement', 'design_copy', 'other'
  ));

-- ---------------------------------------------------------------------------
-- Marketing plans: competitor analysis (from user-provided competitors only)
-- ---------------------------------------------------------------------------

alter table public.marketing_plans drop constraint marketing_plans_plan_type_check;
alter table public.marketing_plans add constraint marketing_plans_plan_type_check
  check (plan_type in (
    'audience_analysis', 'persona', 'marketing_plan', 'campaign', 'competitor_analysis'
  ));

-- ---------------------------------------------------------------------------
-- Content calendar: full post details
-- ---------------------------------------------------------------------------

alter table public.content_calendar_entries
  add column content_type text check (content_type is null or char_length(content_type) <= 50),
  add column topic text check (topic is null or char_length(topic) <= 500),
  add column caption text check (caption is null or char_length(caption) <= 5000),
  add column cta text check (cta is null or char_length(cta) <= 300);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  business_id uuid,
  name text not null check (char_length(name) between 1 and 300),
  campaign_type text not null default 'other' check (campaign_type in (
    'product_launch', 'sale', 'holiday', 'seasonal', 'brand_awareness',
    'customer_retention', 'customer_acquisition', 'other'
  )),
  objective text,
  start_date date,
  end_date date,
  status text not null default 'idea' check (status in ('idea', 'planned', 'active', 'completed')),
  body text not null default '',
  input jsonb not null default '{}'::jsonb,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (business_id, user_id)
    references public.businesses (id, user_id) on delete cascade
);
create index campaigns_user_created_idx on public.campaigns (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- assistant_messages: the AI Marketing Assistant's conversation history
-- ---------------------------------------------------------------------------

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 50000),
  created_at timestamptz not null default now()
);
create index assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Triggers + RLS for the new tables
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['campaigns', 'assistant_messages'] loop
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

revoke all on public.campaigns, public.assistant_messages from anon;
