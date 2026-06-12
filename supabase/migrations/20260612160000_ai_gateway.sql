create table if not exists public.ai_gateway_settings (
  id int primary key default 1 check (id = 1),
  active_provider text not null default 'openai',
  usd_to_toman numeric not null default 170000,
  charge_multiplier numeric not null default 2,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_provider_settings (
  provider text primary key,
  label text not null,
  enabled boolean not null default false,
  api_key text,
  base_url text not null,
  model text not null,
  input_cost_per_1k_usd numeric not null default 0,
  output_cost_per_1k_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  action text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  raw_usd numeric not null default 0,
  charged_usd numeric not null default 0,
  charged_toman int not null default 0,
  charged_credits int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.ai_gateway_settings (id, active_provider, usd_to_toman, charge_multiplier)
values (1, 'openai', 170000, 2)
on conflict (id) do nothing;

insert into public.ai_provider_settings (provider, label, enabled, base_url, model, input_cost_per_1k_usd, output_cost_per_1k_usd)
values
  ('openai', 'OpenAI / ChatGPT', true, 'https://api.openai.com/v1', 'gpt-4o-mini', 0.00015, 0.0006),
  ('gemini', 'Google Gemini', false, 'https://generativelanguage.googleapis.com/v1beta', 'gemini-1.5-flash', 0.000075, 0.0003),
  ('anthropic', 'Anthropic Claude', false, 'https://api.anthropic.com/v1', 'claude-3-haiku-20240307', 0.00025, 0.00125),
  ('custom', 'OpenAI-compatible Custom', false, '', 'custom-model', 0.00015, 0.0006)
on conflict (provider) do nothing;

alter table public.ai_gateway_settings enable row level security;
alter table public.ai_provider_settings enable row level security;
alter table public.ai_usage_logs enable row level security;

create policy "Admins can manage AI gateway settings" on public.ai_gateway_settings
for all using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','super_admin')))
with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','super_admin')));

create policy "Admins can manage AI provider settings" on public.ai_provider_settings
for all using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','super_admin')))
with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','super_admin')));

create policy "Users can view own AI usage logs" on public.ai_usage_logs
for select using (user_id = auth.uid());

create policy "Admins can view AI usage logs" on public.ai_usage_logs
for select using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','super_admin')));
