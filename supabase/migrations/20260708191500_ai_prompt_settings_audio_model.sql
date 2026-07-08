alter table public.ai_provider_settings
  add column if not exists audio_model text;

alter table public.ai_gateway_settings
  add column if not exists prompt_settings jsonb not null default '{}'::jsonb;

update public.ai_provider_settings
set audio_model = coalesce(audio_model, 'elevenlabs-v3')
where provider = 'kie';
