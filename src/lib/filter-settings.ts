import { supabase } from '@/integrations/supabase/client'

const KEY = 'metabooki_book_filter_settings'

export interface BookFilterSettings {
  categories: string[]
  tags: string[]
  bookTypes: string[]
}

export const emptyFilterSettings: BookFilterSettings = {
  categories: [],
  tags: [],
  bookTypes: [],
}

const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))

export function parseFilterLines(value: string) {
  return Array.from(new Set(value.split(/\r?\n|،|,/).map(item => item.trim()).filter(Boolean)))
}

export function readLocalFilterSettings(): BookFilterSettings {
  try {
    return { ...emptyFilterSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return emptyFilterSettings
  }
}

export function saveLocalFilterSettings(settings: BookFilterSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export async function loadBookFilterSettings() {
  const local = readLocalFilterSettings()
  if (!hasSupabase) return local
  try {
    const { data, error } = await (supabase as any).from('book_filter_settings').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return local
    const remote = {
      categories: stringArray(data.categories),
      tags: stringArray(data.tags),
      bookTypes: stringArray(data.book_types),
    }
    saveLocalFilterSettings(remote)
    return remote
  } catch {
    return local
  }
}

export async function saveBookFilterSettings(settings: BookFilterSettings) {
  saveLocalFilterSettings(settings)
  if (!hasSupabase) return
  const { error } = await (supabase as any).from('book_filter_settings').upsert({
    id: 1,
    categories: settings.categories,
    tags: settings.tags,
    book_types: settings.bookTypes,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function mergeFilterOptions(discovered: string[], configured: string[]) {
  return Array.from(new Set([...configured, ...discovered].map(item => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : []
}
