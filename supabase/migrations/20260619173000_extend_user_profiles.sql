alter table public.profiles
  add column if not exists address_province text,
  add column if not exists address_city text,
  add column if not exists address_district text,
  add column if not exists address_street text,
  add column if not exists address_alley text,
  add column if not exists address_plaque text,
  add column if not exists address_unit text,
  add column if not exists postal_code text,
  add column if not exists address_notes text,
  add column if not exists reading_interests text[] not null default '{}',
  add column if not exists bank_card_number text,
  add column if not exists bank_iban text;

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid());

grant insert on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own profile avatars" on storage.objects;
create policy "Users upload own profile avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars' and storage.foldername(name)[1] = auth.uid()::text);

drop policy if exists "Users update own profile avatars" on storage.objects;
create policy "Users update own profile avatars"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and storage.foldername(name)[1] = auth.uid()::text)
with check (bucket_id = 'profile-avatars' and storage.foldername(name)[1] = auth.uid()::text);

drop policy if exists "Public reads profile avatars" on storage.objects;
create policy "Public reads profile avatars"
on storage.objects for select
using (bucket_id = 'profile-avatars');
