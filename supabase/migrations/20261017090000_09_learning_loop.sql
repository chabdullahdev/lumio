-- LUMIO — 09: the learning loop.
--
-- Server-side pieces that make the client flow trustworthy:
--
--   * on_lesson_completed — a trigger on user_lesson_progress that, exactly
--     once per lesson per user, updates reading_activity, user_streaks and
--     user_covered_concepts, closes the lesson_queue row, and enqueues a
--     replenishment job. Summary tables stay backend-written; the client only
--     records its own reading progress.
--
--   * claim_jobs / complete_job / fail_job — the durable job protocol for
--     workers (FOR UPDATE SKIP LOCKED, attempt counting, backoff, stale lock
--     reclaim, append-only job_events). service_role only.
--
--   * enqueue_replenish_jobs — reconciliation: any onboarded user with fewer
--     than three active queue entries and no open generation job gets one.
--     Called by the worker on every poll, so a user is always covered even if
--     a completion happened while the worker was offline.
--
-- Every function here is service-side: trigger functions are not directly
-- callable, and EXECUTE is revoked from anon/authenticated for the job API.

-- ---------------------------------------------------------------------------
-- 1) Completion side effects.
-- ---------------------------------------------------------------------------
create or replace function public.on_lesson_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_activity_date date;
  v_streak public.user_streaks%rowtype;
  v_new_current integer;
begin
  -- Only the moment completion is first recorded runs the side effects.
  if new.completed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  select coalesce(p.timezone, 'UTC') into v_timezone
    from public.profiles p
   where p.id = new.user_id;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_activity_date := (new.completed_at at time zone v_timezone)::date;

  -- Daily activity: one row per user per local calendar day.
  insert into public.reading_activity (user_id, activity_date, lessons_completed)
  values (new.user_id, v_activity_date, 1)
  on conflict (user_id, activity_date) do update
    set lessons_completed = public.reading_activity.lessons_completed + 1;

  -- Streak: same-day completions do not advance it; a missed day resets the
  -- current streak but never the longest record.
  select * into v_streak
    from public.user_streaks s
   where s.user_id = new.user_id
     for update;

  if not found then
    insert into public.user_streaks (user_id, current_streak, longest_streak, last_completed_on)
    values (new.user_id, 1, 1, v_activity_date);
  else
    if v_streak.last_completed_on = v_activity_date then
      v_new_current := greatest(v_streak.current_streak, 1);
    elsif v_streak.last_completed_on = v_activity_date - 1 then
      v_new_current := v_streak.current_streak + 1;
    else
      v_new_current := 1;
    end if;
    update public.user_streaks
       set current_streak = v_new_current,
           longest_streak = greatest(v_streak.longest_streak, v_new_current),
           last_completed_on = greatest(coalesce(v_streak.last_completed_on, v_activity_date), v_activity_date)
     where user_id = new.user_id;
  end if;

  -- Concept history, copied from the lesson's concept links.
  insert into public.user_covered_concepts (user_id, concept_id, first_lesson_id)
  select new.user_id, lc.concept_id, new.lesson_id
    from public.lesson_concepts lc
   where lc.lesson_id = new.lesson_id
  on conflict (user_id, concept_id) do update
    set last_covered_at = now(),
        times_covered = public.user_covered_concepts.times_covered + 1;

  -- The queue row for this lesson is done (the client may have already set it).
  update public.lesson_queue
     set status = 'completed'
   where user_id = new.user_id
     and lesson_id = new.lesson_id
     and status in ('pending', 'active');

  -- Ask the backend to prepare a replacement. The partial unique index makes
  -- this idempotent: at most one open replenishment per user.
  insert into public.jobs (job_type, payload, priority, idempotency_key)
  values (
    'generate_lesson',
    jsonb_build_object('user_id', new.user_id),
    5,
    'replenish:' || new.user_id::text
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing;

  return new;
end;
$$;

comment on function public.on_lesson_completed() is
  'Records completion side effects (activity, streak, concepts, queue, replenishment job) exactly once per lesson.';

create trigger on_lesson_completed
  after insert or update of completed_at on public.user_lesson_progress
  for each row
  when (new.completed_at is not null)
  execute function public.on_lesson_completed();

-- ---------------------------------------------------------------------------
-- 2) Job protocol (service_role only).
-- ---------------------------------------------------------------------------
create or replace function public.claim_jobs(p_worker text, p_limit integer default 1)
returns setof public.jobs
language sql
as $$
  with claimed as (
    select j.id
      from public.jobs j
     where j.run_at <= now()
       and (
         j.status = 'queued'
         -- Stale locks: a worker that crashed mid-job becomes reclaimable.
         or (j.status = 'running' and j.locked_at < now() - interval '30 minutes')
       )
     order by j.priority desc, j.run_at asc
     limit greatest(1, least(p_limit, 10))
     for update skip locked
  )
  update public.jobs j
     set status = 'running',
         locked_at = now(),
         locked_by = p_worker,
         attempts = j.attempts + 1
    from claimed
   where j.id = claimed.id
  returning j.*;
