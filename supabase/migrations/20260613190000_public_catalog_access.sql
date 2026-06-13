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

-- Management policies must never run for anonymous catalog reads.
drop policy if exists "Publishers manage own books" on public.books;
create policy "Publishers manage own books"
on public.books
for all
to authenticated
using (
  exists (
    select 1 from public.publisher_profiles p
    where p.id = publisher_id and p.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
)
with check (
  exists (
    select 1 from public.publisher_profiles p
    where p.id = publisher_id and p.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

drop policy if exists "Publishers manage own series" on public.book_series;
create policy "Publishers manage own series"
on public.book_series
for all
to authenticated
using (
  exists (
    select 1 from public.publisher_profiles p
    where p.id = publisher_id and p.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
)
with check (
  exists (
    select 1 from public.publisher_profiles p
    where p.id = publisher_id and p.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);
