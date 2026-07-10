import { supabase } from '@/integrations/supabase/client'
import type { AppUser } from '@/lib/auth-context'

export type AiSavedOutput = {
  id: string
  user_id: string
  book_id?: string | null
  page_index?: number | null
  action: string
  content: Record<string, any> | null
  created_at: string
}

export function aiOutputKind(output: AiSavedOutput) {
  return output.content?.type === 'image' || output.content?.imageUrl ? 'image' : 'text'
}

export function aiOutputTitle(output: AiSavedOutput) {
  if (aiOutputKind(output) === 'image') return 'تصویر تولیدشده'
  if (output.content?.title) return String(output.content.title)
  if (output.content?.type === 'callout_suggestions') return 'پیشنهاد کال‌اوت'
  if (output.action === 'summary') return 'خلاصه'
  if (output.action === 'quiz') return 'کوئیز'
  if (output.action === 'mindmap') return 'نقشه ذهنی'
  if (output.action === 'learning_path') return 'مسیر یادگیری'
  if (output.action === 'explain') return 'توضیح'
  return output.action || 'خروجی هوش مصنوعی'
}

export function aiOutputSourceLabel(output: AiSavedOutput) {
  const content = output.content || {}
  const purpose = content.purpose === 'interactive' ? 'بلوک تعاملی' : content.purpose === 'cover' ? 'جلد کتاب' : 'پنل هوش مصنوعی'
  const pageLabel = Number.isFinite(Number(output.page_index)) ? `صفحه ${Number(output.page_index) + 1}` : ''
  return [purpose, pageLabel].filter(Boolean).join(' · ')
}

export function aiOutputPreview(output: AiSavedOutput, max = 180) {
  const content = output.content || {}
  const text = content.text
    || content.prompt
    || content.lead
    || content.suggestions?.[0]?.text
    || content.sections?.[0]?.paragraphs?.[0]
    || JSON.stringify(content)
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function aiOutputUsableText(output: AiSavedOutput) {
  const content = output.content || {}
  if (typeof content.text === 'string') return content.text
  if (content.type === 'callout_suggestions' && Array.isArray(content.suggestions)) {
    return content.suggestions.map((item: any) => [item.title, item.text].filter(Boolean).join('\n')).filter(Boolean).join('\n\n')
  }
  if (content.type === 'article' && Array.isArray(content.sections)) {
    return [
      content.title,
      content.lead,
      ...content.sections.flatMap((section: any) => [section.heading, ...(section.paragraphs || []), ...(section.bullets || []).map((item: string) => `- ${item}`)]),
    ].filter(Boolean).join('\n\n')
  }
  return aiOutputKind(output) === 'text' ? aiOutputPreview(output, 4000) : ''
}

export function aiOutputImageUrl(output: AiSavedOutput) {
  return String(output.content?.imageUrl || '')
}

export async function loadAiSavedOutputs(user: AppUser | null, limit = 40, bookId?: string | null): Promise<AiSavedOutput[]> {
  if (!user) return []
  let query = (supabase as any)
    .from('ai_saved_outputs')
    .select('id,user_id,book_id,page_index,action,content,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (bookId) query = query.eq('book_id', bookId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as AiSavedOutput[]
}
