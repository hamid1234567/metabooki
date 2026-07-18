import { supabase } from '@/integrations/supabase/client'
import { buildAiImagePrompt, imageSizeForPurpose, type AiImagePurpose, type AiImageSize, type BookCoverPromptContext } from '@/lib/ai-image-prompts'
import type { AppUser } from '@/lib/auth-context'

const AI_GATEWAY_TIMEOUT_MS = 45_000
const AI_GATEWAY_TEXT_TIMEOUT_MS = 120_000
const AI_GATEWAY_POLL_TIMEOUT_MS = 25_000

export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'custom' | 'kie'
export type ReaderAiAction = 'summary' | 'quiz' | 'mindmap' | 'learning_path' | 'explain' | 'callout_suggestions'
export type AiStructuredContent =
  | { type: 'quiz'; question: string; options: string[]; correctIndex: number; explanation: string }
  | { type: 'timeline'; title: string; steps: Array<{ title: string; description: string }> }
  | { type: 'mindmap'; title: string; branches: Array<{ title: string; items: string[] }> }
  | { type: 'callout_suggestions'; suggestions: Array<{ suggestionType?: string; variant?: string; title?: string; text?: string; sourceQuote: string; action?: string; reason?: string; importance?: string; placementHint?: string }> }
  | { type: 'article'; title: string; lead?: string; sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }> }

export interface AiProviderConfig {
  id: AiProvider
  label: string
  enabled: boolean
  apiKey: string
  baseUrl?: string
  model: string
  imageModel?: string
  audioModel?: string
  inputCostPer1kUsd: number
  outputCostPer1kUsd: number
}

export type AiPromptSettings = {
  textGlobal: string
  imageGlobal: string
  imageInteractive: string
  imageBookCover: string
  imageDirect: string
  readerSummary: string
  readerQuiz: string
  readerMindmap: string
  readerLearningPath: string
  readerExplain: string
  readerCalloutSuggestions: string
}

export interface AiGatewaySettings {
  activeProvider: AiProvider
  usdToToman: number
  chargeMultiplier: number
  providers: AiProviderConfig[]
  promptSettings: AiPromptSettings
}

export interface RunAiRequest {
  action: ReaderAiAction
  bookTitle: string
  pageTitle?: string
  pageText: string
  bookId?: string
  pageIndex?: number
  sourcePageCount?: number
  minSuggestions?: number
  user: AppUser | null
}

export interface RunAiResult {
  text: string
  content?: AiStructuredContent
  provider: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    rawUsd: number
    chargedUsd: number
    chargedToman: number
    chargedCredits: number
    creditValueToman: number
  }
}

export interface AiTextEstimateResult {
  provider: string
  model: string
  action: ReaderAiAction
  promptTokens: number
  maxOutputTokens: number
  usage: RunAiResult['usage']
  estimateDetails?: {
    inputTokens: number
    minimumOutputTokens: number
    maximumOutputTokens: number
    estimatedOutputTokens: number
    outputFormula: string
    inputCostPer1kUsd: number
    outputCostPer1kUsd: number
    rawUsd: number
    chargeMultiplier: number
    chargedUsd: number
    usdToToman: number
    chargedToman: number
    creditsPerToman: number
    creditValueToman: number
    chargedCredits: number
    sourcePageCount?: number
    minSuggestions?: number
  }
}

export interface AiImageUsage {
  inputTokens: number
  outputTokens: number
  rawUsd: number
  chargedUsd: number
  chargedToman: number
  chargedCredits: number
  creditValueToman: number
}

export interface AiImageEstimateResult {
  provider: string
  model: string
  warning?: string
  prompt: string
  purpose?: AiImagePurpose
  size?: AiImageSize
  usage: AiImageUsage
}

export interface AiImageGenerationResult extends AiImageEstimateResult {
  imageUrl: string
  status?: 'completed'
  taskId?: string
  alreadyCharged?: boolean
}

