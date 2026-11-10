create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title varchar(120) not null default 'New conversation',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_title_not_blank check (length(trim(title)) > 0)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 20000),
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  provider text not null,
  model text not null,
  status text not null check (status in ('success', 'error', 'rate_limited')),
  error_code text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, bucket_start)
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);
create index if not exists chat_rate_limits_bucket_idx
  on public.chat_rate_limits (bucket_start);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.usage_events to authenticated;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.usage_events enable row level security;
alter table public.chat_rate_limits enable row level security;

create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Profiles are editable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users manage their own conversations"
  on public.conversations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own messages"
  on public.messages for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own usage"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can write their own usage"
  on public.usage_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations
        where conversations.id = usage_events.conversation_id
          and conversations.user_id = (select auth.uid())
      )
    )
  );

revoke all on public.chat_rate_limits from anon, authenticated;

create or replace function public.consume_chat_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_bucket timestamptz := date_trunc('minute', now());
  request_total integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.chat_rate_limits (user_id, bucket_start, request_count)
  values (current_user_id, current_bucket, 1)
  on conflict (user_id, bucket_start)
  do update set request_count = public.chat_rate_limits.request_count + 1
  returning request_count into request_total;

  delete from public.chat_rate_limits
  where bucket_start < current_bucket - interval '5 minutes';

  return request_total <= 20;
end;
$$;

revoke all on function public.consume_chat_request() from public, anon;
grant execute on function public.consume_chat_request() to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create or replace function public.delete_my_chat_history()
returns void
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

  delete from public.usage_events where user_id = current_user_id;
  delete from public.conversations where user_id = current_user_id;
end;
$$;

revoke all on function public.delete_my_chat_history() from public, anon;
grant execute on function public.delete_my_chat_history() to authenticated;
