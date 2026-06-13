alter table public.reader_highlights
drop constraint if exists reader_highlights_source_check;

alter table public.reader_highlights
add constraint reader_highlights_source_check
check (source = 'ai' or source = 'selection' or source like 'selection|%');
