import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_USD_TO_TOMAN = 170_000
const DEFAULT_CHARGE_MULTIPLIER = 2

type AiProviderConfig = {
  provider: string
  label: string
  enabled: boolean
  api_key: string
  base_url: string
  model: string
  input_cost_per_1k_usd: number
  output_cost_per_1k_usd: number
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil((text || '').trim().length / 4))
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
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(cleaned)
}

function safeActionPrompt(action: string, bookTitle: string, pageTitle: string | undefined, pageText: string) {
  const header = `Book: ${bookTitle}\n${pageTitle ? `Page title: ${pageTitle}\n` : ''}Page text:\n${pageText}`
  const common = 'Answer only from this page text. Do not invent facts. Write fluent Persian. Return only valid JSON without markdown.'
  if (action === 'quiz') return `${common}\nUse: {"type":"quiz","question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}\nCreate exactly one single-answer multiple-choice question.\n\n${header}`
  if (action === 'mindmap') return `${common}\nUse: {"type":"mindmap","title":"...","branches":[{"title":"...","items":["..."]}]}\n\n${header}`
  if (action === 'learning_path') return `${common}\nUse: {"type":"timeline","title":"...","steps":[{"title":"...","description":"..."}]}\nOrder the steps for an interactive learning view.\n\n${header}`
  if (action === 'summary') return `${common}\nUse: {"type":"article","title":"...","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\n\n${header}`
  if (action === 'explain') return `${common}\nUse: {"type":"article","title":"...","lead":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}\nExplain deeply but only from the supplied text.\n\n${header}`
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
        const { data: gateway } = await adminClient.from('ai_gateway_settings').select('*').eq('id', 1).single()
        const { data: providers } = await adminClient.from('ai_provider_settings').select('provider,label,enabled,base_url,model,input_cost_per_1k_usd,output_cost_per_1k_usd,api_key')
        return new Response(JSON.stringify({
          activeProvider: gateway?.active_provider || 'openai',
          usdToToman: Number(gateway?.usd_to_toman || DEFAULT_USD_TO_TOMAN),
          chargeMultiplier: Number(gateway?.charge_multiplier || DEFAULT_CHARGE_MULTIPLIER),
          providers: (providers || []).map((p: any) => ({
            id: p.provider, label: p.label, enabled: p.enabled, apiKey: p.api_key ? '__stored__' : '',
            baseUrl: p.base_url, model: p.model, inputCostPer1kUsd: Number(p.input_cost_per_1k_usd),
            outputCostPer1kUsd: Number(p.output_cost_per_1k_usd),
          })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const incoming = body.settings
      await adminClient.from('ai_gateway_settings').upsert({
        id: 1, active_provider: incoming.activeProvider, usd_to_toman: incoming.usdToToman,
        charge_multiplier: incoming.chargeMultiplier, updated_at: new Date().toISOString(),
      })
      for (const p of incoming.providers || []) {
        const row: Record<string, unknown> = {
          provider: p.id, label: p.label, enabled: p.enabled, base_url: p.baseUrl, model: p.model,
          input_cost_per_1k_usd: p.inputCostPer1kUsd, output_cost_per_1k_usd: p.outputCostPer1kUsd,
          updated_at: new Date().toISOString(),
        }
        if (p.apiKey && p.apiKey !== '__stored__') row.api_key = p.apiKey
        await adminClient.from('ai_provider_settings').upsert(row)
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const prompt = safeActionPrompt(body.action, body.bookTitle, body.pageTitle, body.pageText)

    const { data: settings } = await adminClient.from('ai_gateway_settings').select('*').eq('id', 1).single()
    const activeProvider = settings?.active_provider || 'openai'
    const usdToToman = Number(settings?.usd_to_toman || DEFAULT_USD_TO_TOMAN)
    const chargeMultiplier = Number(settings?.charge_multiplier || DEFAULT_CHARGE_MULTIPLIER)

    const { data: providerRow } = await adminClient
      .from('ai_provider_settings')
      .select('*')
      .eq('provider', activeProvider)
      .eq('enabled', true)
      .single()

    const provider = providerRow as AiProviderConfig | null
    if (!provider?.api_key) throw new Error('AI provider is not configured')

    let text = ''
    let inputTokens = estimateTokens(prompt)
    let outputTokens = 0

    if (provider.provider === 'gemini') {
      const res = await fetch(`${provider.base_url}/models/${provider.model}:generateContent?key=${provider.api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Gemini request failed')
      text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
      inputTokens = json.usageMetadata?.promptTokenCount || inputTokens
      outputTokens = json.usageMetadata?.candidatesTokenCount || estimateTokens(text)
    } else {
      const res = await fetch(`${provider.base_url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.4 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'AI request failed')
      text = json.choices?.[0]?.message?.content || ''
      inputTokens = json.usage?.prompt_tokens || inputTokens
      outputTokens = json.usage?.completion_tokens || estimateTokens(text)
    }

    const rawUsd = (inputTokens / 1000) * Number(provider.input_cost_per_1k_usd) + (outputTokens / 1000) * Number(provider.output_cost_per_1k_usd)
    const chargedUsd = rawUsd * chargeMultiplier
    const chargedToman = Math.ceil(chargedUsd * usdToToman)

    const { data: feeSettings } = await adminClient.from('platform_fee_settings').select('credits_per_toman').eq('id', 1).single()
    const creditsPerToman = Number(feeSettings?.credits_per_toman || 0.001)
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
