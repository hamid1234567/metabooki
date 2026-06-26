create or replace function public.get_my_publisher_books()
returns table (
  id uuid,
  title text,
  subtitle text,
  description text,
  cover_url text,
  back_cover_url text,
  preview_pages integer[],
  price integer,
  status text,
  review_status text,
  publisher_id uuid,
  language text,
  tags text[],
  metadata jsonb,
  series_id uuid,
  series_order integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.subtitle,
    b.description,
    b.cover_url,
    b.back_cover_url,
    b.preview_pages,
    b.price,
    b.status,
    b.review_status,
    b.publisher_id,
    b.language,
    b.tags,
    jsonb_strip_nulls(jsonb_build_object(
      'category', b.metadata ->> 'category',
      'publisher_name', b.metadata ->> 'publisher_name',
      'book_type', b.metadata -> 'book_type',
      'author', b.metadata ->> 'author',
      'page_count', b.metadata ->> 'page_count',
      'print_page_count', b.metadata ->> 'print_page_count',
      'total_pages', b.metadata ->> 'total_pages',
      'total_source_pages', b.metadata ->> 'total_source_pages',
      'import_project_id', b.metadata ->> 'import_project_id',
      'opening_sample', b.metadata ->> 'opening_sample',
      'sample', b.metadata ->> 'sample'
    )) as metadata,
    b.series_id,
    b.series_order,
    b.created_at
  from public.publisher_profiles p
  join public.books b on b.publisher_id = p.id
  where p.user_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.get_my_publisher_books() to authenticated;
