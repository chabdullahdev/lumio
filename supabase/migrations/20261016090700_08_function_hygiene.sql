-- LUMIO — 08: function hygiene (search_path and EXECUTE grants).
--
-- Clears the two WARN-level advisor notes that concern LUMIO-owned functions
-- (see docs/SETUP.md §4). Nothing else changes.
--
--   * set_updated_at: give it an explicit empty search_path. Its body only
--     touches NEW and now(), and pg_catalog is always searched first — even
--     when search_path is empty — so the 12 updated_at triggers keep working
--     exactly as before.
--   * handle_new_user: revoke EXECUTE from PUBLIC and the client roles.
--     Trigger invocation does not check the EXECUTE grant, so the auth
--     signup trigger keeps firing unchanged.
--
-- rls_auto_enable() is Supabase-managed and is deliberately left untouched.

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
