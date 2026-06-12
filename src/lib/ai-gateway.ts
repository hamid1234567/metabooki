import { supabase } from '@/integrations/supabase/client'
import type { AppUser } from '@/lib/auth-context'

export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'custom'
export type ReaderAiAction = 'summary' | 'quiz' | 'mindmap' | 'learning_path' | 'explain'
export type AiStructuredContent =
  | { type: 'quiz'; question: string; options: string[]; correctIndex: number; explanation: string }
  | { type: 'timeline'; title: string; steps: Array<{ title: string; description: string }> }
  | { type: 'mindmap'; title: string; branches: Array<{ title: string; items: string[] }> }
  | { type: 'article'; title: string; lead?: string; sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }> }

export interface AiProviderConfig {
  id: AiProvider
  label: string
  enabled: boolean
  apiKey: string
  baseUrl?: string
  model: string
  inputCostPer1kUsd: number
  outputCostPer1kUsd: number
}

export interface AiGatewaySettings {
  activeProvider: AiProvider
  usdToToman: number
  chargeMultiplier: number
  providers: AiProviderConfig[]
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

export const DEFAULT_USD_TO_TOMAN = 170_000
export const DEFAULT_AI_CHARGE_MULTIPLIER = 2

const defaultProviders: AiProviderConfig[] = [
  { id: 'openai', label: 'OpenAI / ChatGPT', enabled: true, apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
  { id: 'gemini', label: 'Google Gemini', enabled: false, apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', inputCostPer1kUsd: 0.000075, outputCostPer1kUsd: 0.0003 },
  { id: 'anthropic', label: 'Anthropic Claude', enabled: false, apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-haiku-20240307', inputCostPer1kUsd: 0.00025, outputCostPer1kUsd: 0.00125 },
  { id: 'custom', label: 'سرویس سفارشی OpenAI-compatible', enabled: false, apiKey: '', baseUrl: '', model: 'custom-model', inputCostPer1kUsd: 0.00015, outputCostPer1kUsd: 0.0006 },
]

export const defaultAiGatewaySettings: AiGatewaySettings = {
  activeProvider: 'openai',
  usdToToman: DEFAULT_USD_TO_TOMAN,
  chargeMultiplier: DEFAULT_AI_CHARGE_MULTIPLIER,
  providers: defaultProviders,
}

export function loadAiGatewaySettings(): AiGatewaySettings {
  return defaultAiGatewaySettings
}

export async function loadAiGatewaySettingsRemote(): Promise<AiGatewaySettings> {
  const { data, error } = await supabase.functions.invoke('ai-gateway', { body: { operation: 'admin_get_settings' } })
  if (error) throw new Error(error.message)
  return data as AiGatewaySettings
}

export async function saveAiGatewaySettings(settings: AiGatewaySettings) {
  const { error } = await supabase.functions.invoke('ai-gateway', { body: { operation: 'admin_save_settings', settings } })
  if (error) throw new Error(error.message)
}

export function maskApiKey(key: string) {
  return key ? 'ذخیره‌شده روی سرور' : 'وارد نشده'
}

export async function runAiThroughGateway(request: RunAiRequest): Promise<RunAiResult> {
  if (!request.user) throw new Error('برای استفاده از دستیار هوش مصنوعی ابتدا وارد حساب شوید.')
  if (!request.pageText.trim()) throw new Error('متنی در این صفحه برای تحلیل پیدا نشد.')
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))
  if (!hasSupabase) throw new Error('برای استفاده امن از هوش مصنوعی، اتصال Supabase و Edge Function را فعال کنید.')

  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { action: request.action, bookTitle: request.bookTitle, pageTitle: request.pageTitle, pageText: request.pageText, bookId: request.bookId, pageIndex: request.pageIndex },
  })
  if (error) throw new Error(error.message || 'اجرای درخواست هوش مصنوعی ناموفق بود.')
  return data as RunAiResult
}
