-- LUMIO — 06: lesson queue, reading progress, streaks.
--
-- The user-facing learning state:
--   * lesson_queue — the three prepared upcoming lessons (max 3 pending/active)
--   * user_lesson_progress — reading position and explicit completion
--   * user_covered_concepts — concept-level history (denormalized for speed)
--   * reading_activity — per local-day activity, the source of streak truth
--   * user_streaks — cached current/longest streak
--
-- Users may read their own rows and update their own progress. Rows that
-- summarize activity (covered concepts, streaks) are written by the backend
-- so the numbers cannot be forged from a client.

create type public.queue_status as enum ('pending', 'active', 'completed', 'replaced', 'skipped');

-- ---------------------------------------------------------------------------
-- lesson_queue: at most three pending/active lessons per user, no duplicates.
-- Enforced by partial unique indexes so retries and concurrent workers cannot
-- create a fourth entry or queue the same lesson twice.
-- ---------------------------------------------------------------------------
create table public.lesson_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  status public.queue_status not null default 'pending',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.lesson_queue is
  'The user''s prepared upcoming lessons. Partial unique indexes enforce max 3 pending/active and no duplicate lessons.';

create unique index lesson_queue_active_position_key
  on public.lesson_queue (user_id, position)
  where status in ('pending', 'active');

create unique index lesson_queue_active_lesson_key
  on public.lesson_queue (user_id, lesson_id)
  where status in ('pending', 'active');

create index lesson_queue_user_status_idx on public.lesson_queue (user_id, status);

create trigger set_updated_at
  before update on public.lesson_queue
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_lesson_progress: opening a lesson is not completing it.
-- ---------------------------------------------------------------------------
create table public.user_lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  started_at timestamptz,
  last_opened_at timestamptz,
  furthest_block_index integer check (furthest_block_index >= 0),
  completed_at timestamptz,                    -- only set by the completion flow
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

comment on table public.user_lesson_progress is
  'Reading state per lesson. completed_at is the authoritative completion timestamp.';

create trigger set_updated_at
  before update on public.user_lesson_progress
  for each row execute function public.set_updated_at();

create index user_lesson_progress_completed_idx
  on public.user_lesson_progress (user_id, completed_at)
  where completed_at is not null;

-- ---------------------------------------------------------------------------
-- user_covered_concepts: progress tracked by concept, not just by lesson.
-- ---------------------------------------------------------------------------
create table public.user_covered_concepts (
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  first_lesson_id uuid references public.lessons (id) on delete set null,
  first_covered_at timestamptz not null default now(),
  last_covered_at timestamptz not null default now(),
  times_covered integer not null default 1 check (times_covered > 0),
  primary key (user_id, concept_id)
);

comment on table public.user_covered_concepts is
  'Denormalized concept history, updated when a lesson is completed. Feeds gap and repetition checks.';

create index user_covered_concepts_concept_idx on public.user_covered_concepts (concept_id);

-- ---------------------------------------------------------------------------
-- reading_activity: one row per user per local calendar day.
-- ---------------------------------------------------------------------------
create table public.reading_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,                 -- user-local date, derived from profiles.timezone
  lessons_completed smallint not null default 0 check (lessons_completed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

comment on table public.reading_activity is
  'Daily activity in the user''s local calendar (V1 rule). A streak day = at least one completion.';

create trigger set_updated_at
  before update on public.reading_activity
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_streaks: cached counters; recomputed from reading_activity.
-- ---------------------------------------------------------------------------
create table public.user_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_completed_on date,
  updated_at timestamptz not null default now()
);

comment on table public.user_streaks is
  'Current and longest streak. A missed day resets current_streak, never history.';

create trigger set_updated_at
  before update on public.user_streaks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access control.
-- ---------------------------------------------------------------------------
alter table public.lesson_queue enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.user_covered_concepts enable row level security;
alter table public.reading_activity enable row level security;
alter table public.user_streaks enable row level security;

-- Queue: users see their own entries; status updates (e.g. opening a lesson,
-- marking completion) are allowed on own rows only. Inserts/removals are the
-- backend's job.
create policy lesson_queue_select_own
  on public.lesson_queue for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_queue_update_own
  on public.lesson_queue for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Progress: the reader records started/last_opened and completion.
create policy user_lesson_progress_select_own
  on public.user_lesson_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_lesson_progress_insert_own
  on public.user_lesson_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_lesson_progress_update_own
  on public.user_lesson_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Summary tables: read own rows; writes are backend-only.
create policy user_covered_concepts_select_own
  on public.user_covered_concepts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy reading_activity_select_own
  on public.reading_activity for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_streaks_select_own
  on public.user_streaks for select
  to authenticated
  using ((select auth.uid()) = user_id);
