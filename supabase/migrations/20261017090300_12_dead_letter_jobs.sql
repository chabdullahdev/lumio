-- LUMIO — 12: terminal job failures (dead-letter).
--
-- `fail_job` retries with backoff and only gives up after max_attempts. Some
-- failures, however, are terminal on the first attempt: "there is not enough
-- approved library material for this user" does not become true by retrying.
--
-- `dead_letter_job` marks such a job dead immediately and — deliberately —
-- KEEPS its idempotency_key. Both the completion trigger and the worker's
-- reconciliation enqueue with `on conflict (idempotency_key) do nothing`, so a
-- kept key means the system stops re-enqueueing for that user until a human
-- investigates (dead jobs are the observability signal; `last_error` and the
-- `job_events` row carry the reason). To re-enable generation for a user,
-- resolve the cause and clear the key or set the job back to 'queued'.
--
-- Service-side only: EXECUTE is revoked from anon/authenticated.

create or replace function public.dead_letter_job(p_job_id uuid, p_reason text)
returns void
language plpgsql
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

comment on function public.dead_letter_job(uuid, text) is
  'Marks a running job dead immediately, keeping its idempotency key so reconciliation does not re-enqueue it.';

revoke execute on function public.dead_letter_job(uuid, text) from public, anon, authenticated;
