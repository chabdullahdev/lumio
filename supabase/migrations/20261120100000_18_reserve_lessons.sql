-- LUMIO — 18: refill a reader's queue from lessons that are already written.
--
-- Lessons can be written ahead of time (by the generation worker or by hand) and
-- stored as `ready` without a queue row. This keeps each reader's queue at up to
-- three lessons by moving the oldest such "reserve" lesson into a free position
-- whenever a queue entry is finished, skipped or replaced. No AI or worker is
-- needed for this step.
--
-- A lesson is only promoted when it
--   * belongs to that reader and is `ready`,
--   * has never been in that reader's queue (so a finished or skipped lesson
--     never comes back), and
--   * has not been completed.

create or replace function public.promote_reserve_lessons(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position smallint;
  v_lesson uuid;
  v_moved integer := 0;
begin
  -- Serialise per reader so two finishing lessons cannot pick the same position.
  perform pg_advisory_xact_lock(hashtextextended('promote_reserve_lessons:' || p_user_id::text, 0));

  for v_position in 1..3 loop
    -- Skip positions that are already taken.
    continue when exists (
      select 1 from public.lesson_queue q
       where q.user_id = p_user_id and q.status in ('pending', 'active') and q.position = v_position
    );

    select l.id into v_lesson
      from public.lessons l
     where l.user_id = p_user_id
       and l.status = 'ready'
       and not exists (select 1 from public.lesson_queue q where q.user_id = p_user_id and q.lesson_id = l.id)
       and not exists (
         select 1 from public.user_lesson_progress p
          where p.user_id = p_user_id and p.lesson_id = l.id and p.completed_at is not null
       )
     order by l.created_at, l.id
     limit 1;

    exit when v_lesson is null;

    insert into public.lesson_queue (user_id, lesson_id, position, status)
    values (p_user_id, v_lesson, v_position, 'pending')
    on conflict do nothing;
    v_moved := v_moved + 1;
    v_lesson := null;
  end loop;

  return v_moved;
end;
$$;

comment on function public.promote_reserve_lessons(uuid) is
  'Moves a reader''s already-written, never-queued ready lessons into free queue positions (max three pending/active).';

-- Internal only: called by the trigger below and by the service role.
revoke execute on function public.promote_reserve_lessons(uuid) from public, anon, authenticated;

create or replace function public.on_queue_entry_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('pending', 'active') and new.status not in ('pending', 'active') then
    perform public.promote_reserve_lessons(new.user_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.on_queue_entry_finished() from public, anon, authenticated;

create trigger promote_reserve_after_queue_change
  after update of status on public.lesson_queue
  for each row execute function public.on_queue_entry_finished();
