-- Cat Go shared map photo storage.
-- The Edge Function uses the service-role key for uploads; never expose it to the client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cat-sightings', 'cat-sightings', true, 1572864, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
