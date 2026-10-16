-- LUMIO — 01: shared extensions and helper functions.
--
-- Everything that later migrations rely on:
--   * pgvector, storing passage embeddings for semantic retrieval
--   * public.set_updated_at(), the `updated_at` bookkeeping trigger
--
-- Note: on the hosted project pgvector is superuser-only to install, so it
-- must be enabled once via Dashboard → Database → Extensions (schema
-- `extensions`). This statement then no-ops; `if not exists` also keeps
-- self-installing environments (local stack) working unchanged.

create extension if not exists vector with schema extensions;

-- Keep an `updated_at` column current on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper: stamps updated_at with now() before an update.';
