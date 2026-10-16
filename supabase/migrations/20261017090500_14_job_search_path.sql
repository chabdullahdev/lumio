-- LUMIO — 14: job-function search path hygiene.
--
-- The advisor flags the job-protocol functions from migrations 09/12 as
-- "function search path mutable": they were created without an explicit
-- `search_path`, so a caller able to create objects earlier on the path could
-- shadow what they resolve. They are service-role-only already; this makes
-- them match the rest of the schema (`set search_path = ''`, with everything
-- schema-qualified — pg_catalog builtins are unaffected).
--
-- Recreation only; signatures and behaviour are unchanged, and privileges
-- survive `create or replace` (the revokes below are idempotent reminders).

create or replace function public.claim_jobs(p_worker text, p_limit integer default 1)
returns setof public.jobs
language sql
set search_path = ''
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

create or replace function public.complete_job(p_job_id uuid)
returns void
language plpgsql
set search_path = ''
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

create or replace function public.fail_job(p_job_id uuid, p_error text)
returns public.job_status
language plpgsql
set search_path = ''
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

create or replace function public.enqueue_replenish_jobs(p_limit integer default 20)
returns integer
language plpgsql
set search_path = ''
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

create or replace function public.dead_letter_job(p_job_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.jobs
     set status = 'dead',
         last_error = left(p_reason, 2000),
         finished_at = now(),
         locked_at = null,
         locked_by = null
   where id = p_job_id
     and status = 'running';

  if not found then
    return;
  end if;

  insert into public.job_events (job_id, event, detail)
  values (
    p_job_id,
    'dead',
    jsonb_build_object('error', left(p_reason, 2000), 'terminal', true)
  );
end;
$$;

revoke execute on function public.claim_jobs(text, integer) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.enqueue_replenish_jobs(integer) from public, anon, authenticated;
revoke execute on function public.dead_letter_job(uuid, text) from public, anon, authenticated;
