insert into public.ai_provider_settings (
  provider,
  label,
  enabled,
  base_url,
  model,
  image_model,
  input_cost_per_1k_usd,
  output_cost_per_1k_usd
)
values (
  'kie',
  'KIE.ai unified API',
  false,
  'https://api.kie.ai',
  'gpt-5-5',
  'gpt-image-2-text-to-image',
  0.00127,
  0.01
)
on conflict (provider) do update
set
  label = excluded.label,
  base_url = coalesce(nullif(public.ai_provider_settings.base_url, ''), excluded.base_url),
  model = coalesce(nullif(public.ai_provider_settings.model, ''), excluded.model),
  image_model = coalesce(nullif(public.ai_provider_settings.image_model, ''), excluded.image_model),
  input_cost_per_1k_usd = coalesce(public.ai_provider_settings.input_cost_per_1k_usd, excluded.input_cost_per_1k_usd),
  output_cost_per_1k_usd = coalesce(public.ai_provider_settings.output_cost_per_1k_usd, excluded.output_cost_per_1k_usd),
  updated_at = now();
