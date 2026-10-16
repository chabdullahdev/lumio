-- LUMIO — 04: dynamic taxonomy and concepts.
--
-- Subjects, subcategories, and concepts are discovered and organized by the
-- AI, reviewed, and stored in these generic tables. There is deliberately no
-- table per subject and no hardcoded category list.
--
-- Categories form a tree (subject -> subcategory -> ...). Concepts are the
-- actual ideas lessons teach; tracking progress by concept (not just lesson)
-- is what lets the system recognize "already learned in another context".
--
-- The knowledge tables are service-only (RLS on, no policies). The one
-- exception: authenticated users may read top-level *approved* categories to
-- pick their interests during onboarding.

create type public.taxonomy_status as enum ('proposed', 'approved', 'rejected');

create type public.concept_relation_kind as enum (
  'prerequisite_of',
  'part_of',
  'related_to',
  'contrasts_with'
);

-- ---------------------------------------------------------------------------
-- categories: self-referencing tree. `parent_id is null` means a top-level
-- subject (the only level users choose from).
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null,
  slug text,
  description text,
  status public.taxonomy_status not null default 'proposed',
  origin text not null default 'ai' check (origin in ('ai', 'manual')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is
  'Dynamically discovered subject/subcategory tree. Top-level approved rows are the broad topics users pick.';

-- NULL parents are distinct in unique constraints, so coalesce to the nil uuid.
create unique index categories_sibling_name_key
  on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create index categories_parent_idx on public.categories (parent_id);
create index categories_status_idx on public.categories (status);

create trigger set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- concepts: discrete ideas tracked for personalization.
-- ---------------------------------------------------------------------------
create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  difficulty smallint check (difficulty between 1 and 5),
  status public.taxonomy_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.concepts is
  'Discrete learnable ideas. Progress and prerequisite logic are tracked at this level.';

create unique index concepts_name_key on public.concepts (lower(name));

create trigger set_updated_at
  before update on public.concepts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Links between the taxonomy, concepts, and passages.
-- ---------------------------------------------------------------------------
create table public.category_concepts (
  category_id uuid not null references public.categories (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  relevance smallint not null default 3 check (relevance between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (category_id, concept_id)
);

comment on table public.category_concepts is
  'Which concepts belong to which category, with relevance weight.';

create index category_concepts_concept_idx on public.category_concepts (concept_id);

create table public.concept_relations (
  from_concept_id uuid not null references public.concepts (id) on delete cascade,
  to_concept_id uuid not null references public.concepts (id) on delete cascade,
  relation public.concept_relation_kind not null,
  strength smallint check (strength between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (from_concept_id, to_concept_id, relation),
  check (from_concept_id <> to_concept_id)
);

comment on table public.concept_relations is
  'Directed concept graph (prerequisites, parts, related ideas). Enables learning-order logic.';

create index concept_relations_to_idx on public.concept_relations (to_concept_id);

create table public.passage_concepts (
  passage_id bigint not null references public.passages (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  method text,                                 -- e.g. 'ai_extraction', 'manual'
  created_at timestamptz not null default now(),
  primary key (passage_id, concept_id)
);

comment on table public.passage_concepts is
  'Which concepts a passage covers. Lets any concept be found across all sources that discuss it.';

create index passage_concepts_concept_idx on public.passage_concepts (concept_id);

-- ---------------------------------------------------------------------------
-- user_interests: the broad topics a user picked during onboarding.
-- ---------------------------------------------------------------------------
create table public.user_interests (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  weight smallint not null default 3 check (weight between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

comment on table public.user_interests is
  'Broad topics chosen by the user. Personalization starts here.';

create index user_interests_category_idx on public.user_interests (category_id);

-- ---------------------------------------------------------------------------
-- Access control.
-- ---------------------------------------------------------------------------

-- Knowledge tables: service-only.
alter table public.categories enable row level security;
alter table public.concepts enable row level security;
alter table public.category_concepts enable row level security;
alter table public.concept_relations enable row level security;
alter table public.passage_concepts enable row level security;

-- One deliberate exception: authenticated users may read top-level approved
-- categories (the broad subjects shown during onboarding).
create policy categories_select_top_level_approved
  on public.categories for select
  to authenticated
  using (parent_id is null and status = 'approved');

-- User interests: own rows only. Inserts are limited to approved top-level
-- categories so the app cannot attach interests to unreviewed taxonomy.
alter table public.user_interests enable row level security;

create policy user_interests_select_own
  on public.user_interests for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_interests_insert_own
  on public.user_interests for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.categories c
      where c.id = category_id
        and c.parent_id is null
        and c.status = 'approved'
    )
  );

create policy user_interests_update_own
  on public.user_interests for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_interests_delete_own
  on public.user_interests for delete
  to authenticated
  using ((select auth.uid()) = user_id);