export interface AiImageRequest {
  prompt: string
  purpose?: AiImagePurpose
  size?: AiImageSize
  cover?: BookCoverPromptContext
  bookId?: string
  pageIndex?: number
  user: AppUser | null
}

export interface AiProviderTestResult {
  ok: boolean
  provider: string
  model: string
  message: string
  sample?: string
  routes?: Array<{ kind: string; ok: boolean; model: string; message: string; sample?: string; skipped?: boolean }>
}

type AiImagePendingResult = AiImageEstimateResult & {
  imageUrl?: string
  status?: 'pending' | 'completed'
  taskId?: string
}

function invokeAiGateway<T>(body: Record<string, unknown>, timeoutMessage: string, timeoutMs = AI_GATEWAY_TIMEOUT_MS) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })
  return Promise.race([
    supabase.functions.invoke('ai-gateway', { body }),
    timeout,
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  }) as Promise<{ data: T | null; error: any }>
}

export type AiProviderModelOption = {
  id: string
  label: string
  inputCostPer1kUsd: number
  outputCostPer1kUsd: number
  note?: string
}

export type AiProviderImageModelOption = {
  id: string
  label: string
  baseCostUsd: number
  note?: string
}

export type AiProviderAudioModelOption = {
  id: string
  label: string
  baseCostUsd: number
  note?: string
}

