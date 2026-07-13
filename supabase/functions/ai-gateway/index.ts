import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_USD_TO_TOMAN = 170_000
const DEFAULT_CHARGE_MULTIPLIER = 2
const DEFAULT_CALLOUT_SUGGESTION_PROMPT = `به‌عنوان ویراستار حرفه‌ای کتاب دیجیتال، متن زیر را بررسی کن و پیشنهادهایی برای بهبود خوانایی، جذابیت بصری و یادگیری ارائه بده.

اصول:

* لحن، سبک و مقصود نویسنده را حفظ کن.
* معنا، اطلاعات علمی، اعداد، اصطلاحات، نقل‌قول‌ها و منابع را تغییر نده.
* متن جدیدی به نام نویسنده اضافه نکن.
* از ویرایش و قالب‌بندی افراطی یا تزئینی خودداری کن.
* فقط پیشنهادهایی را ارائه بده که واقعاً به فهم، توجه، یادگیری یا لذت خواندن کمک می‌کنند.

دو نوع پیشنهاد ارائه بده:

1. ویرایش و قالب‌بندی:
مانند اصلاح نگارشی ضروری، شکستن پاراگراف طولانی، ایجاد تیتر یا زیرتیتر، تبدیل متن مناسب به فهرست، بولد یا برجسته‌کردن عبارات مهم، تغییر محدود رنگ، اندازه یا سبک نمایش متن.

2. کال‌اوت آموزشی:
بخش مناسبی از متن را بدون تغییر در کلمات آن، برای یکی از این کال‌اوت‌ها پیشنهاد بده:
«نکته کلیدی»، «مکث و فکر»، «اشتباه رایج»، «جمله طلایی»، «عمیق‌تر بخوان»، «تمرین سریع»، «تعریف واژه»، «داده و منبع»، «یادداشت حاشیه‌ای».

برای هر پیشنهاد دقیقاً این موارد را بنویس:

* نوع پیشنهاد
* متن دقیق انتخاب‌شده از متن اصلی
* اقدام پیشنهادی
* دلیل کوتاه
* میزان اهمیت: زیاد، متوسط یا کم

پیشنهادها را به ترتیب محل قرارگیری در متن فهرست کن. برای هر بخش فقط بهترین پیشنهاد را بده و از تکرار، شلوغ‌کردن صفحه و استفاده بیش‌ازحد از کال‌اوت‌ها خودداری کن. اگر بخشی نیاز به تغییر ندارد، پیشنهادی ارائه نده.`

type AiProviderConfig = {
  provider: string
  label: string
  enabled: boolean
  api_key: string
  base_url: string
  model: string
  image_model?: string
  audio_model?: string
  input_cost_per_1k_usd: number
  output_cost_per_1k_usd: number
}

type AiImageSize = '1024x1024' | '1024x1536' | '1536x1024'
type PromptSettings = Record<string, string>

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil((text || '').trim().length / 4))
}

function imageModelForProvider(provider: AiProviderConfig) {
  const configured = String(provider.image_model || '').trim()
  if (provider.provider === 'kie') return configured || 'gpt-image-2-text-to-image'
  const envModel = String(Deno.env.get('AI_IMAGE_MODEL') || '').trim()
  const candidate = configured || envModel || 'gpt-image-1'
  if (/^(gpt-image-|dall-e)/i.test(candidate)) return candidate
  return envModel && /^(gpt-image-|dall-e)/i.test(envModel) ? envModel : 'gpt-image-1'
}

function imageModelWarning(provider: AiProviderConfig) {
  if (provider.provider === 'kie') return ''
  const configured = String(provider.image_model || '').trim()
  if (configured && !/^(gpt-image-|dall-e)/i.test(configured)) {
    return `Configured image model "${configured}" is not an Image API model; using "${imageModelForProvider(provider)}" instead.`
  }
  if (!configured && provider.model && !/^(gpt-image-|dall-e)/i.test(provider.model)) {
    return `Text model "${provider.model}" is not used for Image API generation; using "${imageModelForProvider(provider)}" instead.`
  }
  return ''
}

function kieBaseUrl(provider: AiProviderConfig) {
  return String(provider.base_url || 'https://api.kie.ai').replace(/\/$/, '')
}

function kieAspectRatioForSize(size: AiImageSize) {
  if (size === '1024x1536') return '2:3'
  if (size === '1536x1024') return '3:2'
  return '1:1'
}

function kieImageSizeForModel(size: AiImageSize) {
  if (size === '1024x1536') return 'portrait_4_3'
  if (size === '1536x1024') return 'landscape_4_3'
  return 'square_hd'
}

function kieImageTaskInput(model: string, prompt: string, size: AiImageSize) {
  if (model.startsWith('qwen/') || model.startsWith('qwen2/')) {
    return {
      prompt,
      image_size: kieImageSizeForModel(size),
    }
  }
  return {
    prompt,
    aspect_ratio: kieAspectRatioForSize(size),
    resolution: '1K',
  }
}

