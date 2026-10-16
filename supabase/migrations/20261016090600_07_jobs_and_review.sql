-- LUMIO — 07: background jobs, review queue, storage buckets.
--
-- The job table is the durable backbone for every background worker: book
-- ingestion, OCR, embeddings, concept extraction, lesson generation, and
-- queue replenishment. Jobs are persistent, retried with limits, and made
-- idempotent through idempotency_key.
--
-- review_items is the human-review queue for anything the system must not
-- decide alone: unclear licensing, suspicious extraction, conflicting
-- metadata, questionable lesson quality.
--
-- Everything here is service-only (RLS on, no policies).

create type public.job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',      -- failed, retryable
  'dead',        -- exceeded max_attempts; needs attention
  'canceled'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,                      -- e.g. 'ingest_source', 'generate_lesson'
  status public.job_status not null default 'queued',
  priority smallint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,                        -- optional; unique when present
  attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 5 check (max_attempts > 0),
  run_at timestamptz not null default now(),   -- earliest time to run (backoff)
  locked_at timestamptz,                       -- set while running; stale locks are reclaimable
  locked_by text,                              -- worker identity
  last_error text,
  checkpoint jsonb,                            -- resume state for interrupted jobs
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.jobs is
  'Durable background job queue. Claiming uses FOR UPDATE SKIP LOCKED; idempotency_key prevents duplicate work.';
comment on column public.jobs.checkpoint is
  'Stage-level progress so a failed job resumes instead of repeating expensive steps.';

create unique index jobs_idempotency_key_key
  on public.jobs (idempotency_key)
  where idempotency_key is not null;

create index jobs_due_idx on public.jobs (run_at) where status = 'queued';

create index jobs_stale_lock_idx on public.jobs (locked_at) where status = 'running';

create index jobs_type_status_idx on public.jobs (job_type, status);

create trigger set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  event text not null,                         -- e.g. 'claimed', 'retry', 'failed', 'succeeded'
  detail jsonb,
  created_at timestamptz not null default now()
);

comment on table public.job_events is
  'Append-only job history for observability and debugging.';

create index job_events_job_idx on public.job_events (job_id);

-- ---------------------------------------------------------------------------
-- review_items: cases a human must look at.
-- ---------------------------------------------------------------------------
create type public.review_item_kind as enum (
  'licensing',
  'extraction',
  'metadata',
  'concept',
  'lesson_quality',
  'other'
);

create type public.review_item_status as enum ('open', 'in_review', 'resolved', 'dismissed');

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  kind public.review_item_kind not null,
  source_id uuid references public.sources (id) on delete cascade,
  passage_id bigint references public.passages (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  reason text not null,
  details jsonb,
  status public.review_item_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_id is not null or passage_id is not null or lesson_id is not null)
);

comment on table public.review_items is
  'Human-review queue: unclear rights, extraction problems, conflicting metadata, quality concerns.';

create index review_items_status_idx on public.review_items (status);
create index review_items_source_idx on public.review_items (source_id);
create index review_items_lesson_idx on public.review_items (lesson_id);

create trigger set_updated_at
  before update on public.review_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets: private, service-role access only (no storage policies).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('library-originals', 'library-originals', false),
  ('library-processed', 'library-processed', false),
  ('licensing-evidence', 'licensing-evidence', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Access control: service-only everywhere in this migration.
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.review_items enable row level security;
