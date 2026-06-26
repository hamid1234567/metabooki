-- Publisher drafts and assets belong to their publisher profile.
-- Admins can audit catalog state through read policies/admin views, but they must not
-- edit another publisher's unpublished book assets from the client.

drop policy if exists "Publishers manage own books" on public.books;
create policy "Publishers manage own books"
on public.books
for all
to authenticated
using (
  exists (
    select 1
    from public.publisher_profiles p
    where p.id = publisher_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.publisher_profiles p
    where p.id = publisher_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Publishers manage own series" on public.book_series;
create policy "Publishers manage own series"
on public.book_series
for all
to authenticated
using (
  exists (
    select 1
    from public.publisher_profiles p
    where p.id = publisher_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.publisher_profiles p
    where p.id = publisher_id
      and p.user_id = auth.uid()
  )
);
