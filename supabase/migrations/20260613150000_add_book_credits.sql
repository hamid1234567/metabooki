with ranked as (
  select id, row_number() over (order by created_at, id) as n
  from public.books
),
credits as (
  select
    id,
    (array[
      'سارا رضایی','امیرحسین نادری','نازنین شریفی','کیوان رستگار','مریم سلیمانی',
      'آرش فرهمند','لیلا احمدی','پویان کریمی','مهسا توکلی','رضا یوسفی',
      'نرگس امینی','سامان بهرامی','الهام مرادی','فرهاد کاظمی','آیدا محمدی'
    ])[((n - 1) % 15) + 1] as author,
    (array['تألیف','تألیف','ترجمه','گردآوری','تألیف'])[((n - 1) % 5) + 1] as book_type
  from ranked
)
update public.books b
set metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
  'author', credits.author,
  'book_type', credits.book_type
)
from credits
where b.id = credits.id;
