create table if not exists public.book_filter_settings (
  id integer primary key default 1,
  categories jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  book_types jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint book_filter_settings_singleton check (id = 1)
);

insert into public.book_filter_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.book_filter_settings enable row level security;

drop policy if exists "Anyone can view book filter settings" on public.book_filter_settings;
create policy "Anyone can view book filter settings" on public.book_filter_settings
for select to anon, authenticated using (true);

drop policy if exists "Admins can manage book filter settings" on public.book_filter_settings;
create policy "Admins can manage book filter settings" on public.book_filter_settings
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select on public.book_filter_settings to anon, authenticated;
grant insert, update, delete on public.book_filter_settings to authenticated;
