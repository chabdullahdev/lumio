-- LUMIO — 16: close the remaining advisor findings.
--
-- 1. rls_auto_enable() is the platform's event-trigger helper. Nothing should
--    call it through the API, so remove EXECUTE from the API roles (event
--    triggers keep working: they run as the function owner).
-- 2. Add covering indexes for the nine foreign keys the performance advisor
--    flagged, so deletes/joins on those parents do not scan the child tables.
-- 3. Document that the tables with RLS enabled and no policy are deliberately
--    backend-only: the app never reads them, and "no policy" means "no access"
--    for anon/authenticated. The service role (workers) bypasses RLS.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists categories_reviewed_by_idx on public.categories (reviewed_by);
create index if not exists lesson_queue_lesson_idx on public.lesson_queue (lesson_id);
create index if not exists lesson_sources_section_idx on public.lesson_sources (section_id);
create index if not exists lessons_primary_category_idx on public.lessons (primary_category_id);
create index if not exists licensing_records_reviewed_by_idx on public.licensing_records (reviewed_by);
create index if not exists review_items_passage_idx on public.review_items (passage_id);
create index if not exists review_items_resolved_by_idx on public.review_items (resolved_by);
create index if not exists user_covered_concepts_first_lesson_idx on public.user_covered_concepts (first_lesson_id);
create index if not exists user_lesson_progress_lesson_idx on public.user_lesson_progress (lesson_id);

comment on table public.concepts is
  'Discrete learnable ideas. Backend-only: RLS on with no policy, so the app cannot read it directly.';
comment on table public.category_concepts is
  'Concept-to-category links. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.concept_relations is
  'Directed concept graph. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.passage_concepts is
  'Passage-to-concept links. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.source_sections is
  'Chapters of each source. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.jobs is
  'Work queue. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.job_events is
  'Job audit trail. Backend-only: RLS on with no policy (workers use the service role).';
comment on table public.review_items is
  'Human review queue. Backend-only: RLS on with no policy (workers use the service role).';
