import { supabase } from '@/integrations/supabase/client'
import { buildAiImagePrompt, imageSizeForPurpose, type AiImagePurpose, type AiImageSize, type BookCoverPromptContext } from '@/lib/ai-image-prompts'
import type { AppUser } from '@/lib/auth-context'

export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'custom' | 'kie'
export type ReaderAiAction = 'summary' | 'quiz' | 'mindmap' | 'learning_path' | 'explain' | 'callout_suggestions'
export type AiStructuredContent =
  | { type: 'quiz'; question: string; options: string[]; correctIndex: number; explanation: string }
  | { type: 'timeline'; title: string; steps: Array<{ title: string; description: string }> }
  | { type: 'mindmap'; title: string; branches: Array<{ title: string; items: string[] }> }
  | { type: 'callout_suggestions'; suggestions: Array<{ variant: string; title: string; text: string; sourceQuote: string; reason?: string }> }
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

export const KIE_TEXT_MODEL_OPTIONS: AiProviderModelOption[] = [
  { id: 'gpt-5-5', label: 'GPT 5.5 Response', inputCostPer1kUsd: 0.00127, outputCostPer1kUsd: 0.01, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-4', label: 'GPT 5.4 Response', inputCostPer1kUsd: 0.001, outputCostPer1kUsd: 0.008, note: 'KIE /codex/v1/responses' },
  { id: 'gpt-5-2', label: 'GPT 5.2 Response', inputCostPer1kUsd: 0.00044, outputCostPer1kUsd: 0.0035, note: 'lower-cost text model' },
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
  { id: 'gpt-image-2-text-to-image', label: 'GPT Image 2 - text to image', baseCostUsd: 0.05 },
  { id: 'gpt-image-2-edit-image', label: 'GPT Image 2 - edit image', baseCostUsd: 0.05 },
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
  readerCalloutSuggestions: '',
}

const defaultProviders: AiProviderConfig[] = [
  { id: 'openai', label: 'OpenAI / ChatGPT', enabled: true, apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', imageModel: 'gpt-image-1', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
  { id: 'gemini', label: 'Google Gemini', enabled: false, apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', inputCostPer1kUsd: 0.000075, outputCostPer1kUsd: 0.0003 },
  { id: 'anthropic', label: 'Anthropic Claude', enabled: false, apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-haiku-20240307', inputCostPer1kUsd: 0.00025, outputCostPer1kUsd: 0.00125 },
  { id: 'custom', label: 'سرویس سفارشی OpenAI-compatible', enabled: false, apiKey: '', baseUrl: '', model: 'custom-model', imageModel: 'gpt-image-1', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
  { id: 'kie', label: 'KIE.ai unified API', enabled: false, apiKey: '', baseUrl: 'https://api.kie.ai', model: 'gpt-5-5', imageModel: 'gpt-image-2-text-to-image', audioModel: 'elevenlabs/text-to-dialogue-v3', inputCostPer1kUsd: 0.00127, outputCostPer1kUsd: 0.01 },
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
    return merged.id === 'kie' ? { ...merged, audioModel: normalizeKieAudioModel(merged.audioModel) } : merged
  })
  for (const provider of incomingProviders) {
    if (!providers.some(item => item.id === provider.id)) providers.push(provider.id === 'kie' ? { ...provider, audioModel: normalizeKieAudioModel(provider.audioModel) } : provider)
  }
  const activeProvider = settings?.activeProvider && providers.some(provider => provider.id === settings.activeProvider)
    ? settings.activeProvider
    : defaultAiGatewaySettings.activeProvider
  return {
    activeProvider,
    usdToToman: Number(settings?.usdToToman || defaultAiGatewaySettings.usdToToman),
    chargeMultiplier: Number(settings?.chargeMultiplier || defaultAiGatewaySettings.chargeMultiplier),
    providers,
    promptSettings: { ...defaultAiPromptSettings, ...(settings?.promptSettings || {}) },
  }
}

export async function loadAiGatewaySettingsRemote(): Promise<AiGatewaySettings> {
  const { data, error } = await supabase.functions.invoke('ai-gateway', { body: { operation: 'admin_get_settings' } })
  if (error) throw new Error(error.message)
  return mergeAiGatewaySettings(data as Partial<AiGatewaySettings>)
}

export async function saveAiGatewaySettings(settings: AiGatewaySettings) {
  const { error } = await supabase.functions.invoke('ai-gateway', { body: { operation: 'admin_save_settings', settings } })
  if (error) throw new Error(error.message)
}

export async function testAiProvider(provider: AiProviderConfig): Promise<AiProviderTestResult> {
  const { data, error } = await supabase.functions.invoke('ai-gateway', { body: { operation: 'admin_test_provider', provider } })
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

  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { action: request.action, bookTitle: request.bookTitle, pageTitle: request.pageTitle, pageText: request.pageText, bookId: request.bookId, pageIndex: request.pageIndex },
  })
  if (error) throw await gatewayError(error, 'اجرای درخواست هوش مصنوعی ناموفق بود.')
  return data as RunAiResult
}

export async function estimateAiTextUsage(request: RunAiRequest): Promise<AiTextEstimateResult> {
  if (!request.user) throw new Error('برای استفاده از دستیار هوش مصنوعی ابتدا وارد حساب شوید.')
  if (!request.pageText.trim()) throw new Error('متنی برای تحلیل پیدا نشد.')
  if (!hasSupabaseConnection()) throw new Error('برای استفاده امن از هوش مصنوعی، اتصال Supabase و Edge Function را فعال کنید.')

  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { operation: 'estimate_text', action: request.action, bookTitle: request.bookTitle, pageTitle: request.pageTitle, pageText: request.pageText, bookId: request.bookId, pageIndex: request.pageIndex },
  })
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
  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { operation: 'estimate_image', prompt: prepared.prompt, purpose: prepared.purpose, size: prepared.size, bookId: request.bookId, pageIndex: request.pageIndex },
  })
  if (error) throw await gatewayError(error, 'برآورد هزینه تولید تصویر ناموفق بود.')
  return data as AiImageEstimateResult
}

export async function generateAiImageThroughGateway(request: AiImageRequest): Promise<AiImageGenerationResult> {
  const prepared = prepareImageRequest(request)
  if (!request.user) throw new Error('برای تولید تصویر ابتدا وارد حساب شوید.')
  if (!request.prompt.trim()) throw new Error('برای تولید تصویر، متن انتخاب‌شده یا پرامپت لازم است.')
  if (!hasSupabaseConnection()) throw new Error('اتصال Supabase و Edge Function برای تولید تصویر فعال نیست.')
  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { operation: 'generate_image', prompt: prepared.prompt, purpose: prepared.purpose, size: prepared.size, bookId: request.bookId, pageIndex: request.pageIndex },
  })
  if (error) throw await gatewayError(error, 'تولید تصویر ناموفق بود.')
  let result = data as AiImagePendingResult
  if (result?.status === 'pending' && result.taskId) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2500))
      const { data: pollData, error: pollError } = await supabase.functions.invoke('ai-gateway', {
        body: {
          operation: 'poll_image',
          taskId: result.taskId,
          model: result.model,
          prompt: prepared.prompt,
          purpose: prepared.purpose,
          size: prepared.size,
          bookId: request.bookId,
          pageIndex: request.pageIndex,
        },
      })
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
