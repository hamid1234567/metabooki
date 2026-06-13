-- Public catalog pages must work without an authenticated session.
-- RLS still limits books to published/approved rows and comments to visible rows.
grant usage on schema public to anon, authenticated;
grant select on table public.books to anon, authenticated;
grant select on table public.publisher_profiles to anon, authenticated;
grant select on table public.book_series to anon, authenticated;
grant select on table public.book_comments to anon, authenticated;

drop policy if exists "Public reads published books" on public.books;
create policy "Public reads published books"
on public.books
for select
to anon, authenticated
using (status = 'published' and review_status = 'approved');

drop policy if exists "Public reads visible comments" on public.book_comments;
create policy "Public reads visible comments"
on public.book_comments
for select
to anon, authenticated
using (not is_hidden);

drop policy if exists "Public views publishers" on public.publisher_profiles;
create policy "Public views publishers"
on public.publisher_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Public views series" on public.book_series;
create policy "Public views series"
on public.book_series
for select
to anon, authenticated
using (true);