function kieAudioModelForProvider(provider: AiProviderConfig) {
  const configured = String(provider.audio_model || '').trim()
  if (configured === 'elevenlabs-v3' || configured === 'elevenlabs-turbo-v2-5') return 'elevenlabs/text-to-dialogue-v3'
  if (configured === 'elevenlabs-v2') return 'elevenlabs/text-to-speech'
  if (configured === 'elevenlabs-sfx') return 'elevenlabs/sound-effects'
  return configured || 'elevenlabs/text-to-dialogue-v3'
}

function kieAudioTaskInput(model: string, text: string) {
  if (model === 'elevenlabs/sound-effects') {
    return { text }
  }
  if (model.includes('dialogue')) {
    return {
      dialogue: [{ text, voice: 'EkK5I93UQWFDigLMpZcX' }],
      stability: 0.5,
      language_code: 'fa',
    }
  }
  return {
    text,
    voice_id: 'EkK5I93UQWFDigLMpZcX',
    voice: 'EkK5I93UQWFDigLMpZcX',
  }
}

function kieTextRoute(model: string) {
  const selected = String(model || '').trim() || 'gpt-5-5'
  if (selected === 'gpt-5-5' || selected === 'gpt-5-4') {
    return { kind: 'responses' as const, path: '/codex/v1/responses', model: selected }
  }
  if (selected === 'gpt-5-2') {
    return { kind: 'chat' as const, path: '/gpt-5-2/v1/chat/completions', model: selected }
  }
  if (selected.startsWith('claude-')) {
    return { kind: 'claude' as const, path: '/claude/v1/messages', model: selected }
  }
  if (selected.startsWith('gemini-')) {
    return { kind: 'chat' as const, path: `/${selected}/v1/chat/completions`, model: selected }
  }
  if (selected.startsWith('grok-')) {
    return { kind: 'responses' as const, path: '/grok/v1/responses', model: selected }
  }
  return { kind: 'chat' as const, path: `/${selected}/v1/chat/completions`, model: selected }
}

function extractKieText(json: any) {
  if (typeof json?.output_text === 'string') return json.output_text
  if (typeof json?.text === 'string') return json.text
  const choiceContent = json?.choices?.[0]?.message?.content
  if (typeof choiceContent === 'string') return choiceContent.trim()
  if (Array.isArray(choiceContent)) {
    const text = choiceContent.map((part: any) => {
      if (typeof part === 'string') return part
      if (typeof part?.text === 'string') return part.text
      if (typeof part?.content === 'string') return part.content
      return ''
    }).filter(Boolean).join('\n').trim()
    if (text) return text
  }
  if (typeof json?.message?.content === 'string') return json.message.content.trim()
  const claudeContent = Array.isArray(json?.content) ? json.content : []
  if (claudeContent.length) {
    const text = claudeContent.map((part: any) => {
      if (typeof part === 'string') return part
      if (typeof part?.text === 'string') return part.text
      if (typeof part?.content === 'string') return part.content
      return ''
    }).filter(Boolean).join('\n').trim()
    if (text) return text
  }
  const output = Array.isArray(json?.output) ? json.output : []
  const parts: string[] = []
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.output_text === 'string') parts.push(part.output_text)
      if (typeof part?.text === 'string') parts.push(part.text)
      if (typeof part?.content === 'string') parts.push(part.content)
    }
  }
  return parts.join('\n').trim()
}

function extractKieTaskId(json: any) {
  return json?.data?.taskId
    || json?.data?.task_id
    || json?.data?.id
    || json?.data?.task?.id
    || json?.data?.result?.taskId
    || json?.data?.result?.task_id
    || json?.data?.response?.taskId
    || json?.data?.response?.task_id
    || json?.result?.taskId
    || json?.result?.task_id
    || json?.task?.id
    || json?.taskId
    || json?.task_id
    || json?.id
}

function extractKieImageUrl(json: any) {
  const data = json?.data || json
  const response = data?.response || data?.result || data?.output || data?.resultJson || data?.result_json || data
  const parsed = typeof response === 'string'
    ? (() => { try { return JSON.parse(response) } catch { return response } })()
    : response
  const candidates = [
    parsed?.resultUrls?.[0],
    parsed?.result_urls?.[0],
    parsed?.result?.resultUrls?.[0],
    parsed?.result?.urls?.[0],
    parsed?.response?.resultUrls?.[0],
    parsed?.response?.urls?.[0],
    parsed?.urls?.[0],
    parsed?.images?.[0]?.url,
    parsed?.images?.[0],
    parsed?.image?.url,
    parsed?.image,
    parsed?.image_urls?.[0],
    parsed?.imageUrl,
    parsed?.url,
    data?.resultUrls?.[0],
    data?.result_urls?.[0],
    data?.imageUrl,
    data?.url,
  ].filter(Boolean)
  return String(candidates[0] || '')
}

