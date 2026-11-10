create table if not exists public.developer_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(80) not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_apps_id_user_id_unique unique (id, user_id)
);

create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.developer_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(80) not null check (length(trim(name)) between 1 and 80),
  key_prefix varchar(24) not null,
  key_hash char(64) not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default array['chat:generate']::text[]
    check (scopes = array['chat:generate']::text[]),
  per_minute_limit integer not null default 10
    check (per_minute_limit between 1 and 60),
  minute_window_start timestamptz not null default date_trunc('minute', now()),
  minute_requests integer not null default 0 check (minute_requests >= 0),
  month_window_start date not null default date_trunc('month', current_date)::date,
  month_requests integer not null default 0 check (month_requests >= 0),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint developer_api_key_owner_matches_app
    foreign key (app_id, user_id)
    references public.developer_apps (id, user_id)
    on delete cascade
);

create table if not exists public.developer_api_usage (
  request_id uuid primary key,
  api_key_id uuid not null references public.developer_api_keys (id) on delete cascade,
  app_id uuid not null references public.developer_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  status text not null check (status in ('success', 'error')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists developer_apps_user_created_idx
  on public.developer_apps (user_id, created_at desc);
create index if not exists developer_api_keys_user_created_idx
  on public.developer_api_keys (user_id, created_at desc);
create index if not exists developer_api_usage_user_created_idx
  on public.developer_api_usage (user_id, created_at desc);
create index if not exists developer_api_usage_key_created_idx
  on public.developer_api_usage (api_key_id, created_at desc);

create unique index if not exists developer_apps_user_name_idx
  on public.developer_apps (user_id, lower(name));
create unique index if not exists developer_api_keys_prefix_idx
  on public.developer_api_keys (key_prefix);

alter table public.developer_apps enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_api_usage enable row level security;

grant select, insert on public.developer_apps to authenticated;
grant select (
  id,
  app_id,
  name,
  key_prefix,
  scopes,
  per_minute_limit,
  created_at,
  last_used_at,
  revoked_at
) on public.developer_api_keys to authenticated;
grant select (
  request_id,
  api_key_id,
  app_id,
  model,
  status,
  input_tokens,
  output_tokens,
  created_at
) on public.developer_api_usage to authenticated;

create policy "Developers read their own applications"
  on public.developer_apps for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Developers register their own applications"
  on public.developer_apps for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Developers read metadata for their own keys"
  on public.developer_api_keys for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Developers read their own API usage"
  on public.developer_api_usage for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.developer_api_keys from anon, authenticated;
grant select (
  id,
  app_id,
  name,
  key_prefix,
  scopes,
  per_minute_limit,
  created_at,
  last_used_at,
  revoked_at
) on public.developer_api_keys to authenticated;
revoke all on public.developer_api_usage from anon, authenticated;
grant select (
  request_id,
  api_key_id,
  app_id,
  model,
  status,
  input_tokens,
  output_tokens,
  created_at
) on public.developer_api_usage to authenticated;

create or replace function public.create_developer_api_key(
  p_app_id uuid,
  p_name text,
  p_key_prefix text,
  p_key_hash text
)
returns table (
  id uuid,
  app_id uuid,
  name text,
  key_prefix text,
  scopes text[],
  per_minute_limit integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  active_key_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 then
    raise exception 'Invalid API key name' using errcode = '22023';
  end if;
  if p_key_prefix is null or length(p_key_prefix) not between 8 and 24
    or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid API key material' using errcode = '22023';
  end if;
  perform 1 from public.developer_apps
  where developer_apps.id = p_app_id
    and developer_apps.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  select count(*) into active_key_count
  from public.developer_api_keys
  where developer_api_keys.app_id = p_app_id
    and developer_api_keys.user_id = current_user_id
    and developer_api_keys.revoked_at is null;
  if active_key_count >= 5 then
    raise exception 'An application can have at most five active API keys' using errcode = '54000';
  end if;

  return query
  insert into public.developer_api_keys as api_key (
    app_id,
    user_id,
    name,
    key_prefix,
    key_hash
  )
  values (
    p_app_id,
    current_user_id,
    trim(p_name),
    p_key_prefix,
    p_key_hash
  )
  returning
    api_key.id,
    api_key.app_id,
    api_key.name::text,
    api_key.key_prefix::text,
    api_key.scopes,
    api_key.per_minute_limit,
    api_key.created_at;
end;
$$;

revoke all on function public.create_developer_api_key(uuid, text, text, text) from public, anon;
grant execute on function public.create_developer_api_key(uuid, text, text, text) to authenticated;

create or replace function public.revoke_developer_api_key(p_key_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.developer_api_keys
  set revoked_at = now()
  where id = p_key_id
    and user_id = current_user_id
    and revoked_at is null;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.revoke_developer_api_key(uuid) from public, anon;
grant execute on function public.revoke_developer_api_key(uuid) to authenticated;

create or replace function public.consume_developer_api_key(p_key_hash text)
returns table (
  authorized boolean,
  error_code text,
  api_key_id uuid,
  owner_id uuid,
  app_id uuid,
  scopes text[],
  remaining_monthly integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_row public.developer_api_keys%rowtype;
  current_minute timestamptz := date_trunc('minute', now());
  current_month date := date_trunc('month', current_date)::date;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    return query select false, 'invalid_api_key'::text, null::uuid, null::uuid, null::uuid, null::text[], 0;
    return;
  end if;

  select * into key_row
  from public.developer_api_keys
  where developer_api_keys.key_hash = p_key_hash
    and developer_api_keys.revoked_at is null
  for update;
  if not found then
    return query select false, 'invalid_api_key'::text, null::uuid, null::uuid, null::uuid, null::text[], 0;
    return;
  end if;
  if not (key_row.scopes @> array['chat:generate']::text[]) then
    return query select false, 'insufficient_scope'::text, key_row.id, key_row.user_id, key_row.app_id, key_row.scopes, 0;
    return;
  end if;

  if key_row.minute_window_start <> current_minute then
    key_row.minute_window_start := current_minute;
    key_row.minute_requests := 0;
  end if;
  if key_row.month_window_start <> current_month then
    key_row.month_window_start := current_month;
    key_row.month_requests := 0;
  end if;

  if key_row.month_requests >= 10000 then
    update public.developer_api_keys
    set minute_window_start = key_row.minute_window_start,
        minute_requests = key_row.minute_requests,
        month_window_start = key_row.month_window_start,
        month_requests = key_row.month_requests
    where id = key_row.id;
    return query select false, 'monthly_quota_exceeded'::text, key_row.id, key_row.user_id, key_row.app_id, key_row.scopes, 0;
    return;
  end if;
  if key_row.minute_requests >= key_row.per_minute_limit then
    update public.developer_api_keys
    set minute_window_start = key_row.minute_window_start,
        minute_requests = key_row.minute_requests,
        month_window_start = key_row.month_window_start,
        month_requests = key_row.month_requests
    where id = key_row.id;
    return query select false, 'rate_limited'::text, key_row.id, key_row.user_id, key_row.app_id, key_row.scopes,
      greatest(0, 10000 - key_row.month_requests);
    return;
  end if;

  update public.developer_api_keys
  set minute_window_start = key_row.minute_window_start,
      minute_requests = key_row.minute_requests + 1,
      month_window_start = key_row.month_window_start,
      month_requests = key_row.month_requests + 1,
      last_used_at = now()
  where id = key_row.id;

  return query select true, null::text, key_row.id, key_row.user_id, key_row.app_id, key_row.scopes,
    greatest(0, 9999 - key_row.month_requests);
end;
$$;

revoke all on function public.consume_developer_api_key(text) from public, authenticated;
grant execute on function public.consume_developer_api_key(text) to anon;

create or replace function public.record_developer_api_usage(
  p_key_hash text,
  p_request_id uuid,
  p_model text,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_row public.developer_api_keys%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
    or p_request_id is null
    or p_model is null or length(p_model) not between 1 and 120
    or p_status not in ('success', 'error')
    or (p_input_tokens is not null and p_input_tokens < 0)
    or (p_output_tokens is not null and p_output_tokens < 0) then
    raise exception 'Invalid usage event' using errcode = '22023';
  end if;

  select * into key_row
  from public.developer_api_keys
  where developer_api_keys.key_hash = p_key_hash;
  if not found then
    return false;
  end if;

  insert into public.developer_api_usage (
    request_id,
    api_key_id,
    app_id,
    user_id,
    model,
    status,
    input_tokens,
    output_tokens
  )
  values (
    p_request_id,
    key_row.id,
    key_row.app_id,
    key_row.user_id,
    p_model,
    p_status,
    p_input_tokens,
    p_output_tokens
  )
  on conflict (request_id) do nothing;
  return true;
end;
$$;

revoke all on function public.record_developer_api_usage(text, uuid, text, text, integer, integer) from public, authenticated;
grant execute on function public.record_developer_api_usage(text, uuid, text, text, integer, integer) to anon;

create or replace function public.get_my_developer_usage()
returns table (
  month_requests bigint,
  input_tokens bigint,
  output_tokens bigint,
  active_keys bigint,
  monthly_limit_per_key integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select
    count(usage.request_id),
    coalesce(sum(usage.input_tokens), 0)::bigint,
    coalesce(sum(usage.output_tokens), 0)::bigint,
    (
      select count(*)
      from public.developer_api_keys api_key
      where api_key.user_id = current_user_id
        and api_key.revoked_at is null
    ),
    10000
  from public.developer_api_usage usage
  where usage.user_id = current_user_id
    and usage.created_at >= date_trunc('month', now());
end;
$$;

revoke all on function public.get_my_developer_usage() from public, anon;
grant execute on function public.get_my_developer_usage() to authenticated;
