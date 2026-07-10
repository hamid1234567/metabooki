alter table public.ai_saved_outputs enable row level security;

drop policy if exists "Users view own AI outputs" on public.ai_saved_outputs;

create policy "Users view own AI outputs" on public.ai_saved_outputs
for select
using (user_id = auth.uid());

create index if not exists ai_saved_outputs_user_book_created_idx
on public.ai_saved_outputs(user_id, book_id, created_at desc);
