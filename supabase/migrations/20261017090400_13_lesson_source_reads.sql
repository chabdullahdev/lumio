-- LUMIO — 13: lesson traceability reads for owners.
--
-- The reader shows, at the end of each lesson, which sources the lesson was
-- grounded in (title, author line, licence, page range). The client reads
-- those fields through embeds of `lesson_sources` -> `sources` /
-- `licensing_records` / `passages`. Those three tables are service-only (RLS
-- on, no policies), so under RLS the embeds returned null and the app could
-- not display any attribution.
--
-- These policies expose exactly the rows a user already "owns" through their
-- own lessons: a source, licence, or passage is visible only while referenced
-- by a lesson belonging to the reader. The rest of the library stays
-- deny-by-default, and nothing here is writable by clients.
--
-- Note on evaluation: the exists() subqueries run as the querying user and
-- therefore use the existing own-row policies on `lesson_sources` and
-- `lessons`. Indexes on lesson_sources (lesson_id, passage_id, source_id) and
-- licensing_records (source_id) keep the checks cheap.

create policy sources_select_owned_lesson
  on public.sources for select
  to authenticated
  using (
    exists (
      select 1
        from public.lesson_sources ls
        join public.lessons l on l.id = ls.lesson_id
       where ls.source_id = sources.id
         and l.user_id = (select auth.uid())
    )
  );

create policy licensing_records_select_owned_lesson
  on public.licensing_records for select
  to authenticated
  using (
    exists (
      select 1
        from public.lesson_sources ls
        join public.lessons l on l.id = ls.lesson_id
       where ls.source_id = licensing_records.source_id
         and l.user_id = (select auth.uid())
    )
  );

create policy passages_select_owned_lesson
  on public.passages for select
  to authenticated
  using (
    exists (
      select 1
        from public.lesson_sources ls
        join public.lessons l on l.id = ls.lesson_id
       where ls.passage_id = passages.id
         and l.user_id = (select auth.uid())
    )
  );
