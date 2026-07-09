import { createV2Id, type BookBlockV2 } from '@/lib/book-document-v2'
import type { PrintPageValue } from '@/lib/book-content'
import { INTERACTIVE_V3_MAX_ITEMS, type InteractiveV3Definition, type InteractiveV3Kind, type InteractiveV3Payload } from './types'

export const INTERACTIVE_V3_DEFINITIONS: InteractiveV3Definition[] = [
  { kind: 'quiz', label: 'کوییز چندگزینه‌ای', shortLabel: 'کوییز', icon: '؟', allowsMedia: false, maxItems: INTERACTIVE_V3_MAX_ITEMS },
  { kind: 'flashcard', label: 'فلش‌کارت', shortLabel: 'فلش‌کارت', icon: '↻', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'cards' },
  { kind: 'accordion', label: 'آکاردئون', shortLabel: 'آکاردئون', icon: '▤', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'items' },
  { kind: 'tabs', label: 'تب‌ها', shortLabel: 'تب‌ها', icon: '▦', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'tabs' },
  { kind: 'timeline', label: 'تایم‌لاین', shortLabel: 'تایم‌لاین', icon: '○', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'events' },
  { kind: 'gallery', label: 'گالری اسلایدی', shortLabel: 'گالری', icon: '▧', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'images' },
  { kind: 'scrollytelling', label: 'استوری‌تلینگ', shortLabel: 'استوری', icon: '▣', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'steps' },
  { kind: 'hotspot', label: 'هات‌اسپات', shortLabel: 'هات‌اسپات', icon: '+', allowsMedia: true, maxItems: INTERACTIVE_V3_MAX_ITEMS, itemCollection: 'points' },
  { kind: 'author', label: 'معرفی نویسنده', shortLabel: 'نویسنده', icon: '◉', allowsMedia: true, itemCollection: 'authors' },
]

export const INTERACTIVE_V3_KINDS = new Set<string>(INTERACTIVE_V3_DEFINITIONS.map(item => item.kind))

export function interactiveV3Definition(kind: string): InteractiveV3Definition {
  return INTERACTIVE_V3_DEFINITIONS.find(item => item.kind === kind) || INTERACTIVE_V3_DEFINITIONS[0]
}

function item(id: string, values: Record<string, unknown> = {}) {
  return { id, ...values }
}

export function createInteractivePayloadV3(kind: InteractiveV3Kind): InteractiveV3Payload {
  if (kind === 'quiz') return { schema: 'interactive-v3', title: '', question: '', options: ['', '', '', ''], correct: 0, explanation: '' }
  if (kind === 'flashcard') return { schema: 'interactive-v3', title: '', cards: [item('card-1', { front: '', back: '', image: '' })] }
  if (kind === 'accordion') return { schema: 'interactive-v3', title: '', items: [item('item-1', { title: '', description: '', image: '' })] }
  if (kind === 'tabs') return { schema: 'interactive-v3', title: '', tabs: [item('tab-1', { title: '', description: '', image: '' }), item('tab-2', { title: '', description: '', image: '' })] }
  if (kind === 'timeline') return { schema: 'interactive-v3', title: '', events: [item('event-1', { title: '', description: '', image: '' }), item('event-2', { title: '', description: '', image: '' })] }
  if (kind === 'gallery') return { schema: 'interactive-v3', title: '', images: [item('image-1', { image: '', caption: '' })] }
  if (kind === 'scrollytelling') return { schema: 'interactive-v3', title: '', steps: [item('step-1', { title: '', description: '', image: '' }), item('step-2', { title: '', description: '', image: '' })] }
  if (kind === 'hotspot') return { schema: 'interactive-v3', title: '', image: '', caption: '', points: [item('point-1', { x: 50, y: 50, title: '', text: '' })] }
  return { schema: 'interactive-v3', title: '', authors: [item('author-1', { name: '', role: '', bio: '', image: '' })] }
}

export function createInteractiveBlockV3(kind: string, printNumber?: PrintPageValue): BookBlockV2 {
  const safeKind = (INTERACTIVE_V3_KINDS.has(kind) ? kind : 'quiz') as InteractiveV3Kind
  const id = createV2Id('interactive-v3', safeKind, Date.now())
  const def = interactiveV3Definition(safeKind)
  return {
    id,
    type: 'interactive',
    kind: safeKind as any,
    title: def.label,
    anchor: id,
    printNumber,
    payload: createInteractivePayloadV3(safeKind),
  }
}

export function normalizeInteractiveItemsV3(payload: InteractiveV3Payload, key: keyof InteractiveV3Payload, allowUnlimited = false) {
  const value = payload[key]
  const rows = Array.isArray(value) ? value : []
  return (allowUnlimited ? rows : rows.slice(0, INTERACTIVE_V3_MAX_ITEMS)).map((row, index) => {
    const object = row && typeof row === 'object' ? row as Record<string, unknown> : {}
    return { id: String(object.id || `${String(key)}-${index + 1}`), ...object }
  })
}
