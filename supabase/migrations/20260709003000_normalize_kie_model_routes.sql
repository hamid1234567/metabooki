update public.ai_provider_settings
set image_model = 'qwen/text-to-image',
    updated_at = now()
where provider = 'kie'
  and image_model in ('qwen-image', 'qwen-image-edit', 'gemini-2-5-flash-image-preview', 'grok-2-image');

update public.ai_provider_settings
set image_model = 'nano-banana-2',
    updated_at = now()
where provider = 'kie'
  and image_model = 'google/nano-banana-2';

update public.ai_provider_settings
set image_model = 'nano-banana-2-lite',
    updated_at = now()
where provider = 'kie'
  and image_model = 'google/nano-banana-2-lite';

update public.ai_provider_settings
set model = 'gpt-5-5',
    input_cost_per_1k_usd = 0.00127,
    output_cost_per_1k_usd = 0.01,
    updated_at = now()
where provider = 'kie'
  and model in (
    'gemini-2-5-pro',
    'gemini-2-5-flash',
    'gemini-2-0-flash',
    'gemini-1-5-pro',
    'qwen3-max',
    'qwen3-coder-plus',
    'qwen3-235b-a22b',
    'qwen2-5-max',
    'grok-4',
    'grok-3',
    'grok-3-mini',
    'grok-2-vision',
    'claude-opus-4-1',
    'claude-sonnet-4',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet'
  );
