-- LUMIO — 05: lessons and their source traceability.
--
-- Lessons are per-user and personalized; the same concept may be taught with
-- different lessons to different users. Every lesson row is grounded in
-- approved passages through lesson_sources, so any claim can be traced back
-- to the exact source text (and page) it came from.
--
-- Lessons are written by the backend (service role) only. Users can read
-- their own lessons and nothing else.

create type public.lesson_status as enum ('generating', 'ready', 'failed', 'archived');

create type public.source_usage as enum ('direct_quote', 'paraphrase', 'synthesis');

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  primary_category_id uuid references public.categories (id) on delete set null,
  title text not null,
  summary text,
  content jsonb not null default '[]'::jsonb,   -- ordered content blocks rendered by the reader
  estimated_minutes smallint not null default 15 check (estimated_minutes > 0),
  status public.lesson_status not null default 'generating',
  generation_model text,
  prompt_version text,
  quality_report jsonb,                          -- output of automated quality checks
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(content) = 'array')
);

comment on table public.lessons is
  'Per-user personalized lessons. Only status = ready lessons are shown to users.';
comment on column public.lessons.content is
  'Array of content blocks (paragraphs, headings) rendered by the lesson reader.';
comment on column public.lessons.quality_report is
  'Results of automated checks (source support, readability, repetition) before the lesson is queued.';

create index lessons_user_idx on public.lessons (user_id);
create index lessons_user_status_idx on public.lessons (user_id, status);

create trigger set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lesson_takeaways: the 3-5 takeaways shown at the end of a lesson.
-- ---------------------------------------------------------------------------
create table public.lesson_takeaways (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  text text not null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, position)
);

comment on table public.lesson_takeaways is
  'Ordered takeaways displayed after reading (3-5 per lesson, enforced by the generator).';

-- ---------------------------------------------------------------------------
-- lesson_sources: claim-level traceability to passages.
--
-- Restrict (not cascade) on passage/source deletion: losing provenance
-- silently would be worse than a failed delete that forces explicit cleanup.
-- ---------------------------------------------------------------------------
create table public.lesson_sources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  passage_id bigint not null references public.passages (id) on delete restrict,
  source_id uuid not null references public.sources (id) on delete restrict,
  section_id uuid references public.source_sections (id) on delete set null,
  source_usage public.source_usage not null default 'synthesis',
  quote text,                                   -- exact quoted text when source_usage = 'direct_quote'
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (lesson_id, passage_id)
);

comment on table public.lesson_sources is
  'Grounding record: which passages a lesson used, how, and any exact quote, with page references via passages.';

create index lesson_sources_lesson_idx on public.lesson_sources (lesson_id);
create index lesson_sources_passage_idx on public.lesson_sources (passage_id);
create index lesson_sources_source_idx on public.lesson_sources (source_id);

-- ---------------------------------------------------------------------------
-- lesson_concepts: which concepts a lesson teaches.
-- ---------------------------------------------------------------------------
create table public.lesson_concepts (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  role text not null default 'supporting' check (role in ('primary', 'supporting')),
  created_at timestamptz not null default now(),
  primary key (lesson_id, concept_id)
);

comment on table public.lesson_concepts is
  'Concepts taught by a lesson. Completion copies these into user_covered_concepts.';

create index lesson_concepts_concept_idx on public.lesson_concepts (concept_id);

-- ---------------------------------------------------------------------------
-- Access control: users read their own lessons and derived rows only.
-- ---------------------------------------------------------------------------
alter table public.lessons enable row level security;
alter table public.lesson_takeaways enable row level security;
alter table public.lesson_sources enable row level security;
alter table public.lesson_concepts enable row level security;

create policy lessons_select_own
  on public.lessons for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_takeaways_select_own
  on public.lesson_takeaways for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.user_id = (select auth.uid())
    )
  );

create policy lesson_sources_select_own
  on public.lesson_sources for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.user_id = (select auth.uid())
    )
  );

create policy lesson_concepts_select_own
  on public.lesson_concepts for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.user_id = (select auth.uid())
    )
  );
