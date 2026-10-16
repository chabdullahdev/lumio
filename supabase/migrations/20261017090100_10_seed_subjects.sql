-- LUMIO — 10: seed the top-level subjects.
--
-- The broad topics users choose during onboarding. These are manual, reviewed
-- top-level categories (status = approved), so they are the exact rows the
-- categories_select_top_level_approved policy exposes to the app.
--
-- Idempotent: re-applying inserts nothing (sibling name uniqueness).

insert into public.categories (parent_id, name, slug, description, status, origin)
values
  (null, 'Science', 'science',
   'How the natural world works — from cells to climate.', 'approved', 'manual'),
  (null, 'History', 'history',
   'People, ideas and events that shaped the world we live in.', 'approved', 'manual'),
  (null, 'Psychology', 'psychology',
   'How the mind learns, remembers, decides and feels.', 'approved', 'manual'),
  (null, 'Islam', 'islam',
   'Islamic history, thought, scholarship and civilisation.', 'approved', 'manual'),
  (null, 'Geopolitics', 'geopolitics',
   'Geography, resources and power between nations.', 'approved', 'manual'),
  (null, 'Politics', 'politics',
   'How societies govern themselves and resolve disagreement.', 'approved', 'manual')
on conflict (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
do nothing;