$$;

comment on function public.claim_jobs(text, integer) is
  'Atomically claims due jobs for a worker (SKIP LOCKED; stale running locks are reclaimable).';

create or replace function public.complete_job(p_job_id uuid)
returns void
language plpgsql
as $$
begin
  update public.jobs
     set status = 'succeeded',
         finished_at = now(),
         locked_at = null,
         locked_by = null,
         -- Freeing the key lets the next replenishment create a fresh job.
         idempotency_key = null
   where id = p_job_id
     and status = 'running';

  insert into public.job_events (job_id, event)
  values (p_job_id, 'succeeded');
end;
$$;

comment on function public.complete_job(uuid) is
  'Marks a running job succeeded and frees its idempotency key.';

create or replace function public.fail_job(p_job_id uuid, p_error text)
returns public.job_status
language plpgsql
as $$
declare
  v_status public.job_status;
begin
  update public.jobs
     set status = case
           when attempts >= max_attempts then 'dead'::public.job_status
           else 'queued'::public.job_status
         end,
         last_error = left(p_error, 2000),
         -- Exponential-ish backoff, capped at 20 minutes.
         run_at = now() + make_interval(
           secs => least(30 * power(2, greatest(attempts - 1, 0))::integer, 1200)
         ),
         locked_at = null,
         locked_by = null,
         finished_at = case when attempts >= max_attempts then now() else null end
   where id = p_job_id
     and status = 'running'
   returning status into v_status;

  if v_status is null then
    return null;
  end if;

  insert into public.job_events (job_id, event, detail)
  values (
    p_job_id,
    case when v_status = 'dead' then 'dead' else 'retry' end,
    jsonb_build_object('error', left(p_error, 2000), 'status', v_status::text)
  );

  return v_status;
end;
$$;

comment on function public.fail_job(uuid, text) is
  'Records a failure: requeues with backoff, or marks the job dead after max_attempts. Returns the new status.';

-- ---------------------------------------------------------------------------
-- 3) Reconciliation: keep every onboarded user's queue at three.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_replenish_jobs(p_limit integer default 20)
returns integer
language plpgsql
as $$
declare
  v_inserted integer;
begin
  with needy as (
    select p.id as user_id
      from public.profiles p
     where p.onboarding_completed_at is not null
       and exists (
         select 1 from public.user_interests ui where ui.user_id = p.id
       )
       and (
         select count(*)
           from public.lesson_queue q
          where q.user_id = p.id
            and q.status in ('pending', 'active')
       ) < 3
       and not exists (
         select 1
           from public.jobs j
          where j.status in ('queued', 'running')
            and j.payload->>'user_id' = p.id::text
       )
     order by p.onboarding_completed_at asc
     limit greatest(1, least(p_limit, 100))
  )
  insert into public.jobs (job_type, payload, priority, idempotency_key)
  select 'generate_lesson', jsonb_build_object('user_id', needy.user_id), 3, 'replenish:' || needy.user_id::text
    from needy
  on conflict (idempotency_key) where idempotency_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.enqueue_replenish_jobs(integer) is
  'Creates one generate_lesson job per onboarded user whose active queue is below three and who has no open job.';

-- ---------------------------------------------------------------------------
-- 4) Access control: service-side only.
-- ---------------------------------------------------------------------------
revoke execute on function public.on_lesson_completed() from public, anon, authenticated;
revoke execute on function public.claim_jobs(text, integer) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.enqueue_replenish_jobs(integer) from public, anon, authenticated;