function kieImageStatusEndpoint(baseUrl: string, model: string, taskId: string) {
  if (model === '4o-image') return `${baseUrl}/api/v1/gpt4o-image/record-info?taskId=${encodeURIComponent(taskId)}`
  return `${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
}

function isKieTaskComplete(json: any) {
  const state = String(json?.data?.state || json?.data?.status || json?.status || '').toLowerCase()
  return ['success', 'succeeded', 'completed', 'complete', 'done'].includes(state)
}

function isKieTaskFailed(json: any) {
  const state = String(json?.data?.state || json?.data?.status || json?.status || '').toLowerCase()
  return ['fail', 'failed', 'error', 'canceled', 'cancelled'].includes(state)
}

function imageUsage(provider: AiProviderConfig, prompt: string, usdToToman: number, chargeMultiplier: number, creditsPerToman: number) {
  const inputTokens = estimateTokens(prompt)
  const imageBaseUsd = imageBaseUsdForProvider(provider)
  const promptUsd = (inputTokens / 1000) * Number(provider.input_cost_per_1k_usd || 0)
  const rawUsd = imageBaseUsd + promptUsd
  const chargedUsd = rawUsd * chargeMultiplier
  const chargedToman = Math.ceil(chargedUsd * usdToToman)
  const chargedCredits = Math.max(1, Math.ceil(chargedToman * creditsPerToman))
  return { inputTokens, outputTokens: 0, rawUsd, chargedUsd, chargedToman, chargedCredits, creditValueToman: Math.round(1 / creditsPerToman) }
}

function imageBaseUsdForProvider(provider: AiProviderConfig) {
  const model = imageModelForProvider(provider)
  if (provider.provider === 'kie') {
    if (model === 'qwen/text-to-image') return 0.0125
    if (model === 'qwen2/text-to-image') return 0.027
    if (model === 'nano-banana-2') return 0.03
    if (model === 'nano-banana-2-lite') return 0.02
    if (model === '4o-image') return 0.03
    if (model === 'gpt-image-2-edit-image') return 0.05
    return 0.05
  }
  return Number(Deno.env.get('AI_IMAGE_BASE_USD') || 0.04)
}

function providerError(json: any, fallback: string) {
  const message = json?.error?.message || json?.message || json?.msg || json?.error || json?.data?.error || json?.data?.message
  if (message) return String(message)
  const preview = JSON.stringify(json || {}).slice(0, 500)
  return preview && preview !== '{}' ? `${fallback}: ${preview}` : fallback
}

function promptSetting(settings: PromptSettings | null | undefined, key: string) {
  const value = settings?.[key]
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed) return trimmed
  if (key === 'readerCalloutSuggestions') return DEFAULT_CALLOUT_SUGGESTION_PROMPT
  return ''
}

function appendSupplementalPrompt(prompt: string, additions: string[]) {
  const extras = additions.map(item => item.trim()).filter(Boolean)
  if (!extras.length) return prompt
  return `${prompt}\n\nAdditional site instructions:\n${extras.map(item => `- ${item}`).join('\n')}`
}

function imagePromptWithSettings(prompt: string, purpose: string, settings: PromptSettings | null | undefined) {
  const purposeKey = purpose === 'book_cover' ? 'imageBookCover' : purpose === 'interactive' ? 'imageInteractive' : 'imageDirect'
  return appendSupplementalPrompt(prompt, [
    promptSetting(settings, 'imageGlobal'),
    promptSetting(settings, purposeKey),
    'Resolution target: 1k.',
  ])
}

function textPromptWithSettings(prompt: string, action: string, settings: PromptSettings | null | undefined) {
  const actionKey = action === 'summary'
    ? 'readerSummary'
    : action === 'quiz'
      ? 'readerQuiz'
      : action === 'mindmap'
        ? 'readerMindmap'
        : action === 'learning_path'
          ? 'readerLearningPath'
          : action === 'explain'
            ? 'readerExplain'
            : action === 'callout_suggestions'
              ? 'readerCalloutSuggestions'
              : ''
  return appendSupplementalPrompt(prompt, [promptSetting(settings, 'textGlobal'), actionKey ? promptSetting(settings, actionKey) : ''])
}

function textUsageFromTokens(provider: AiProviderConfig, inputTokens: number, outputTokens: number, usdToToman: number, chargeMultiplier: number, creditsPerToman: number) {
  const rawUsd = (inputTokens / 1000) * Number(provider.input_cost_per_1k_usd || 0) + (outputTokens / 1000) * Number(provider.output_cost_per_1k_usd || 0)
  const chargedUsd = rawUsd * chargeMultiplier
  const chargedToman = Math.ceil(chargedUsd * usdToToman)
  const chargedCredits = Math.max(1, Math.ceil(chargedToman * creditsPerToman))
  return { inputTokens, outputTokens, rawUsd, chargedUsd, chargedToman, chargedCredits, creditValueToman: Math.round(1 / creditsPerToman) }
}

function estimatedOutputTokensForAction(action: string, inputTokens: number, maxOutputTokens: number) {
  if (action === 'callout_suggestions') return Math.min(maxOutputTokens, Math.max(180, Math.ceil(inputTokens * 0.22)))
  if (action === 'quiz') return Math.min(maxOutputTokens, 260)
  if (action === 'learning_path' || action === 'mindmap') return Math.min(maxOutputTokens, 420)
  return Math.min(maxOutputTokens, 360)
}

function weightedRangeEstimate(minimum: number, maximum: number) {
  const min = Math.max(0, Number(minimum) || 0)
  const max = Math.max(min, Number(maximum) || min)
  if (min === max) return Math.ceil(min)
  return Math.ceil(((2 * min) + max) / 3)
}

function estimatedTextUsage(provider: AiProviderConfig, prompt: string, action: string, maxOutputTokens: number, usdToToman: number, chargeMultiplier: number, creditsPerToman: number) {
  const inputTokens = Math.ceil(estimateTokens(prompt))
  const minimumOutputTokens = estimatedOutputTokensForAction(action, inputTokens, maxOutputTokens)
  const outputTokens = weightedRangeEstimate(minimumOutputTokens, maxOutputTokens)
  return textUsageFromTokens(provider, inputTokens, outputTokens, usdToToman, chargeMultiplier, creditsPerToman)
}

function maxOutputTokensForAction(action: string) {
  if (action === 'callout_suggestions') return 650
  if (action === 'learning_path' || action === 'mindmap') return 700
  if (action === 'quiz') return 420
  return 620
}

function normalizeImageSize(value: unknown): AiImageSize {
  const size = String(value || '').trim()
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') return size
  return '1536x1024'
}

async function callImageProvider(provider: AiProviderConfig, prompt: string, size: AiImageSize) {
  if (provider.provider === 'kie') {
    const baseUrl = kieBaseUrl(provider)
    const model = imageModelForProvider(provider)
    if (model === '4o-image') {
      const createRes = await fetch(`${baseUrl}/api/v1/gpt4o-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
        body: JSON.stringify({
          prompt,
          size: kieAspectRatioForSize(size),
        }),
      })
      const created = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(providerError(created, `KIE 4o image task failed (${createRes.status})`))

      const immediateUrl = extractKieImageUrl(created)
      if (immediateUrl) return { imageUrl: immediateUrl, model }

      const taskId = extractKieTaskId(created)
      if (!taskId) throw new Error(providerError(created, 'KIE 4o image did not return a task id'))

      return { taskId, model, status: 'pending' }
    }

    const createRes = await fetch(`${baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
      body: JSON.stringify({
        model,
        input: kieImageTaskInput(model, prompt, size),
      }),
    })
    const created = await createRes.json().catch(() => ({}))
    if (!createRes.ok) throw new Error(providerError(created, `KIE image task failed (${createRes.status})`))

    const immediateUrl = extractKieImageUrl(created)
    if (immediateUrl) return { imageUrl: immediateUrl, model }

    const taskId = extractKieTaskId(created)
    if (!taskId) throw new Error(providerError(created, 'KIE did not return an image task id'))

    return { taskId, model, status: 'pending' }
  }

  if (!['openai', 'custom'].includes(provider.provider)) {
    throw new Error('Image generation is currently available only for OpenAI-compatible providers')
  }
  const baseUrl = String(provider.base_url || '').replace(/\/$/, '')
  const model = imageModelForProvider(provider)
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error?.message || json.message || `Image generation failed (${res.status})`)
  const item = json.data?.[0] || {}
  const imageUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url
  if (!imageUrl) throw new Error(`Image provider did not return an image for model ${model}`)
  return { imageUrl, model }
}

async function pollKieImageProvider(provider: AiProviderConfig, taskId: string, model: string) {
  const baseUrl = kieBaseUrl(provider)
  const detailRes = await fetch(kieImageStatusEndpoint(baseUrl, model, taskId), {
    headers: { Authorization: `Bearer ${provider.api_key}` },
  })
  const detail = await detailRes.json().catch(() => ({}))
  if (!detailRes.ok) throw new Error(providerError(detail, `KIE image status failed (${detailRes.status})`))
  const imageUrl = extractKieImageUrl(detail)
  if (imageUrl) return { imageUrl, model, taskId, status: 'completed' }
  if (isKieTaskFailed(detail)) throw new Error(providerError(detail, 'KIE image task failed'))
  if (isKieTaskComplete(detail)) {
    throw new Error(providerError(detail, `KIE image task completed but no image URL was found. Task id: ${taskId}`))
  }
  return { imageUrl: '', model, taskId, status: 'pending' }
}

function actionPrompt(action: string, bookTitle: string, pageTitle: string | undefined, pageText: string) {
  const header = `کتاب: ${bookTitle}\n${pageTitle ? `عنوان صفحه: ${pageTitle}\n` : ''}متن صفحه:\n${pageText}`
  const common = 'فقط بر اساس متن همین صفحه پاسخ بده، چیزی را حدس نزن، فارسی روان بنویس و فقط JSON معتبر بدون markdown برگردان.'
  if (action === 'quiz') return `${common}\nاین ساختار را پر کن: {"type":"quiz","question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}\nدقیقاً یک سؤال چهارگزینه‌ای تک‌پاسخی بساز.\n\n${header}`
  if (action === 'mindmap') return `${common}\nاین ساختار را پر کن: {"type":"mindmap","title":"...","branches":[{"title":"...","items":["..."]}]}\n\n${header}`
  if (action === 'learning_path') return `${common}\nاین ساختار را پر کن: {"type":"timeline","title":"...","steps":[{"title":"...","description":"..."}]}\nمراحل باید به ترتیب و مناسب نمایش تعاملی باشند.\n\n${header}`
  if (action === 'summary') return `${common}\nاین ساختار را پر کن: {"type":"article","title":"خلاصه صفحه","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\n\n${header}`
  if (action === 'explain') return `${common}\nاین ساختار را پر کن: {"type":"article","title":"توضیح عمیق","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\n\n${header}`
  return `درخواست کاربر: ${action}\n\n${header}`
}

function parseStructuredContent(text: string) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  try {
    return JSON.parse(candidate)
  } catch {
    throw new Error(`AI response was not valid JSON. Preview: ${cleaned.slice(0, 180)}`)
  }
}

