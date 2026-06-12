create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, username text unique, avatar_url text, bio text, phone text, national_id text,
  is_active boolean not null default true, phone_verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','admin','moderator','reviewer','publisher','editor','user')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), unique (user_id, role)
);

create table if not exists public.publisher_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique, theme text, bio text, is_trusted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.book_series (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  publisher_id uuid not null references public.publisher_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(), title text not null, subtitle text, description text,
  cover_url text, back_cover_url text, cover_spread_url text, cover_crop jsonb,
  pages jsonb not null default '[]'::jsonb, preview_pages int[] not null default '{}',
  price int not null default 0 check (price >= 0),
  status text not null default 'draft' check (status in ('draft','published')),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  publisher_id uuid not null references public.publisher_profiles(id) on delete restrict,
  content_version int not null default 1, content_updated_at timestamptz not null default now(),
  first_published_paid boolean not null default false, publish_complexity_factor numeric not null default 1,
  series_id uuid references public.book_series(id) on delete set null, series_order int,
  language text not null default 'fa', tags text[] not null default '{}', metadata jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade, purchased_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.book_comments (
  id uuid primary key default gen_random_uuid(), book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.book_comments(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000), is_hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null, type text not null, description text, reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_fee_settings (
  id int primary key default 1 check (id = 1), platform_fee_percent numeric not null default 10,
  min_platform_fee int not null default 0, publish_fee int not null default 0,
  ai_text_cost int not null default 1, ai_image_cost int not null default 1,
  publisher_signup_fee int not null default 0, credits_per_toman numeric not null default 0.001,
  updated_at timestamptz not null default now()
);
insert into public.platform_fee_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.has_role(uid uuid, requested_role text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = uid and role = requested_role) $$;
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = uid and role in ('admin','super_admin')) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.publisher_profiles enable row level security;
alter table public.book_series enable row level security;
alter table public.books enable row level security;
alter table public.user_books enable row level security;
alter table public.book_comments enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.platform_fee_settings enable row level security;

create policy "Users view own profile" on public.profiles for select using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "Users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Users view own roles" on public.user_roles for select using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Admins manage roles" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Public views publishers" on public.publisher_profiles for select using (true);
create policy "Publishers update own profile" on public.publisher_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Public views series" on public.book_series for select using (true);
create policy "Publishers manage own series" on public.book_series for all
using (exists(select 1 from public.publisher_profiles p where p.id = publisher_id and p.user_id = auth.uid()) or public.is_admin(auth.uid()))
with check (exists(select 1 from public.publisher_profiles p where p.id = publisher_id and p.user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy "Publishers manage own books" on public.books for all
using (exists(select 1 from public.publisher_profiles p where p.id = publisher_id and p.user_id = auth.uid()) or public.is_admin(auth.uid()))
with check (exists(select 1 from public.publisher_profiles p where p.id = publisher_id and p.user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy "Users update own comments" on public.book_comments for update using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Users delete own comments" on public.book_comments for delete using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Authenticated views fee settings" on public.platform_fee_settings for select to authenticated using (true);
create policy "Admins update fee settings" on public.platform_fee_settings for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.publisher_profiles, public.book_series, public.books, public.book_comments to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles, public.user_books, public.credit_transactions, public.platform_fee_settings to authenticated;
grant insert, update, delete on public.book_comments to authenticated;
grant select, insert, update, delete on public.publisher_profiles, public.book_series, public.books to authenticated;

do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
