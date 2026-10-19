-- Public read bucket for Android app releases (auto-update).
--
-- The mobile app's updater fetches `latest.json` and the APK from here without
-- authenticating. Uploads are done by `scripts/publish-android-release.mjs`
-- with the service-role key, which bypasses RLS.
--
-- Everything in this bucket is public by design (it is shipped to devices).
-- Only signed APKs and the release manifest belong here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  true,
  262144000, -- 250 MB, comfortably above the current ~60 MB APK
  array['application/vnd.android.package-archive', 'application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
