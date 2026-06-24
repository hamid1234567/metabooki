-- Every Word import must remain an independent book instance.
-- A checksum can identify identical file bytes, but it must never be used as
-- the unique identity for a book or for a confirmed import project.
alter table public.book_import_projects
  drop constraint if exists book_import_projects_owner_id_source_checksum_key;

create index if not exists book_import_projects_owner_checksum_idx
  on public.book_import_projects(owner_id, source_checksum);

