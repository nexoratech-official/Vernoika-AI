create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  memory_enabled boolean not null default false,
  personalization_enabled boolean not null default false,
  response_style text not null default 'balanced'
    check (response_style in ('concise', 'balanced', 'detailed')),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title varchar(120) not null check (length(trim(title)) between 1 and 120),
  content text not null check (length(trim(content)) between 1 and 4000),
  category text not null default 'general'
    check (category in ('general', 'preference', 'goal', 'work', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text not null
    check (agent_id in ('research', 'developer', 'designer', 'business', 'personal', 'data', 'security')),
  title varchar(120) not null check (length(trim(title)) between 1 and 120),
  prompt text not null check (length(trim(prompt)) between 1 and 4000),
  result text check (result is null or length(result) <= 20000),
  status text not null default 'running'
    check (status in ('running', 'awaiting_approval', 'approved', 'rejected', 'failed')),
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_role text not null check (sender_role in ('prime', 'specialist')),
  sender_agent_id text
    check (sender_agent_id is null or sender_agent_id in ('research', 'developer', 'designer', 'business', 'personal', 'data', 'security')),
  content text not null check (length(content) between 1 and 20000),
  created_at timestamptz not null default now(),
  constraint agent_message_sender_matches_role check (
    (sender_role = 'prime' and sender_agent_id is null)
    or (sender_role = 'specialist' and sender_agent_id is not null)
  )
);

create index if not exists memory_items_user_updated_idx
  on public.memory_items (user_id, updated_at desc);
create index if not exists agent_tasks_user_created_idx
  on public.agent_tasks (user_id, created_at desc);
create index if not exists agent_messages_task_created_idx
  on public.agent_messages (task_id, created_at);

alter table public.user_preferences enable row level security;
alter table public.memory_items enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_messages enable row level security;

grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.memory_items to authenticated;
grant select, insert, update, delete on public.agent_tasks to authenticated;
grant select, insert on public.agent_messages to authenticated;

create policy "Users manage their own preferences"
  on public.user_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own memories"
  on public.memory_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read and create their own agent tasks"
  on public.agent_tasks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read and create messages for their own agent tasks"
  on public.agent_messages for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.agent_tasks
      where agent_tasks.id = agent_messages.task_id
        and agent_tasks.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.agent_tasks
      where agent_tasks.id = agent_messages.task_id
        and agent_tasks.user_id = (select auth.uid())
    )
  );
