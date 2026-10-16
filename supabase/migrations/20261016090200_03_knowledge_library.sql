-- LUMIO — 03: knowledge library (sources, licensing, structure, passages).
--
-- The shared, growing library of learning material. Source structure (books,
-- chapters, sections) is preserved separately from the searchable passage
-- units so personalization never has to know about files or chapters.
--
-- All tables here are service-only: RLS is enabled with no client policies,
-- so the mobile app cannot read raw library content. The backend (service
-- role) and future API layer are the only consumers.

create type public.source_kind as enum ('book', 'article', 'report', 'lecture', 'other');

create type public.processing_status as enum (
  'discovered',      -- candidate found, not yet validated
  'validated',       -- file integrity + metadata + licensing checked
  'rejected',        -- duplicate, irrelevant, corrupted, or rights unclear
  'extracting',      -- text/OCR extraction in progress
  'extracted',       -- text extracted, structure being rebuilt
  'organizing',      -- concepts/categories/passages being identified
  'ready',           -- usable for lesson generation
  'needs_review',    -- flagged for human review
  'failed'           -- processing failed (retryable via jobs)
);

create type public.license_type as enum (
  'public_domain',
  'cc_by',
  'cc_by_sa',
  'cc_by_nc',
  'cc_by_nd',
  'permission_granted',
  'purchased',
  'unknown'
);

create type public.approval_status as enum ('pending_review', 'approved', 'rejected');

create type public.section_kind as enum (
  'front_matter',
  'chapter',
  'section',
  'subsection',
  'appendix',
  'glossary',
  'index',
  'other'
);

-- ---------------------------------------------------------------------------
-- sources: one row per acquired file/edition of learning material.
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  kind public.source_kind not null default 'book',
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  edition text,
  publisher text,
  published_year integer check (published_year between 800 and 2200),
  language text,
  source_url text,
  acquisition_notes text,
  file_sha256 text unique,                     -- dedupe key; null until the file is downloaded
  file_format text,
  file_size_bytes bigint check (file_size_bytes >= 0),
  page_count integer check (page_count > 0),
  original_storage_path text,                  -- path in the library-originals bucket
  processed_storage_path text,                 -- path in the library-processed bucket
  processing_status public.processing_status not null default 'discovered',
  extraction_quality numeric(3, 2) check (extraction_quality between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sources is
  'Acquired learning material (books and other sources) with preserved metadata.';

create index sources_processing_status_idx on public.sources (processing_status);

create trigger set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- licensing_records: audit trail of why a source may legally be used.
-- Multiple rows per source are allowed: the history matters.
-- ---------------------------------------------------------------------------
create table public.licensing_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  license_type public.license_type not null default 'unknown',
  rights_holder text,
  license_url text,
  evidence_storage_path text,                  -- path in the licensing-evidence bucket
  status public.approval_status not null default 'pending_review',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.licensing_records is
  'Usage-rights evidence per source. A source is only usable once an approved record exists.';

create index licensing_records_source_idx on public.licensing_records (source_id);

create trigger set_updated_at
  before update on public.licensing_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- source_sections: the original chapter/heading tree of a source.
-- ---------------------------------------------------------------------------
create table public.source_sections (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  parent_id uuid references public.source_sections (id) on delete cascade,
  kind public.section_kind not null default 'section',
  title text,
  ordinal integer not null,                    -- position among siblings
  depth integer not null default 0 check (depth >= 0),
  page_start integer check (page_start > 0),
  page_end integer check (page_end >= page_start),
  created_at timestamptz not null default now()
);

comment on table public.source_sections is
  'Original document structure (chapters/sections) preserved from the source file.';

-- NULL parents are distinct in unique constraints, so coalesce to the nil uuid.
create unique index source_sections_sibling_ordinal_key
  on public.source_sections (source_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), ordinal);

create index source_sections_parent_idx on public.source_sections (parent_id);

-- ---------------------------------------------------------------------------
-- passages: the searchable text units lessons are grounded in.
-- ---------------------------------------------------------------------------
create table public.passages (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.sources (id) on delete cascade,
  section_id uuid references public.source_sections (id) on delete set null,
  ordinal integer not null,                    -- position within the source
  content text not null,
  language text,
  page_start integer check (page_start > 0),
  page_end integer check (page_end >= page_start),
  token_count integer check (token_count >= 0),
  embedding extensions.vector(768),            -- matches the initial embedding model
  embedding_model text,
  content_tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  unique (source_id, ordinal)
);

comment on table public.passages is
  'Searchable text units with page references. Retrieval is hybrid: full-text (content_tsv) + vector (embedding).';
comment on column public.passages.embedding is
  'Passage embedding (768 dimensions). The embedding_model column records which model produced it.';

create index passages_source_idx on public.passages (source_id);
create index passages_section_idx on public.passages (section_id);
create index passages_tsv_idx on public.passages using gin (content_tsv);
create index passages_embedding_idx
  on public.passages using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Service-only access: RLS on, no client policies (deny by default).
-- ---------------------------------------------------------------------------
alter table public.sources enable row level security;
alter table public.licensing_records enable row level security;
alter table public.source_sections enable row level security;
alter table public.passages enable row level security;
