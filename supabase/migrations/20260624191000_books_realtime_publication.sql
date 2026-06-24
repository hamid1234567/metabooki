alter table public.books replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.books;
exception
  when duplicate_object then
    null;
  when undefined_object then
    null;
end $$;
