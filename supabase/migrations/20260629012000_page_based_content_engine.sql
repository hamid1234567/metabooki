create table if not exists public.book_content_manifests (
  book_id uuid primary key references public.books(id) on delete cascade,
  schema_version text not null default '2.0-page',
  page_count integer not null default 0 check (page_count >= 0),
  toc jsonb not null default '[]'::jsonb,
  assets_summary jsonb not null default '[]'::jsonb,
  search_ready boolean not null default false,
  content_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.book_pages (
  book_id uuid not null references public.books(id) on delete cascade,
  page_index integer not null check (page_index >= 0),
  page_id text not null,
  print_number text,
  title text,
  blocks jsonb not null default '[]'::jsonb,
  plain_text text not null default '',
  asset_ids text[] not null default '{}',
  content_hash text,
  updated_at timestamptz not null default now(),
  primary key (book_id, page_index)
);

create table if not exists public.book_assets (
  book_id uuid not null references public.books(id) on delete cascade,
  asset_id text not null,
  page_index integer,
  block_id text,
  url text not null,
  caption text,
  caption_inline jsonb,
  status text not null default 'ready',
  issue text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (book_id, asset_id)
);

create table if not exists public.book_search_index (
  book_id uuid not null references public.books(id) on delete cascade,
  page_index integer not null check (page_index >= 0),
  plain_text text not null default '',
  headings text not null default '',
  updated_at timestamptz not null default now(),
  primary key (book_id, page_index)
);

create index if not exists book_pages_book_updated_idx on public.book_pages(book_id, updated_at desc);
create index if not exists book_assets_book_page_idx on public.book_assets(book_id, page_index);
create index if not exists book_search_index_book_text_idx on public.book_search_index using gin (to_tsvector('simple', plain_text));

create or replace function public.can_read_book_content(target_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    left join public.publisher_profiles p on p.id = b.publisher_id
    where b.id = target_book_id
      and (
        (b.status = 'published' and b.review_status = 'approved')
        or p.user_id = auth.uid()
        or exists (
          select 1 from public.user_books ub
          where ub.book_id = b.id and ub.user_id = auth.uid()
        )
        or public.is_admin(auth.uid())
      )
  );
$$;

create or replace function public.can_write_book_content(target_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    join public.publisher_profiles p on p.id = b.publisher_id
    where b.id = target_book_id
      and p.user_id = auth.uid()
      and (
        b.status <> 'published'
        or not exists (select 1 from public.user_books ub where ub.book_id = b.id)
      )
  );
$$;

alter table public.book_content_manifests enable row level security;
alter table public.book_pages enable row level security;
alter table public.book_assets enable row level security;
alter table public.book_search_index enable row level security;

drop policy if exists "Read allowed book manifests" on public.book_content_manifests;
create policy "Read allowed book manifests" on public.book_content_manifests
for select to anon, authenticated
using (public.can_read_book_content(book_id));

drop policy if exists "Write own book manifests" on public.book_content_manifests;
create policy "Write own book manifests" on public.book_content_manifests
for all to authenticated
using (public.can_write_book_content(book_id))
with check (public.can_write_book_content(book_id));

drop policy if exists "Read allowed book pages" on public.book_pages;
create policy "Read allowed book pages" on public.book_pages
for select to anon, authenticated
using (public.can_read_book_content(book_id));

drop policy if exists "Write own book pages" on public.book_pages;
create policy "Write own book pages" on public.book_pages
for all to authenticated
using (public.can_write_book_content(book_id))
with check (public.can_write_book_content(book_id));

drop policy if exists "Read allowed book assets" on public.book_assets;
create policy "Read allowed book assets" on public.book_assets
for select to anon, authenticated
using (public.can_read_book_content(book_id));

drop policy if exists "Write own book assets" on public.book_assets;
create policy "Write own book assets" on public.book_assets
for all to authenticated
using (public.can_write_book_content(book_id))
with check (public.can_write_book_content(book_id));

drop policy if exists "Read allowed book search" on public.book_search_index;
create policy "Read allowed book search" on public.book_search_index
for select to anon, authenticated
using (public.can_read_book_content(book_id));

drop policy if exists "Write own book search" on public.book_search_index;
create policy "Write own book search" on public.book_search_index
for all to authenticated
using (public.can_write_book_content(book_id))
with check (public.can_write_book_content(book_id));

grant select on public.book_content_manifests, public.book_pages, public.book_assets, public.book_search_index to anon, authenticated;
grant insert, update, delete on public.book_content_manifests, public.book_pages, public.book_assets, public.book_search_index to authenticated;
grant execute on function public.can_read_book_content(uuid) to anon, authenticated;
grant execute on function public.can_write_book_content(uuid) to authenticated;

create or replace function public.get_book_page_window(
  target_book_id uuid,
  center_page integer default 0,
  before_count integer default 10,
  after_count integer default 40
)
returns table (
  page_index integer,
  page_id text,
  print_number text,
  title text,
  blocks jsonb,
  plain_text text,
  asset_ids text[],
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.page_index,
    p.page_id,
    p.print_number,
    p.title,
    p.blocks,
    p.plain_text,
    p.asset_ids,
    p.updated_at
  from public.book_pages p
  where p.book_id = target_book_id
    and public.can_read_book_content(target_book_id)
    and p.page_index between greatest(0, center_page - greatest(0, before_count))
      and center_page + greatest(0, after_count)
  order by p.page_index asc;
$$;

grant execute on function public.get_book_page_window(uuid, integer, integer, integer) to anon, authenticated;

alter publication supabase_realtime add table public.book_content_manifests;
alter publication supabase_realtime add table public.book_pages;
