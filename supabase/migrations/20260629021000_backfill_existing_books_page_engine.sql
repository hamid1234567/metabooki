with source_books as (
  select
    b.id as book_id,
    coalesce(b.metadata -> 'editor_v2_document' -> 'pages', b.pages, '[]'::jsonb) as pages_json,
    coalesce(b.metadata -> 'editor_v2_document' -> 'toc', b.metadata -> 'confirmed_toc', '[]'::jsonb) as toc_json,
    b.metadata
  from public.books b
  where jsonb_array_length(coalesce(b.metadata -> 'editor_v2_document' -> 'pages', b.pages, '[]'::jsonb)) > 0
    and not exists (select 1 from public.book_pages p where p.book_id = b.id)
),
page_rows as (
  select
    s.book_id,
    (page_item.ordinality - 1)::int as page_index,
    page_item.page as page_json,
    coalesce(page_item.page ->> 'id', 'page-' || page_item.ordinality) as page_id,
    coalesce(page_item.page ->> 'printNumber', page_item.page ->> 'number', page_item.ordinality::text) as print_number,
    page_item.page ->> 'title' as title,
    coalesce(page_item.page -> 'blocks', '[]'::jsonb) as blocks
  from source_books s
  cross join lateral jsonb_array_elements(s.pages_json) with ordinality as page_item(page, ordinality)
),
plain_rows as (
  select
    p.*,
    coalesce((
      select string_agg(
        coalesce(
          block ->> 'text',
          block ->> 'content',
          block ->> 'caption',
          block ->> 'title',
          block ->> 'question',
          ''
        ),
        E'\n'
      )
      from jsonb_array_elements(p.blocks) as block
    ), '') as plain_text,
    coalesce((
      select array_agg(coalesce(block ->> 'imageId', block ->> 'id'))
      from jsonb_array_elements(p.blocks) as block
      where block ->> 'type' = 'image'
        and coalesce(block ->> 'imageId', block ->> 'id') is not null
    ), array[]::text[]) as asset_ids
  from page_rows p
)
insert into public.book_pages(book_id,page_index,page_id,print_number,title,blocks,plain_text,asset_ids,content_hash,updated_at)
select book_id,page_index,page_id,print_number,title,blocks,plain_text,asset_ids,md5(blocks::text),now()
from plain_rows
on conflict (book_id,page_index) do nothing;

with image_blocks as (
  select
    p.book_id,
    p.page_index,
    coalesce(block ->> 'imageId', block ->> 'id') as asset_id,
    block ->> 'id' as block_id,
    coalesce(block ->> 'url', block ->> 'src') as url,
    block ->> 'caption' as caption,
    coalesce(block ->> 'status', case when block ->> 'conversionStatus' = 'failed' then 'error' else 'ready' end) as status,
    coalesce(block ->> 'issue', block ->> 'conversionError') as issue,
    p.print_number
  from public.book_pages p
  cross join lateral jsonb_array_elements(p.blocks) as block
  where block ->> 'type' = 'image'
    and coalesce(block ->> 'url', block ->> 'src') is not null
)
insert into public.book_assets(book_id,asset_id,page_index,block_id,url,caption,status,issue,metadata,updated_at)
select book_id, asset_id, page_index, block_id, url, caption, coalesce(status,'ready'), issue, jsonb_build_object('printNumber', print_number), now()
from image_blocks
where asset_id is not null
on conflict (book_id,asset_id) do nothing;

insert into public.book_search_index(book_id,page_index,plain_text,headings,updated_at)
select
  p.book_id,
  p.page_index,
  p.plain_text,
  coalesce((
    select string_agg(coalesce(block ->> 'text', block ->> 'content', ''), E'\n')
    from jsonb_array_elements(p.blocks) as block
    where block ->> 'type' = 'heading'
  ), ''),
  now()
from public.book_pages p
on conflict (book_id,page_index) do nothing;

with manifest_source as (
  select
    b.id as book_id,
    count(p.*)::int as page_count,
    coalesce(
      nullif(b.metadata -> 'editor_v2_document' -> 'toc', 'null'::jsonb),
      nullif(b.metadata -> 'confirmed_toc', 'null'::jsonb),
      jsonb_agg(
        jsonb_build_object(
          'id','toc-' || (p.blocks->0->>'id'),
          'title',p.blocks->0->>'text',
          'level',coalesce((p.blocks->0->>'level')::int, 1),
          'blockId',p.blocks->0->>'id',
          'anchor',p.blocks->0->>'anchor',
          'pageIndex',p.page_index,
          'printNumber',p.print_number
        )
        order by p.page_index
      ) filter (where p.blocks->0->>'type' = 'heading'),
      '[]'::jsonb
    ) as toc,
    coalesce((
      select jsonb_agg(jsonb_build_object('id',a.asset_id,'type','image','url',a.url,'caption',a.caption,'printNumber',a.metadata->>'printNumber','status',a.status,'issue',a.issue) order by a.page_index)
      from public.book_assets a
      where a.book_id = b.id
    ), '[]'::jsonb) as assets_summary
  from public.books b
  join public.book_pages p on p.book_id = b.id
  where not exists (select 1 from public.book_content_manifests m where m.book_id = b.id)
  group by b.id, b.metadata
)
insert into public.book_content_manifests(book_id,schema_version,page_count,toc,assets_summary,search_ready,content_hash,updated_at)
select book_id,'2.0-page',page_count,toc,assets_summary,true,md5(toc::text || assets_summary::text),now()
from manifest_source
on conflict (book_id) do nothing;

update public.books b
set metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
  'editor_v2_page_engine', true,
  'editor_v2_schema_version', '2.0-page',
  'editor_v2_page_count', m.page_count
),
content_updated_at = now(),
updated_at = now()
from public.book_content_manifests m
where m.book_id = b.id
  and coalesce((b.metadata ->> 'editor_v2_page_engine')::boolean, false) = false;
