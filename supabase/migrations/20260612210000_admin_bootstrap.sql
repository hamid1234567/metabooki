create table if not exists public.admin_bootstrap_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.admin_bootstrap_emails enable row level security;
revoke all on public.admin_bootstrap_emails from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bootstrap_admin boolean;
begin
  insert into public.profiles(id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  delete from public.admin_bootstrap_emails
  where email = lower(new.email)
  returning true into bootstrap_admin;

  if bootstrap_admin then
    insert into public.user_roles(user_id, role)
    values (new.id, 'admin'), (new.id, 'super_admin')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
