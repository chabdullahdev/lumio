-- LUMIO — 17: reflection answers, personal notes and problem reports.
--
-- * lesson_reflections — the reader's own answer to a lesson's reflection
--   question, plus an optional free note. One row per user per lesson. It is
--   shown in the notebook next to the takeaways.
-- * lesson_reports — "Report a problem" from the reader. Readers can only add
--   and see their own reports; the team reads them with the service role.

create table public.lesson_reflections (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  answer text not null default '' check (char_length(answer) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index lesson_reflections_lesson_idx on public.lesson_reflections (lesson_id);

create trigger set_updated_at
  before update on public.lesson_reflections
  for each row execute function public.set_updated_at();

alter table public.lesson_reflections enable row level security;

create policy lesson_reflections_select_own
  on public.lesson_reflections for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_reflections_insert_own
  on public.lesson_reflections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy lesson_reflections_update_own
  on public.lesson_reflections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  reason text not null check (reason in ('inaccurate', 'confusing', 'offensive', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

create index lesson_reports_user_idx on public.lesson_reports (user_id);
create index lesson_reports_lesson_idx on public.lesson_reports (lesson_id);

alter table public.lesson_reports enable row level security;

create policy lesson_reports_select_own
  on public.lesson_reports for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_reports_insert_own
  on public.lesson_reports for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

comment on table public.lesson_reflections is
  'The reader''s own answer to a lesson''s reflection question. Own rows only.';
comment on table public.lesson_reports is
  'Reader-submitted problem reports about a lesson. Insert/select own rows; the team reads all via the service role.';
