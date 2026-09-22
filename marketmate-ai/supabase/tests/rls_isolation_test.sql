-- Two users; verify each only sees and can only modify their own data.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', '{"full_name":"Alice"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com', '{}');

do $$ begin
  assert (select count(*) from public.users) = 2, 'signup trigger should create profile rows';
  assert (select full_name from public.users where email = 'alice@example.com') = 'Alice';
end $$;

-- ---- act as Alice ----
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into public.businesses (id, name, is_primary) values ('a0000000-0000-0000-0000-00000000000a', 'Alice Candles', true);
insert into public.brand_kits (business_id, primary_color) values ('a0000000-0000-0000-0000-00000000000a', '#FF8800');
insert into public.projects (id, business_id, name) values ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Launch');
insert into public.social_content (id, business_id, project_id, content_type, body)
  values ('a0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'caption', 'Hello');
insert into public.pricing_calculations (product_name, inputs, results, cost_per_unit, suggested_retail_price, suggested_wholesale_price)
  values ('Candle', '{}', '{}', 5, 14.32, 10);
insert into public.marketing_plans (plan_type, title, body) values ('persona', 'P', 'B');
insert into public.content_calendar_entries (social_content_id, title, platform, scheduled_for)
  values ('a0000000-0000-0000-0000-0000000000c1', 'Post', 'instagram', '2026-10-01');
insert into public.designs (business_id, project_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'not_connected');
insert into storage.objects (bucket_id, name) values ('design-uploads', 'aaaaaaaa-0000-0000-0000-000000000001/logo.png');
insert into public.campaigns (business_id, name, campaign_type, body) values ('a0000000-0000-0000-0000-00000000000a', 'Holiday sale', 'holiday', 'Plan');
insert into public.assistant_messages (role, content) values ('user', 'I sell handmade candles in Barbados.');
update public.businesses set phone = '+1 246 555 0100', email = 'hello@alicecandles.example';

-- ---- act as Bob ----
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare t text; n int;
begin
  foreach t in array array['businesses','brand_kits','projects','designs','social_content',
    'pricing_calculations','marketing_plans','content_calendar_entries','campaigns','assistant_messages'] loop
    execute format('select count(*) from public.%I', t) into n;
    assert n = 0, format('Bob can see %s rows in %s', n, t);
  end loop;
  assert (select count(*) from public.users) = 1, 'Bob should only see his own profile';
  assert (select count(*) from storage.objects) = 0, 'Bob can see Alice''s uploads';
end $$;

-- Bob cannot update/delete Alice's rows (silently affects 0 rows under RLS).
update public.businesses set name = 'pwned';
delete from public.social_content;

-- Bob cannot insert rows claiming to be Alice.
do $$ begin
  begin
    insert into public.businesses (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'spoof');
    raise exception 'FAIL: spoofed user_id insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Bob cannot attach his own rows to Alice's business/project/content (composite FKs).
do $$ begin
  begin
    insert into public.brand_kits (business_id) values ('a0000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: cross-user brand kit';
  -- Either constraint may fire first (one kit per business, or the owner FK); both refuse it.
  exception when foreign_key_violation or unique_violation then null; end;
  begin
    insert into public.social_content (business_id, content_type, body) values ('a0000000-0000-0000-0000-00000000000a', 'caption', 'x');
    raise exception 'FAIL: cross-user social content';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.content_calendar_entries (social_content_id, title, platform, scheduled_for)
      values ('a0000000-0000-0000-0000-0000000000c1', 't', 'x', '2026-10-01');
    raise exception 'FAIL: cross-user calendar entry';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.designs (project_id) values ('a0000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: cross-user design';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.campaigns (business_id, name) values ('a0000000-0000-0000-0000-00000000000a', 'x');
    raise exception 'FAIL: cross-user campaign';
  exception when foreign_key_violation then null; end;
end $$;

-- Bob cannot upload into Alice's storage folder.
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('design-uploads', 'aaaaaaaa-0000-0000-0000-000000000001/evil.png');
    raise exception 'FAIL: cross-user upload';
  exception when insufficient_privilege then null; end;
end $$;

-- Bob can use his own data normally.
insert into public.businesses (id, name) values ('b0000000-0000-0000-0000-00000000000b', 'Bob Bakes');
insert into public.brand_kits (business_id) values ('b0000000-0000-0000-0000-00000000000b');

-- ---- anon sees nothing ----
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform count(*) from public.businesses;
    raise exception 'FAIL: anon could read businesses';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- back to Alice: her data is intact ----
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ begin
  assert (select name from public.businesses) = 'Alice Candles', 'Alice''s business was modified by Bob';
  assert (select count(*) from public.social_content) = 1, 'Alice''s content was deleted by Bob';
  assert (select count(*) from public.businesses) = 1, 'Alice should see only her business';
end $$;

-- Validation checks.
do $$ begin
  begin
    insert into public.brand_kits (business_id, primary_color) values ('a0000000-0000-0000-0000-00000000000a', 'orange');
    raise exception 'FAIL: bad colour accepted';
  exception when check_violation or unique_violation then null; end;
  begin
    insert into public.businesses (name, is_primary) values ('Second primary', true);
    raise exception 'FAIL: two primary businesses';
  exception when unique_violation then null; end;
end $$;

do $$ begin
  begin
    update public.businesses set email = 'not-an-email';
    raise exception 'FAIL: bad email accepted';
  exception when check_violation then null; end;
  begin
    insert into public.campaigns (name, start_date, end_date) values ('x', '2026-10-10', '2026-10-01');
    raise exception 'FAIL: campaign end before start';
  exception when check_violation then null; end;
  begin
    insert into public.assistant_messages (role, content) values ('system', 'x');
    raise exception 'FAIL: bad assistant role';
  exception when check_violation then null; end;
  assert (select count(*) from public.assistant_messages) = 1;
  assert (select count(*) from public.campaigns) = 1;
end $$;

-- Deleting a project nulls project_id but keeps user_id (column-list SET NULL).
delete from public.projects where id = 'a0000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select project_id from public.social_content) is null;
  assert (select user_id from public.social_content) = 'aaaaaaaa-0000-0000-0000-000000000001';
end $$;

-- Deleting the auth user cascades everything.
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.businesses where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0;
  assert (select count(*) from public.content_calendar_entries) = 0;
end $$;

select 'ALL RLS ISOLATION TESTS PASSED' as result;