async function callProvider(provider: AiProviderConfig, prompt: string, maxTokens = 512) {
  let text = ''
  let inputTokens = estimateTokens(prompt)
  let outputTokens = 0

  if (provider.provider === 'kie') {
    const route = kieTextRoute(provider.model)
    const requestBody = route.kind === 'responses'
      ? {
          model: route.model,
          stream: false,
          input: [{ role: 'user', content: prompt }],
          max_output_tokens: maxTokens,
          reasoning: { effort: 'low' },
        }
      : route.kind === 'claude'
        ? {
            model: route.model,
            stream: false,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
          }
        : {
            model: route.model,
            stream: false,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.2,
          }
    const res = await fetch(`${kieBaseUrl(provider)}${route.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
      body: JSON.stringify(requestBody),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(providerError(json, `KIE ${route.model} request failed (${res.status})`))
    text = extractKieText(json)
    inputTokens = json.usage?.input_tokens || json.usage?.prompt_tokens || json.usage?.cache_creation_input_tokens || inputTokens
    outputTokens = json.usage?.output_tokens || json.usage?.completion_tokens || estimateTokens(text)
  } else if (provider.provider === 'gemini') {
    const res = await fetch(`${provider.base_url}/models/${provider.model}:generateContent?key=${provider.api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error?.message || `Gemini request failed (${res.status})`)
    text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    inputTokens = json.usageMetadata?.promptTokenCount || inputTokens
    outputTokens = json.usageMetadata?.candidatesTokenCount || estimateTokens(text)
  } else {
    const requestBody: Record<string, unknown> = {
      model: provider.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }
    const res = await fetch(`${provider.base_url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
      body: JSON.stringify(requestBody),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error?.message || json.message || `AI request failed (${res.status})`)
    text = json.choices?.[0]?.message?.content || ''
    inputTokens = json.usage?.prompt_tokens || inputTokens
    outputTokens = json.usage?.completion_tokens || estimateTokens(text)
  }

  return { text, inputTokens, outputTokens }
}

function safeActionPrompt(action: string, bookTitle: string, pageTitle: string | undefined, pageText: string) {
  const header = `Book: ${bookTitle}\n${pageTitle ? `Page title: ${pageTitle}\n` : ''}Page text:\n${pageText}`
  const common = 'Answer only from this page text. Do not invent facts. Write fluent Persian. Return only valid JSON without markdown.'
  if (action === 'quiz') return `${common}\nUse: {"type":"quiz","question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}\nCreate exactly one single-answer multiple-choice question.\n\n${header}`
  if (action === 'mindmap') return `${common}\nUse: {"type":"mindmap","title":"...","branches":[{"title":"...","items":["..."]}]}\n\n${header}`
  if (action === 'learning_path') return `${common}\nUse: {"type":"timeline","title":"...","steps":[{"title":"...","description":"..."}]}\nOrder the steps for an interactive learning view.\n\n${header}`
  if (action === 'summary') return `${common}\nUse: {"type":"article","title":"...","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\n\n${header}`
  if (action === 'explain') return `${common}\nUse: {"type":"article","title":"...","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\nExplain deeply but only from the supplied text.\n\n${header}`
  if (action === 'callout_suggestions') return `${common}
Return an actionable list of editorial suggestions for the editor UI.
Every suggestion must be anchored to one exact short quote copied from the supplied page text in sourceQuote.
Do not return prose outside JSON. Do not add authorial claims. If no useful suggestion exists, return {"type":"callout_suggestions","suggestions":[]}.
Use suggestionType "formatting" for editing/layout/readability suggestions and "educational_callout" for callout suggestions.
Most suggestions must be "formatting"; use "educational_callout" only for the strongest one or two educational callouts.
Aim for 70-80% formatting suggestions and 20-30% educational_callout suggestions. Return at most 2 educational_callout items, preferably 0 or 1 unless the text strongly deserves more.
For educational_callout choose variant by purpose: key, question, warning, quote, deep, practice, glossary, data, margin.
Use suggestionType exactly as one value, either "formatting" or "educational_callout"; never return a combined value.
Use this exact JSON shape:
{"type":"callout_suggestions","suggestions":[{"suggestionType":"formatting","variant":"","title":"...","text":"","sourceQuote":"exact quote from page text","action":"concrete formatting/editing action","reason":"...","importance":"زیاد|متوسط|کم","placementHint":"replace-near-source"},{"suggestionType":"educational_callout","variant":"key","title":"...","text":"...","sourceQuote":"exact quote from page text","action":"convert to educational callout","reason":"...","importance":"زیاد|متوسط|کم","placementHint":"replace-near-source"}]}
For formatting suggestions, leave variant empty. Put the concrete editor action in action.
Return 1 to 7 useful suggestions, ordered by their location in the original text.

${header}`
  return `${common}\nUser request: ${action}\n\n${header}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: auth } = await userClient.auth.getUser()
    const user = auth.user
    if (!user) throw new Error('Unauthorized')

    const body = await req.json()
    if (body.operation === 'admin_get_settings' || body.operation === 'admin_save_settings') {
      const { data: role } = await adminClient.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).limit(1)
      if (!role?.length) throw new Error('Admin access required')

      if (body.operation === 'admin_get_settings') {
        const { data: gateway, error: gatewayError } = await adminClient.from('ai_gateway_settings').select('*').eq('id', 1).single()
        if (gatewayError) throw gatewayError
        const { data: providers, error: providersError } = await adminClient.from('ai_provider_settings').select('provider,label,enabled,base_url,model,image_model,audio_model,input_cost_per_1k_usd,output_cost_per_1k_usd,api_key')
        if (providersError) throw providersError
        return new Response(JSON.stringify({
          activeProvider: gateway?.active_provider || 'openai',
          usdToToman: Number(gateway?.usd_to_toman || DEFAULT_USD_TO_TOMAN),
          chargeMultiplier: Number(gateway?.charge_multiplier || DEFAULT_CHARGE_MULTIPLIER),
          promptSettings: gateway?.prompt_settings || {},
          providers: (providers || []).map((p: any) => ({
            id: p.provider, label: p.label, enabled: p.enabled, apiKey: p.api_key ? '__stored__' : '',
            baseUrl: p.base_url, model: p.model, imageModel: p.image_model || '', audioModel: p.audio_model || '', inputCostPer1kUsd: Number(p.input_cost_per_1k_usd),
            outputCostPer1kUsd: Number(p.output_cost_per_1k_usd),
          })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const incoming = body.settings
      const incomingProviders = Array.isArray(incoming.providers) ? incoming.providers : []
      const activeIncoming = incomingProviders.find((p: any) => p.id === incoming.activeProvider)
      const normalizedActiveProvider = activeIncoming?.enabled
        ? incoming.activeProvider
        : (incomingProviders.find((p: any) => p.enabled)?.id || incoming.activeProvider || 'openai')
      const { error: settingsError } = await adminClient.from('ai_gateway_settings').upsert({
        id: 1, active_provider: normalizedActiveProvider, usd_to_toman: incoming.usdToToman,
        charge_multiplier: incoming.chargeMultiplier, prompt_settings: incoming.promptSettings || {}, updated_at: new Date().toISOString(),
      })
      if (settingsError) throw settingsError
      for (const p of incomingProviders) {
        const row: Record<string, unknown> = {
          provider: p.id, label: p.label, enabled: p.enabled, base_url: p.baseUrl, model: p.model, image_model: p.imageModel || null, audio_model: p.audioModel || null,
          input_cost_per_1k_usd: p.inputCostPer1kUsd, output_cost_per_1k_usd: p.outputCostPer1kUsd,
          updated_at: new Date().toISOString(),
        }
        if (p.apiKey && p.apiKey !== '__stored__') row.api_key = p.apiKey
        const { error: providerError } = await adminClient.from('ai_provider_settings').upsert(row)
        if (providerError) throw providerError
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.operation === 'admin_test_provider') {
      const { data: role } = await adminClient.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).limit(1)
      if (!role?.length) throw new Error('Admin access required')

      const incoming = body.provider || {}
      let apiKey = incoming.apiKey
      if (!apiKey || apiKey === '__stored__') {
        const { data: stored } = await adminClient.from('ai_provider_settings').select('api_key').eq('provider', incoming.id).single()
        apiKey = stored?.api_key
      }
      if (!apiKey) throw new Error('API key is empty or not stored for this provider')

      const provider: AiProviderConfig = {
        provider: incoming.id,
        label: incoming.label || incoming.id,
        enabled: true,
        api_key: apiKey,
        base_url: incoming.baseUrl || (incoming.id === 'kie' ? 'https://api.kie.ai' : ''),
        model: incoming.model,
        image_model: incoming.imageModel,
        audio_model: incoming.audioModel,
        input_cost_per_1k_usd: Number(incoming.inputCostPer1kUsd || 0),
        output_cost_per_1k_usd: Number(incoming.outputCostPer1kUsd || 0),
      }
      if (!provider.base_url || !provider.model) throw new Error('Base URL or model is missing')

      const routeResults: Array<{ kind: string; ok: boolean; model: string; message: string; sample?: string }> = []
      const runRoute = async (kind: string, model: string, runner: () => Promise<string>) => {
        try {
          const sample = await runner()
          routeResults.push({ kind, ok: true, model, message: 'OK', sample })
        } catch (error) {
          routeResults.push({ kind, ok: false, model, message: error instanceof Error ? error.message : 'Route test failed' })
        }
      }

      await runRoute('text', provider.model, async () => {
        const result = await callProvider(provider, 'Return exactly this Persian JSON: {"ok":true,"message":"اتصال برقرار است"}', 128)
        return result.text.slice(0, 300)
      })

      const imageModel = imageModelForProvider(provider)
      if (provider.provider === 'kie' || provider.image_model) {
        await runRoute('image', imageModel, async () => {
          const result = await callImageProvider(provider, 'یک آیکون ساده آبی از یک کتاب باز روی پس‌زمینه سفید', '1024x1024')
          return (result as any).imageUrl ? 'completed image response' : `task created: ${(result as any).taskId || 'pending'}`
        })
      }

      if (provider.provider === 'kie') {
        const audioModel = kieAudioModelForProvider(provider)
        await runRoute('audio', audioModel, async () => {
          const createRes = await fetch(`${kieBaseUrl(provider)}/api/v1/jobs/createTask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
            body: JSON.stringify({
              model: audioModel,
              input: kieAudioTaskInput(audioModel, 'سلام، این یک تست کوتاه اتصال صوتی متابوکی است.'),
            }),
          })
          const created = await createRes.json().catch(() => ({}))
          if (!createRes.ok) throw new Error(providerError(created, `KIE audio task failed (${createRes.status})`))
          const taskId = extractKieTaskId(created)
          if (!taskId) throw new Error(providerError(created, 'KIE audio did not return a task id'))
          return `task created: ${taskId}`
        })
      }

      const ok = routeResults.every(item => item.ok)
      return new Response(JSON.stringify({
        ok,
        provider: provider.label || provider.provider,
        model: provider.model,
        message: ok ? 'همه مسیرهای انتخاب‌شده با موفقیت پاسخ دادند.' : 'بعضی مسیرهای انتخاب‌شده خطا دارند.',
        sample: routeResults.map(item => `${item.kind}: ${item.ok ? 'OK' : 'ERROR'} / ${item.model}${item.sample ? ` / ${item.sample}` : ` / ${item.message}`}`).join('\n'),
        routes: routeResults,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: settings } = await adminClient.from('ai_gateway_settings').select('*').eq('id', 1).single()
    const activeProvider = settings?.active_provider || 'openai'
    const usdToToman = Number(settings?.usd_to_toman || DEFAULT_USD_TO_TOMAN)
    const chargeMultiplier = Number(settings?.charge_multiplier || DEFAULT_CHARGE_MULTIPLIER)
    const promptSettings = (settings?.prompt_settings || {}) as PromptSettings

    let { data: providerRow } = await adminClient
      .from('ai_provider_settings')
      .select('*')
      .eq('provider', activeProvider)
      .eq('enabled', true)
      .single()

    if (!providerRow?.api_key) {
      const { data: fallbackProvider } = await adminClient
        .from('ai_provider_settings')
        .select('*')
        .eq('enabled', true)
        .not('api_key', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      providerRow = fallbackProvider
    }

    const provider = providerRow as AiProviderConfig | null
    if (!provider?.api_key) throw new Error('AI provider is not configured')

    const { data: feeSettings } = await adminClient.from('platform_fee_settings').select('credits_per_toman').eq('id', 1).single()
    const creditsPerToman = Number(feeSettings?.credits_per_toman || 0.001)

    if (body.operation === 'estimate_image' || body.operation === 'generate_image' || body.operation === 'poll_image') {
      const rawPrompt = String(body.prompt || '').trim()
      if (!rawPrompt) throw new Error('Image prompt is empty')
      const prompt = imagePromptWithSettings(rawPrompt, String(body.purpose || 'direct'), promptSettings)
      const size = normalizeImageSize(body.size)
      const model = imageModelForProvider(provider)
      const usage = imageUsage(provider, prompt, usdToToman, chargeMultiplier, creditsPerToman)

      if (body.operation === 'poll_image') {
        if (provider.provider !== 'kie') throw new Error('Image polling is only available for KIE image tasks')
        const taskId = String(body.taskId || '').trim()
        const taskModel = String(body.model || model || '').trim()
        if (!taskId || !taskModel) throw new Error('KIE image task id or model is missing')

        const { data: existingOutput } = await adminClient
          .from('ai_saved_outputs')
          .select('content')
          .eq('user_id', user.id)
          .eq('action', 'image_generation')
          .filter('content->>taskId', 'eq', taskId)
          .maybeSingle()
        const existingImageUrl = (existingOutput?.content as any)?.imageUrl
        if (existingImageUrl) {
          return new Response(JSON.stringify({
            provider: provider.label || provider.provider,
            model: taskModel,
            prompt,
            purpose: body.purpose || 'direct',
            size,
            imageUrl: existingImageUrl,
            taskId,
            status: 'completed',
            usage,
            alreadyCharged: true,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const polled = await pollKieImageProvider(provider, taskId, taskModel)
        if (!polled.imageUrl) {
          return new Response(JSON.stringify({
            provider: provider.label || provider.provider,
            model: taskModel,
            prompt,
            purpose: body.purpose || 'direct',
            size,
            taskId,
            status: 'pending',
            usage,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { error: txError } = await userClient.rpc('charge_user_credits', {
          target_user_id: user.id,
          charge_amount: usage.chargedCredits,
          charge_description: `AI image generation: ${provider.provider}/${taskModel} ($${usage.chargedUsd.toFixed(6)})`,
        })
        if (txError) throw txError

        await adminClient.from('ai_usage_logs').insert({
          user_id: user.id,
          provider: provider.provider,
          model: taskModel,
          action: 'image_generation',
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          raw_usd: usage.rawUsd,
          charged_usd: usage.chargedUsd,
          charged_toman: usage.chargedToman,
          charged_credits: usage.chargedCredits,
        })

        await adminClient.from('ai_saved_outputs').insert({
          user_id: user.id,
          book_id: body.bookId || null,
          page_index: body.pageIndex ?? null,
          action: 'image_generation',
          content: { type: 'image', prompt, size, purpose: body.purpose || 'direct', imageUrl: polled.imageUrl, taskId },
        })

        return new Response(JSON.stringify({
          provider: provider.label || provider.provider,
          model: taskModel,
          prompt,
          purpose: body.purpose || 'direct',
          size,
          imageUrl: polled.imageUrl,
          taskId,
          status: 'completed',
          usage,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (body.operation === 'estimate_image') {
        return new Response(JSON.stringify({
          provider: provider.label || provider.provider,
          model,
          warning: imageModelWarning(provider),
          prompt,
          purpose: body.purpose || 'direct',
          size,
          usage,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const generated = await callImageProvider(provider, prompt, size)
      if ((generated as any).taskId && !(generated as any).imageUrl) {
        return new Response(JSON.stringify({
          provider: provider.label || provider.provider,
          model: generated.model,
          warning: imageModelWarning(provider),
          prompt,
          purpose: body.purpose || 'direct',
          size,
          taskId: (generated as any).taskId,
          status: 'pending',
          usage,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { error: txError } = await userClient.rpc('charge_user_credits', {
        target_user_id: user.id,
        charge_amount: usage.chargedCredits,
        charge_description: `AI image generation: ${provider.provider}/${generated.model} ($${usage.chargedUsd.toFixed(6)})`,
      })
      if (txError) throw txError

      await adminClient.from('ai_usage_logs').insert({
        user_id: user.id,
        provider: provider.provider,
        model: generated.model,
        action: 'image_generation',
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        raw_usd: usage.rawUsd,
        charged_usd: usage.chargedUsd,
        charged_toman: usage.chargedToman,
        charged_credits: usage.chargedCredits,
      })

      await adminClient.from('ai_saved_outputs').insert({
        user_id: user.id,
        book_id: body.bookId || null,
        page_index: body.pageIndex ?? null,
        action: 'image_generation',
        content: { type: 'image', prompt, size, purpose: body.purpose || 'direct', imageUrl: (generated as any).imageUrl },
      })

      return new Response(JSON.stringify({
        provider: provider.label || provider.provider,
        model: generated.model,
        warning: imageModelWarning(provider),
        prompt,
        purpose: body.purpose || 'direct',
        size,
        imageUrl: (generated as any).imageUrl,
        status: 'completed',
        usage,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const prompt = textPromptWithSettings(safeActionPrompt(body.action, body.bookTitle, body.pageTitle, body.pageText), String(body.action || ''), promptSettings)
    const maxTokens = maxOutputTokensForAction(body.action)

    if (body.operation === 'estimate_text') {
      const usage = estimatedTextUsage(provider, prompt, String(body.action || ''), maxTokens, usdToToman, chargeMultiplier, creditsPerToman)
      return new Response(JSON.stringify({
        provider: provider.label || provider.provider,
        model: provider.model,
        action: body.action,
        promptTokens: usage.inputTokens,
        maxOutputTokens: usage.outputTokens,
        usage,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { text, inputTokens, outputTokens } = await callProvider(provider, prompt, maxTokens)

    const rawUsd = (inputTokens / 1000) * Number(provider.input_cost_per_1k_usd) + (outputTokens / 1000) * Number(provider.output_cost_per_1k_usd)
    const chargedUsd = rawUsd * chargeMultiplier
    const chargedToman = Math.ceil(chargedUsd * usdToToman)

    const chargedCredits = Math.max(1, Math.ceil(chargedToman * creditsPerToman))

    const content = parseStructuredContent(text)
    const { error: txError } = await userClient.rpc('charge_user_credits', {
      target_user_id: user.id,
      charge_amount: chargedCredits,
      charge_description: `AI usage: ${provider.provider}/${provider.model} ($${chargedUsd.toFixed(6)})`,
    })
    if (txError) throw txError

    await adminClient.from('ai_usage_logs').insert({
      user_id: user.id,
      provider: provider.provider,
      model: provider.model,
      action: body.action,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      raw_usd: rawUsd,
      charged_usd: chargedUsd,
      charged_toman: chargedToman,
      charged_credits: chargedCredits,
    })

    await adminClient.from('ai_saved_outputs').insert({ user_id: user.id, book_id: body.bookId || null, page_index: body.pageIndex ?? null, action: body.action, content })

    return new Response(JSON.stringify({
      text: '',
      content,
      provider: provider.label || provider.provider,
      model: provider.model,
      usage: { inputTokens, outputTokens, rawUsd, chargedUsd, chargedToman, chargedCredits, creditValueToman: Math.round(1 / creditsPerToman) },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI gateway failed'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
