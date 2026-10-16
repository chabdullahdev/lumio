-- LUMIO — 02: user profiles.
--
-- One profile row per Supabase auth user, created automatically by a trigger
-- on auth.users. Profiles hold learning-relevant preferences only; lesson
-- history lives in its own tables (see migration 06).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  locale text,
  preferred_reading_time time,
  streak_reminders_enabled boolean not null default true,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user settings and learning preferences; 1:1 with auth.users.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row whenever Supabase creates an auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the matching public.profiles row for a new auth.users row.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: users can only see and edit their own profile.
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
