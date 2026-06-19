alter table public.ai_provider_settings
  add column if not exists image_model text;

update public.ai_provider_settings
set image_model = case
  when provider in ('openai', 'custom') then coalesce(image_model, 'gpt-image-1')
  else image_model
end;
