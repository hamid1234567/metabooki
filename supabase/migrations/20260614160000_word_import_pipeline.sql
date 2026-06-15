-- Private Word-import pipeline. Source files stay private and are only uploaded
-- after the publisher confirms the local preview.
create table if not exists public.book_import_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  publisher_id uuid not null references public.publisher_profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null,
  status text not null default 'uploading'
    check (status in ('uploading','queued','processing','needs_review','ready','failed','cancelled')),
  source_name text not null,
  source_size bigint not null check (source_size between 1 and 209715200),
  source_checksum text not null,
  local_analysis jsonb not null default '{}'::jsonb,
  server_analysis jsonb,
  conversion_diff jsonb,
  complexity_score int not null default 0,
  complexity_grade text,
  estimated_credits int not null default 0,
  final_credits int,
  error_message text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_checksum)
);

create table if not exists public.book_import_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.book_import_projects(id) on delete cascade,
  job_type text not null default 'validate_and_convert',
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  progress int not null default 0 check (progress between 0 and 100),
  attempts int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_import_projects_owner_idx on public.book_import_projects(owner_id, created_at desc);
create index if not exists book_import_jobs_queue_idx on public.book_import_jobs(status, created_at);

alter table public.book_import_projects enable row level security;
alter table public.book_import_jobs enable row level security;

drop policy if exists "Owners manage import projects" on public.book_import_projects;
create policy "Owners manage import projects" on public.book_import_projects for all to authenticated
using (owner_id = auth.uid() or public.is_admin(auth.uid()))
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Owners view import jobs" on public.book_import_jobs;
create policy "Owners view import jobs" on public.book_import_jobs for select to authenticated
using (exists(select 1 from public.book_import_projects p where p.id = project_id and (p.owner_id = auth.uid() or public.is_admin(auth.uid()))));

grant select, insert, update, delete on public.book_import_projects to authenticated;
grant select on public.book_import_jobs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-imports', 'book-imports', false, 209715200, null)
on conflict (id) do update set public = false, file_size_limit = 209715200;

drop policy if exists "Owners upload private book imports" on storage.objects;
create policy "Owners upload private book imports" on storage.objects for insert to authenticated
with check (bucket_id = 'book-imports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Owners update private book imports" on storage.objects;
create policy "Owners update private book imports" on storage.objects for update to authenticated
using (bucket_id = 'book-imports' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'book-imports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Owners read private book imports" on storage.objects;
create policy "Owners read private book imports" on storage.objects for select to authenticated
using (bucket_id = 'book-imports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));
drop policy if exists "Owners delete private book imports" on storage.objects;
create policy "Owners delete private book imports" on storage.objects for delete to authenticated
using (bucket_id = 'book-imports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));

create or replace function public.enqueue_book_import_job() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'queued' and old.status is distinct from 'queued' then
    insert into public.book_import_jobs(project_id, payload)
    values(new.id, jsonb_build_object('source_checksum', new.source_checksum, 'use_local_analysis', true));
  end if;
  return new;
end $$;

drop trigger if exists enqueue_book_import_after_upload on public.book_import_projects;
create trigger enqueue_book_import_after_upload
after update of status on public.book_import_projects
for each row execute function public.enqueue_book_import_job();
