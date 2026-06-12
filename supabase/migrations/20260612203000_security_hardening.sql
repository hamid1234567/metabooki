create or replace function public.charge_user_credits(
  target_user_id uuid,
  charge_amount int,
  charge_description text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance int;
begin
  if auth.uid() is distinct from target_user_id then raise exception 'Unauthorized'; end if;
  if charge_amount is null or charge_amount <= 0 then raise exception 'Charge amount must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext(target_user_id::text));
  select coalesce(sum(amount), 0)::int into current_balance from public.credit_transactions where user_id = target_user_id;
  if current_balance < charge_amount then raise exception 'Insufficient credits'; end if;
  insert into public.credit_transactions(user_id, amount, type, description)
  values (target_user_id, -charge_amount, 'ai_usage', charge_description);
  return current_balance - charge_amount;
end;
$$;

revoke execute on function public.charge_user_credits(uuid, int, text) from public, anon;
revoke execute on function public.purchase_book(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, text) from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.charge_user_credits(uuid, int, text) to authenticated;
grant execute on function public.purchase_book(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs(user_id);
create index if not exists book_comments_book_id_idx on public.book_comments(book_id);
create index if not exists book_comments_user_id_idx on public.book_comments(user_id);
create index if not exists book_comments_parent_id_idx on public.book_comments(parent_id);
create index if not exists book_series_publisher_id_idx on public.book_series(publisher_id);
create index if not exists books_publisher_id_idx on public.books(publisher_id);
create index if not exists books_series_id_idx on public.books(series_id);
create index if not exists credit_transactions_user_id_idx on public.credit_transactions(user_id);
create index if not exists user_books_book_id_idx on public.user_books(book_id);