export const DEFAULT_USD_TO_TOMAN = 170_000
export const DEFAULT_AI_CHARGE_MULTIPLIER = 2
export const DEFAULT_CALLOUT_SUGGESTION_PROMPT = `به‌عنوان ویراستار حرفه‌ای کتاب دیجیتال، متن زیر را بررسی کن و پیشنهادهایی برای بهبود خوانایی، جذابیت بصری و یادگیری ارائه بده.

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

export const KIE_TEXT_MODEL_OPTIONS: AiProviderModelOption[] = [
  { id: 'gpt-5-6-luna', label: 'GPT 5.6 Luna', inputCostPer1kUsd: 0.001, outputCostPer1kUsd: 0.006, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-6-terra', label: 'GPT 5.6 Terra', inputCostPer1kUsd: 0.0025, outputCostPer1kUsd: 0.015, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-6-sol', label: 'GPT 5.6 Sol', inputCostPer1kUsd: 0.005, outputCostPer1kUsd: 0.03, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-5', label: 'GPT 5.5 Response', inputCostPer1kUsd: 0.00127, outputCostPer1kUsd: 0.01, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-4', label: 'GPT 5.4 Response', inputCostPer1kUsd: 0.001, outputCostPer1kUsd: 0.008, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-2', label: 'GPT 5.2 Chat', inputCostPer1kUsd: 0.00044, outputCostPer1kUsd: 0.0035, note: 'KIE /gpt-5-2/v1/chat/completions' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', inputCostPer1kUsd: 0.015, outputCostPer1kUsd: 0.075, note: 'KIE /claude/v1/messages' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', inputCostPer1kUsd: 0.015, outputCostPer1kUsd: 0.075, note: 'KIE /claude/v1/messages' },
  { id: 'claude-fable-5', label: 'Claude Fable 5', inputCostPer1kUsd: 0.006, outputCostPer1kUsd: 0.03, note: 'KIE /claude/v1/messages' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', inputCostPer1kUsd: 0.003, outputCostPer1kUsd: 0.015, note: 'KIE /claude/v1/messages' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', inputCostPer1kUsd: 0.0008, outputCostPer1kUsd: 0.004, note: 'KIE /claude/v1/messages' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', inputCostPer1kUsd: 0.015, outputCostPer1kUsd: 0.075, note: 'KIE /claude/v1/messages' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', inputCostPer1kUsd: 0.003, outputCostPer1kUsd: 0.015, note: 'KIE /claude/v1/messages' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', inputCostPer1kUsd: 0.0003, outputCostPer1kUsd: 0.0025, note: 'KIE chat completions' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', inputCostPer1kUsd: 0.00125, outputCostPer1kUsd: 0.01, note: 'KIE chat completions' },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', inputCostPer1kUsd: 0.00125, outputCostPer1kUsd: 0.01, note: 'KIE chat completions' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', inputCostPer1kUsd: 0.00125, outputCostPer1kUsd: 0.01, note: 'KIE chat completions' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', inputCostPer1kUsd: 0.0003, outputCostPer1kUsd: 0.0025, note: 'KIE chat completions' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', inputCostPer1kUsd: 0.0003, outputCostPer1kUsd: 0.0025, note: 'KIE chat completions' },
  { id: 'grok-4-3', label: 'Grok 4.3', inputCostPer1kUsd: 0.003, outputCostPer1kUsd: 0.015, note: 'KIE /grok/v1/responses' },
]

export const KIE_IMAGE_MODEL_OPTIONS: AiProviderImageModelOption[] = [
  { id: 'gpt-image/1.5-text-to-image', label: 'GPT Image 1.5 - text to image', baseCostUsd: 0.04 },
  { id: 'gpt-image-2-text-to-image', label: 'GPT Image 2 - text to image', baseCostUsd: 0.05 },
  { id: 'gpt-image-2-edit-image', label: 'GPT Image 2 - edit image', baseCostUsd: 0.05 },
  { id: 'seedream/5-lite-text-to-image', label: 'Seedream 5 Lite - text to image', baseCostUsd: 0.03 },
  { id: 'seedream/5-pro-text-to-image', label: 'Seedream 5 Pro - text to image', baseCostUsd: 0.04 },
  { id: 'bytedance/seedream-v4-text-to-image', label: 'Seedream v4 - text to image', baseCostUsd: 0.03 },
  { id: '4o-image', label: '4o Image generation', baseCostUsd: 0.03 },
  { id: 'qwen/text-to-image', label: 'Qwen - Text to Image', baseCostUsd: 0.0125 },
  { id: 'qwen2/text-to-image', label: 'Qwen2 - Text to Image', baseCostUsd: 0.027 },
  { id: 'nano-banana-2', label: 'Google Nano Banana 2', baseCostUsd: 0.03 },
  { id: 'nano-banana-2-lite', label: 'Google Nano Banana 2 Lite', baseCostUsd: 0.02 },
]

export const KIE_AUDIO_MODEL_OPTIONS: AiProviderAudioModelOption[] = [
  { id: 'elevenlabs/text-to-dialogue-v3', label: 'ElevenLabs v3 Dialogue', baseCostUsd: 0.02, note: 'KIE createTask speech generation' },
  { id: 'elevenlabs/text-to-speech', label: 'ElevenLabs Text to Speech', baseCostUsd: 0.018, note: 'KIE createTask speech generation' },
  { id: 'elevenlabs/sound-effects', label: 'ElevenLabs Sound Effects', baseCostUsd: 0.02, note: 'KIE createTask sound effects' },
]

export const defaultAiPromptSettings: AiPromptSettings = {
  textGlobal: '',
  imageGlobal: '',
  imageInteractive: '',
  imageBookCover: '',
  imageDirect: '',
  readerSummary: '',
  readerQuiz: '',
  readerMindmap: '',
  readerLearningPath: '',
  readerExplain: '',
  readerCalloutSuggestions: DEFAULT_CALLOUT_SUGGESTION_PROMPT,
}

const defaultProviders: AiProviderConfig[] = [
  { id: 'openai', label: 'OpenAI / ChatGPT', enabled: true, apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', imageModel: 'gpt-image-1', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
  { id: 'gemini', label: 'Google Gemini', enabled: false, apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', inputCostPer1kUsd: 0.000075, outputCostPer1kUsd: 0.0003 },
  { id: 'anthropic', label: 'Anthropic Claude', enabled: false, apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-haiku-20240307', inputCostPer1kUsd: 0.00025, outputCostPer1kUsd: 0.00125 },
  { id: 'custom', label: 'سرویس سفارشی OpenAI-compatible', enabled: false, apiKey: '', baseUrl: '', model: 'custom-model', imageModel: 'gpt-image-1', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
  { id: 'kie', label: 'KIE.ai unified API', enabled: false, apiKey: '', baseUrl: 'https://api.kie.ai', model: 'gpt-5-6-luna', imageModel: 'gpt-image/1.5-text-to-image', audioModel: 'elevenlabs/text-to-dialogue-v3', inputCostPer1kUsd: 0.001, outputCostPer1kUsd: 0.006 },
]

export const defaultAiGatewaySettings: AiGatewaySettings = {
  activeProvider: 'openai',
  usdToToman: DEFAULT_USD_TO_TOMAN,
  chargeMultiplier: DEFAULT_AI_CHARGE_MULTIPLIER,
  providers: defaultProviders,
  promptSettings: defaultAiPromptSettings,
}

function hasSupabaseConnection() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))
}

function normalizeKieAudioModel(model?: string) {
  if (model === 'elevenlabs-v3' || model === 'elevenlabs-turbo-v2-5') return 'elevenlabs/text-to-dialogue-v3'
  if (model === 'elevenlabs-v2') return 'elevenlabs/text-to-speech'
  if (model === 'elevenlabs-sfx') return 'elevenlabs/sound-effects'
  return model
}

function normalizeKieImageModel(model?: string) {
  if (model === 'gpt-image-1.5') return 'gpt-image/1.5-text-to-image'
  if (model === 'seedream-v5' || model === 'seedream-5-lite') return 'seedream/5-lite-text-to-image'
  if (model === 'seedream-5-pro') return 'seedream/5-pro-text-to-image'
  if (model === 'seedream-v4') return 'bytedance/seedream-v4-text-to-image'
  return model
}

async function gatewayError(error: unknown, fallback: string) {
  let contextMessage = ''
  const context = (error as any)?.context
  if (context && typeof context.json === 'function') {
    try {
      const json = await context.clone().json()
      contextMessage = json?.error || json?.message || ''
    } catch {
      contextMessage = ''
    }
  }
  if (!contextMessage && context && typeof context.text === 'function') {
    try {
      contextMessage = await context.clone().text()
    } catch {
      contextMessage = ''
    }
  }
  const details = contextMessage || (error as any)?.context?.error || (error as any)?.context?.message || (error as Error)?.message
  return new Error(details || fallback)
}

export function loadAiGatewaySettings(): AiGatewaySettings {
  return defaultAiGatewaySettings
}

function mergeAiGatewaySettings(settings: Partial<AiGatewaySettings> | null | undefined): AiGatewaySettings {
  const incomingProviders = Array.isArray(settings?.providers) ? settings.providers : []
  const providers = defaultProviders.map(defaultProvider => {
    const incoming = incomingProviders.find(provider => provider.id === defaultProvider.id)
    const merged = incoming ? { ...defaultProvider, ...incoming } : defaultProvider
    return merged.id === 'kie'
      ? { ...merged, imageModel: normalizeKieImageModel(merged.imageModel), audioModel: normalizeKieAudioModel(merged.audioModel) }
      : merged
  })
  for (const provider of incomingProviders) {
    if (!providers.some(item => item.id === provider.id)) {
      providers.push(provider.id === 'kie'
        ? { ...provider, imageModel: normalizeKieImageModel(provider.imageModel), audioModel: normalizeKieAudioModel(provider.audioModel) }
        : provider)
    }
  }
  const activeProvider = settings?.activeProvider && providers.some(provider => provider.id === settings.activeProvider)
    ? settings.activeProvider
    : defaultAiGatewaySettings.activeProvider
  return {
    activeProvider,
    usdToToman: Number(settings?.usdToToman || defaultAiGatewaySettings.usdToToman),
    chargeMultiplier: Number(settings?.chargeMultiplier || defaultAiGatewaySettings.chargeMultiplier),
    providers,
    promptSettings: {
      ...defaultAiPromptSettings,
      ...(settings?.promptSettings || {}),
      readerCalloutSuggestions: String(settings?.promptSettings?.readerCalloutSuggestions || '').trim() || defaultAiPromptSettings.readerCalloutSuggestions,
    },
  }
}

export async function loadAiGatewaySettingsRemote(): Promise<AiGatewaySettings> {
  const { data, error } = await invokeAiGateway<Partial<AiGatewaySettings>>({ operation: 'admin_get_settings' }, 'خواندن تنظیمات هوش مصنوعی زمان‌بر شد. اتصال Edge Function را بررسی کنید.')
  if (error) throw new Error(error.message)
  return mergeAiGatewaySettings(data as Partial<AiGatewaySettings>)
}

export async function saveAiGatewaySettings(settings: AiGatewaySettings) {
  const { error } = await invokeAiGateway({ operation: 'admin_save_settings', settings }, 'ذخیره تنظیمات هوش مصنوعی زمان‌بر شد. دوباره تلاش کنید.')
  if (error) throw new Error(error.message)
}

export async function testAiProvider(provider: AiProviderConfig): Promise<AiProviderTestResult> {
  const { data, error } = await invokeAiGateway<AiProviderTestResult>({ operation: 'admin_test_provider', provider }, 'تست مسیر هوش مصنوعی زمان‌بر شد. Edge Function یا ارائه‌دهنده را بررسی کنید.')
  if (error) throw await gatewayError(error, 'تست کلید هوش مصنوعی ناموفق بود.')
  return data as AiProviderTestResult
}

export function maskApiKey(key: string) {
  return key ? 'ذخیره‌شده روی سرور' : 'وارد نشده'
}

export async function runAiThroughGateway(request: RunAiRequest): Promise<RunAiResult> {
  if (!request.user) throw new Error('برای استفاده از دستیار هوش مصنوعی ابتدا وارد حساب شوید.')
  if (!request.pageText.trim()) throw new Error('متنی در این صفحه برای تحلیل پیدا نشد.')
  if (!hasSupabaseConnection()) throw new Error('برای استفاده امن از هوش مصنوعی، اتصال Supabase و Edge Function را فعال کنید.')

  const { data, error } = await invokeAiGateway<RunAiResult>(
    { action: request.action, bookTitle: request.bookTitle, pageTitle: request.pageTitle, pageText: request.pageText, bookId: request.bookId, pageIndex: request.pageIndex, sourcePageCount: request.sourcePageCount, minSuggestions: request.minSuggestions },
    'پاسخ هوش مصنوعی بیش از حد طول کشید. اگر هزینه‌ای کسر شد، تاریخچه خروجی‌ها را بررسی کنید و سپس دوباره تلاش کنید.',
    AI_GATEWAY_TEXT_TIMEOUT_MS,
  )
  if (error) throw await gatewayError(error, 'اجرای درخواست هوش مصنوعی ناموفق بود.')
  return data as RunAiResult
}

export async function estimateAiTextUsage(request: RunAiRequest): Promise<AiTextEstimateResult> {
  if (!request.user) throw new Error('برای استفاده از دستیار هوش مصنوعی ابتدا وارد حساب شوید.')
  if (!request.pageText.trim()) throw new Error('متنی برای تحلیل پیدا نشد.')
  if (!hasSupabaseConnection()) throw new Error('برای استفاده امن از هوش مصنوعی، اتصال Supabase و Edge Function را فعال کنید.')

  const { data, error } = await invokeAiGateway<AiTextEstimateResult>(
    { operation: 'estimate_text', action: request.action, bookTitle: request.bookTitle, pageTitle: request.pageTitle, pageText: request.pageText, bookId: request.bookId, pageIndex: request.pageIndex, sourcePageCount: request.sourcePageCount, minSuggestions: request.minSuggestions },
    'برآورد هزینه هوش مصنوعی بیش از حد طول کشید. اتصال Edge Function را بررسی کنید.',
  )
  if (error) throw await gatewayError(error, 'برآورد هزینه هوش مصنوعی ناموفق بود.')
  return data as AiTextEstimateResult
}

function prepareImageRequest(request: AiImageRequest) {
  const purpose = request.purpose || 'direct'
  const prompt = buildAiImagePrompt({ purpose, prompt: request.prompt, cover: request.cover })
  const size = request.size || imageSizeForPurpose(purpose)
  return { ...request, purpose, prompt, size }
}

export async function estimateAiImageGeneration(request: AiImageRequest): Promise<AiImageEstimateResult> {
  const prepared = prepareImageRequest(request)
  if (!request.user) throw new Error('برای تولید تصویر ابتدا وارد حساب شوید.')
  if (!request.prompt.trim()) throw new Error('برای تولید تصویر، متن انتخاب‌شده یا پرامپت لازم است.')
  if (!hasSupabaseConnection()) throw new Error('اتصال Supabase و Edge Function برای تولید تصویر فعال نیست.')
  const { data, error } = await invokeAiGateway<AiImageEstimateResult>(
    { operation: 'estimate_image', prompt: prepared.prompt, purpose: prepared.purpose, size: prepared.size, bookId: request.bookId, pageIndex: request.pageIndex },
    'برآورد هزینه تولید تصویر بیش از حد طول کشید. اتصال Edge Function را بررسی کنید.',
  )
  if (error) throw await gatewayError(error, 'برآورد هزینه تولید تصویر ناموفق بود.')
  return data as AiImageEstimateResult
}

export async function generateAiImageThroughGateway(request: AiImageRequest): Promise<AiImageGenerationResult> {
  const prepared = prepareImageRequest(request)
  if (!request.user) throw new Error('برای تولید تصویر ابتدا وارد حساب شوید.')
  if (!request.prompt.trim()) throw new Error('برای تولید تصویر، متن انتخاب‌شده یا پرامپت لازم است.')
  if (!hasSupabaseConnection()) throw new Error('اتصال Supabase و Edge Function برای تولید تصویر فعال نیست.')
  const { data, error } = await invokeAiGateway<AiImagePendingResult>(
    { operation: 'generate_image', prompt: prepared.prompt, purpose: prepared.purpose, size: prepared.size, bookId: request.bookId, pageIndex: request.pageIndex },
    'ارسال درخواست تولید تصویر بیش از حد طول کشید. اتصال Edge Function یا سرویس تصویر را بررسی کنید.',
  )
  if (error) throw await gatewayError(error, 'تولید تصویر ناموفق بود.')
  let result = data as AiImagePendingResult
  if (result?.status === 'pending' && result.taskId) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2500))
      const { data: pollData, error: pollError } = await invokeAiGateway<AiImagePendingResult>(
        {
          operation: 'poll_image',
          taskId: result.taskId,
          model: result.model,
          prompt: prepared.prompt,
          purpose: prepared.purpose,
          size: prepared.size,
          bookId: request.bookId,
          pageIndex: request.pageIndex,
        },
        'بررسی وضعیت تولید تصویر بیش از حد طول کشید. کمی بعد تاریخچه خروجی‌ها را تازه‌سازی کنید.',
        AI_GATEWAY_POLL_TIMEOUT_MS,
      )
      if (pollError) throw await gatewayError(pollError, 'بررسی وضعیت تولید تصویر ناموفق بود.')
      result = pollData as AiImagePendingResult
      if (result?.imageUrl) break
    }
  }
  if (!result?.imageUrl) {
    const model = result?.model || 'unknown'
    throw new Error(`هوش مصنوعی تصویری برنگرداند. مدل گزارش‌شده: ${model}. برای تولید تصویر باید فیلد «مدل تولید تصویر» روی مدلی مثل gpt-image-1 باشد، نه مدل متنی مثل gpt-4o.`)
  }
  return result as AiImageGenerationResult
}
