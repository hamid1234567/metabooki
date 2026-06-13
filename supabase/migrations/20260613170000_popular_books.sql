create or replace function public.get_popular_book_ids()
returns table(book_id uuid, purchase_count bigint)
language sql
security definer
set search_path = public
as $$
  select b.id, count(ub.id) as purchase_count
  from public.books b
  left join public.user_books ub on ub.book_id = b.id
  where b.status = 'published' and b.review_status = 'approved'
  group by b.id
  order by purchase_count desc, b.updated_at desc
  limit 12;
$$;

grant execute on function public.get_popular_book_ids() to anon, authenticated;
