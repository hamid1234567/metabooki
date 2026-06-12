create table if not exists public.reader_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  page_index int not null,
  text_content text not null,
  color text not null check (color in ('yellow', 'green', 'red')),
  source text not null default 'selection' check (source in ('selection', 'ai')),
  created_at timestamptz not null default now()
);

create table if not exists public.reader_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  current_page int not null default 0,
  total_pages int not null default 0,
  background text not null default 'abstract',
  highlight_color text not null default 'yellow',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_key)
);

create table if not exists public.ai_saved_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text,
  page_index int,
  action text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.reader_highlights enable row level security;
alter table public.reader_states enable row level security;
alter table public.ai_saved_outputs enable row level security;

create policy "Users manage own reader highlights" on public.reader_highlights
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own reader states" on public.reader_states
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users view own AI outputs" on public.ai_saved_outputs
for select using (user_id = auth.uid());

create index if not exists reader_highlights_user_book_idx on public.reader_highlights(user_id, book_key);
create index if not exists ai_saved_outputs_user_book_idx on public.ai_saved_outputs(user_id, book_id, created_at desc);

drop policy if exists "Admins can manage AI provider settings" on public.ai_provider_settings;
revoke all on public.ai_provider_settings from anon, authenticated;

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
  if auth.uid() is distinct from target_user_id then
    raise exception 'Unauthorized';
  end if;
  perform pg_advisory_xact_lock(hashtext(target_user_id::text));
  select coalesce(sum(amount), 0)::int into current_balance
  from public.credit_transactions where user_id = target_user_id;
  if current_balance < charge_amount then
    raise exception 'Insufficient credits';
  end if;
  insert into public.credit_transactions(user_id, amount, type, description)
  values (target_user_id, -charge_amount, 'ai_usage', charge_description);
  return current_balance - charge_amount;
end;
$$;

grant execute on function public.charge_user_credits(uuid, int, text) to authenticated;

create or replace function public.purchase_book(target_book_id uuid) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  book_price int;
  current_balance int;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select price into book_price from public.books
  where id = target_book_id and status = 'published' and review_status = 'approved';
  if book_price is null then raise exception 'Book not available'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if exists(select 1 from public.user_books where user_id = auth.uid() and book_id = target_book_id) then
    select coalesce(sum(amount), 0)::int into current_balance from public.credit_transactions where user_id = auth.uid();
    return current_balance;
  end if;
  select coalesce(sum(amount), 0)::int into current_balance from public.credit_transactions where user_id = auth.uid();
  if current_balance < book_price then raise exception 'Insufficient credits'; end if;
  insert into public.user_books(user_id, book_id) values(auth.uid(), target_book_id);
  if book_price > 0 then
    insert into public.credit_transactions(user_id, amount, type, description, reference_id)
    values(auth.uid(), -book_price, 'book_purchase', 'Book purchase', target_book_id);
  end if;
  return current_balance - book_price;
end;
$$;

grant execute on function public.purchase_book(uuid) to authenticated;

alter table public.books enable row level security;
alter table public.user_books enable row level security;
alter table public.book_comments enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Public reads published books" on public.books;
create policy "Public reads published books" on public.books for select
using (status = 'published' and review_status = 'approved');

drop policy if exists "Users view own library" on public.user_books;
create policy "Users view own library" on public.user_books for select using (user_id = auth.uid());

drop policy if exists "Users view own credits" on public.credit_transactions;
create policy "Users view own credits" on public.credit_transactions for select using (user_id = auth.uid());

drop policy if exists "Public reads visible comments" on public.book_comments;
create policy "Public reads visible comments" on public.book_comments for select using (not is_hidden);

drop policy if exists "Users create own comments" on public.book_comments;
create policy "Users create own comments" on public.book_comments for insert with check (user_id = auth.uid());
