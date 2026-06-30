import type { ImportInlineSpan, ImportPage, ImportParagraph, WordImportAnalysis } from '@/lib/word-import-types'
import { normalizeSymbolFontText } from '@/lib/symbol-font'

export type BookInlineSpan = ImportInlineSpan & {
  color?: string
  fontFamily?: string
  fontSize?: string
}

export type PrintPageValue = number | string | null | undefined

// Before changing any content rendering behavior, check this registry first.
// If the behavior belongs here, update the central owner function instead of patching one surface.
export const BOOK_CONTENT_REFERENCE_RULES = [
  {
    key: 'text-normalization',
    owner: 'normalizeBookText',
    surfaces: ['word import', 'word preview', 'editor', 'editor preview', 'reader', 'book cards', 'AI outputs', 'highlights', 'notes'],
    includes: ['ZWS/ZWNJ', 'legacy not-sign separator', 'soft hyphen', 'Persian compound words', 'Word Symbol font Greek/math characters'],
  },
  {
    key: 'inline-number-bidi',
    owner: 'splitBookTextForDisplay / bookDisplayTextHtml',
    surfaces: ['word preview', 'editor', 'editor preview', 'reader', 'captions', 'tables', 'callouts', 'interactive blocks', 'AI outputs'],
    includes: ['Persian and English digits are preserved', 'decimal/fraction-like runs keep visual order in RTL text', 'Persian slash decimals such as ۲/۴ are not flipped'],
  },
  {
    key: 'inline-rich-content',
    owner: 'inlineToHtml',
    surfaces: ['word import', 'word preview', 'editor', 'editor preview', 'reader', 'book snippets', 'AI outputs', 'highlights', 'notes'],
    includes: ['superscript', 'subscript', 'links', 'citations', 'footnotes', 'chemical formulas', 'inline formulas'],
  },
  {
    key: 'print-page-numbering',
    owner: 'printPageLabel / printPageBoundaryLabels / pageBreakHtml / pageDividerHtml',
    surfaces: ['word preview', 'editor', 'editor preview', 'reader'],
    includes: ['printed page labels', 'page separators', 'roman/letter/decimal numbering', 'page-break display'],
  },
  {
    key: 'citation-tooltips',
    owner: 'citationTooltipAttributes / bookTextDirection',
    surfaces: ['word preview', 'editor', 'editor preview', 'reader'],
    includes: ['footnote tooltip', 'reference tooltip', 'RTL/LTR direction', 'viewport-safe placement'],
  },
  {
    key: 'search-normalization',
    owner: 'normalizeBookSearchText / compactBookSearchText / bookSearchMatches / bookSearchIncludes',
    surfaces: ['store', 'library', 'publisher', 'admin', 'reader search', 'reader TOC', 'editor media', 'editor references', 'image picker'],
    includes: ['Persian/Arabic character normalization', 'ZWS/ZWNJ-insensitive search', 'caption search', 'image and reference list filtering'],
  },
  {
    key: 'callout-and-interactive-blocks',
    owner: 'CALLOUT_PRESETS / INTERACTIVE_TYPES / interactiveTemplate / interactivePreview / BookContentBlock',
    surfaces: ['editor', 'editor preview', 'reader', 'book detail previews', 'chapter previews', 'book snippets'],
    includes: ['callout variants', 'interactive block templates', 'interactive labels', 'shared rendering behavior'],
  },
] as const

export type CalloutVariant = 'key' | 'question' | 'warning' | 'quote' | 'deep' | 'practice' | 'glossary' | 'data' | 'margin' | 'normal'
export type InteractiveKind = 'quiz' | 'truefalse' | 'flashcard' | 'accordion' | 'tabs' | 'timeline' | 'gallery' | 'scrollytelling' | 'algorithm' | 'author' | 'steps' | 'hotspot'

export const CALLOUT_PRESETS = [
  { value: 'key', label: 'نکته کلیدی', group: 'کال‌اوت آموزشی', emoji: '💡', className: 'callout-key', description: 'خلاصه مهم‌ترین نکته متن' },
  { value: 'question', label: 'مکث و فکر کن', group: 'کال‌اوت آموزشی', emoji: '❔', className: 'callout-question', description: 'سؤال کوتاه برای درگیر کردن خواننده' },
  { value: 'warning', label: 'اشتباه رایج', group: 'کال‌اوت آموزشی', emoji: '⚠️', className: 'callout-warning', description: 'هشدار یا اصلاح برداشت اشتباه' },
  { value: 'quote', label: 'جمله طلایی', group: 'کال‌اوت ادبی و مرجع', emoji: '❝', className: 'callout-quote', description: 'نقل‌قول یا جمله مهم و ماندگار' },
  { value: 'deep', label: 'عمیق‌تر بخوان', group: 'کال‌اوت ادبی و مرجع', emoji: '🔍', className: 'callout-deep', description: 'محتوای تکمیلی یا توضیح پیشرفته' },
  { value: 'practice', label: 'تمرین سریع', group: 'کال‌اوت کاربردی', emoji: '✅', className: 'callout-practice', description: 'تمرین یا فعالیت کوتاه داخل کتاب' },
  { value: 'glossary', label: 'تعریف واژه', group: 'کال‌اوت کاربردی', emoji: '📘', className: 'callout-glossary', description: 'تعریف یک اصطلاح یا مفهوم' },
  { value: 'data', label: 'داده و منبع', group: 'کال‌اوت کاربردی', emoji: '📊', className: 'callout-data', description: 'نمایش آمار، عدد، منبع یا رفرنس' },
  { value: 'margin', label: 'یادداشت حاشیه‌ای', group: 'کال‌اوت کاربردی', emoji: '📝', className: 'callout-margin', description: 'توضیح کوتاه در حاشیه یا کنار متن' },
  { value: 'normal', label: 'متن عادی', group: 'بازنشانی', emoji: '', className: 'editor-normal', description: 'بازگشت به متن ساده' },
] as const

export const INTERACTIVE_TYPES = [
  ['quiz', 'Quiz چندگزینه‌ای'],
  ['truefalse', 'صحیح/غلط'],
  ['flashcard', 'فلش‌کارت'],
  ['accordion', 'آکاردئون'],
  ['tabs', 'تب‌ها'],
  ['timeline', 'تایم‌لاین'],
  ['gallery', 'گالری تصویر'],
  ['scrollytelling', 'استوری‌تلینگ چندمرحله‌ای'],
  ['algorithm', 'الگوریتم تعاملی'],
  ['author', 'معرفی نویسنده مطلب'],
  ['steps', 'مرحله‌سازی'],
  ['hotspot', 'هات‌اسپات تعاملی'],
] as const

export const INTERACTIVE_KIND_SET = new Set<string>(INTERACTIVE_TYPES.map(item => item[0]))

export function calloutPreset(variant = 'key') {
  return CALLOUT_PRESETS.find(item => item.value === variant) || CALLOUT_PRESETS[0]
}

export function interactiveLabel(kind = '') {
  return INTERACTIVE_TYPES.find(item => item[0] === kind)?.[1] || kind
}

export function interactiveTemplate(kind: string) {
  if (kind === 'quiz') return { type: kind, question: '', options: ['', '', '', ''], correct: 0, explanation: '' }
  if (kind === 'truefalse') return { type: kind, statement: '', correct: true, explanation: '' }
  if (kind === 'accordion') return { type: kind, title: '', items: [{ title: '', description: '', image: '' }] }
  if (kind === 'tabs') return { type: kind, title: '', tabs: [{ title: '', description: '', image: '' }, { title: '', description: '', image: '' }] }
  if (kind === 'algorithm') return {
    type: kind,
    title: '',
    startId: 'start',
    nodes: [
      { id: 'start', kind: 'start', title: '', description: '', image: '', options: [{ label: '', targetId: 'result' }] },
      { id: 'result', kind: 'result', title: '', description: '', image: '', options: [] },
    ],
  }
  if (kind === 'author') return { type: kind, title: '', authors: [{ name: '', role: '', bio: '', image: '' }] }
  if (kind === 'timeline') return { type: kind, events: [{ year: '', title: '', description: '', image: '' }, { year: '', title: '', description: '', image: '' }] }
  if (kind === 'scrollytelling') return { type: kind, title: '', steps: [{ image: '', title: '', text: '', description: '' }, { image: '', title: '', text: '', description: '' }] }
  if (kind === 'hotspot') return { type: kind, image: '', caption: '', points: [{ x: 50, y: 50, title: '', text: '' }] }
  if (kind === 'flashcard') return { type: kind, cards: [{ front: '', back: '', image: '' }] }
  if (kind === 'gallery') return { type: kind, title: '', images: [{ url: '', caption: '' }] }
  return { type: kind, title: '', steps: [{ title: '', description: '', image: '' }, { title: '', description: '', image: '' }] }
}

export function interactivePreview(kind: string, data: any): any[] {
  if (kind === 'algorithm') return [['h4', data.title || 'الگوریتم تعاملی'], ['div', { class: 'editor-interactive-steps' }, ...(data.nodes || data.steps || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || item.label || 'تصمیم'}`])]]
  if (kind === 'truefalse') return [['h4', data.statement || 'گزاره صحیح/غلط'], ['div', { class: 'editor-interactive-options' }, ['span', data.correct ? 'پاسخ: صحیح' : 'پاسخ: غلط'], ['span', data.explanation || '']]]
  if (kind === 'accordion') return [['h4', data.title || 'آکاردئون'], ['div', { class: 'editor-interactive-steps' }, ...(data.items || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'بخش'}`])]]
  if (kind === 'tabs') return [['h4', data.title || 'تب‌ها'], ['div', { class: 'editor-interactive-steps' }, ...(data.tabs || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'تب'}`])]]
  if (kind === 'algorithm') return [['h4', data.title || 'الگوریتم تعاملی'], ['div', { class: 'editor-interactive-steps' }, ...(data.steps || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'تصمیم'}`])]]
  if (kind === 'author') {
    const authors = Array.isArray(data.authors) ? data.authors : [{ name: data.name, role: data.role, bio: data.bio }]
    return [['h4', data.title || 'نویسندگان فصل'], ['div', { class: 'editor-interactive-steps' }, ...authors.map((author: any) => ['span', `${author.name || 'نویسنده'}${author.role ? ` - ${author.role}` : ''}`])]]
  }
  if (kind === 'quiz') return [['h4', data.question || 'سؤال'], ['div', { class: 'editor-interactive-options' }, ...(data.options || []).map((option: string) => ['span', option])]]
  if (kind === 'gallery') return [['div', { class: 'editor-interactive-gallery' }, ...(data.images || []).map((image: any) => image.url ? ['img', { src: image.url, alt: image.caption || '' }] : ['span', image.caption || 'تصویر'])]]
  if (kind === 'hotspot') return [data.image ? ['img', { src: data.image, alt: data.caption || '' }] : ['span', data.caption || 'تصویر هات‌اسپات'], ['small', `${(data.points || []).length} نقطه تعاملی`]]
  const items = data.steps || data.events || data.cards || []
  if (items.length) return [['h4', data.title || data.caption || interactiveLabel(kind)], ['div', { class: 'editor-interactive-steps' }, ...items.map((item: any, index: number) => ['span', `${index + 1}. ${item.title || item.year || item.front || item.text || 'مرحله'}`])]]
  return [['span', data.title || data.question || data.caption || 'برای ویرایش جزئیات، این بخش را انتخاب کنید']]
}

export function encodeBookContentPayload(value: unknown) {
  return encodeURIComponent(JSON.stringify(value))
}

export function decodeBookContentPayload(value = '') {
  try { return JSON.parse(decodeURIComponent(value)) } catch { return {} }
}

export const BOOK_CONTENT_ZWNJ = '\u200C'

const LEGACY_ZWS_PATTERN = /\s*(?:Ãƒâ€šÃ‚Â¬|Ã‚Â¬|Ãƒâ€šÂ¬|Ã‚¬|Â¬|¬|\u00AC)\s*/g
const WORD_SUFFIX_HAYE_PATTERN = /([\u0600-\u06FF]{2,})(\u0647\u0627\u064a|\u0647\u0627\u06cc|\u0647\u0627\u0649|\u0647\u0627\u06cc\u06cc|\u0647\u0627\u064a\u064a)(?=$|[\s\u060c\u061b,.!?\u061f])/g
const SAMPLE_BARDARI_PATTERN = /(\u0646\u0645\u0648\u0646\u0647)(\u0628\u0631\u062f\u0627\u0631[\u0600-\u06FF]*)/g
const RADON_KHAR_PATTERN = /(\u0631\u0627\u062f\u0648\u0646)(\u062e\u0648\u0627\u0631[\u0600-\u06FF]*)/g
const BOOK_LTR_RUN_PATTERN = /[%٪]?[A-Za-z\u0370-\u03FF\u00B5\u00B0\u00B9\u00B2\u00B3\u2070-\u2079\u2080-\u20890-9\u06F0-\u06F9\u0660-\u0669](?:[A-Za-z\u0370-\u03FF\u00B5\u00B0\u00B9\u00B2\u00B3\u2070-\u2079\u2080-\u20890-9\u06F0-\u06F9\u0660-\u0669./,\u066B\u066C\u060C:%٪+\-−–—^(){}\[\]\s]*[A-Za-z\u0370-\u03FF\u00B5\u00B0\u00B9\u00B2\u00B3\u2070-\u2079\u2080-\u20890-9\u06F0-\u06F9\u0660-\u0669%٪°)])?/g
const BOOK_LTR_RUN_TEXT_PATTERN = /^[\s%٪A-Za-z\u0370-\u03FF\u00B5\u00B0\u00B9\u00B2\u00B3\u2070-\u2079\u2080-\u20890-9\u06F0-\u06F9\u0660-\u0669./,\u066B\u066C\u060C:+\-−–—^(){}\[\]°]+$/
const BOOK_LTR_RUN_REQUIRED_PATTERN = /[%٪A-Za-z\u0370-\u03FF\u00B5\u00B0\u00B9\u00B2\u00B3\u2070-\u2079\u2080-\u20890-9\u06F0-\u06F9\u0660-\u0669]/

function romanNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 4000) return String(value)
  const pairs: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let remaining = Math.floor(value)
  let output = ''
  for (const [number, label] of pairs) {
    while (remaining >= number) {
      output += label
      remaining -= number
    }
  }
  return output
}

function alphaNumber(value: number, uppercase = false) {
  if (!Number.isFinite(value) || value <= 0) return String(value)
  let remaining = Math.floor(value)
  let output = ''
  while (remaining > 0) {
    remaining -= 1
    output = String.fromCharCode((uppercase ? 65 : 97) + (remaining % 26)) + output
    remaining = Math.floor(remaining / 26)
  }
  return output
}

export function formatPrintNumber(value: number, format = 'decimal') {
  const normalized = String(format || 'decimal').toLowerCase()
  if (normalized.includes('roman')) {
    const roman = romanNumber(value)
    return normalized.includes('upper') ? roman : roman.toLowerCase()
  }
  if (normalized.includes('letter')) return alphaNumber(value, normalized.includes('upper'))
  return value
}

export function printPageLabel(value: PrintPageValue, emptyLabel = '') {
  if (value === undefined || value === null || value === '') return emptyLabel
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('fa-IR') : String(value)
}

export function printPageBoundaryLabels(previous?: { printNumber?: PrintPageValue }, next?: { printNumber?: PrintPageValue }) {
  const before = printPageLabel(previous?.printNumber)
  const after = printPageLabel(next?.printNumber)
  return {
    before: before ? `\u067e\u0627\u06cc\u0627\u0646 \u0635\u0641\u062d\u0647 ${before}` : '\u067e\u0627\u06cc\u0627\u0646 \u0635\u0641\u062d\u0647 \u0628\u062f\u0648\u0646 \u0634\u0645\u0627\u0631\u0647 \u0686\u0627\u067e\u06cc',
    after: after ? `\u0634\u0631\u0648\u0639 \u0635\u0641\u062d\u0647 ${after}` : '\u0634\u0631\u0648\u0639 \u0635\u0641\u062d\u0647 \u0628\u062f\u0648\u0646 \u0634\u0645\u0627\u0631\u0647 \u0686\u0627\u067e\u06cc',
    page: after ? `\u0635\u0641\u062d\u0647 \u0686\u0627\u067e\u06cc ${after}` : '\u0635\u0641\u062d\u0647 \u0686\u0627\u067e\u06cc \u0628\u062f\u0648\u0646 \u0634\u0645\u0627\u0631\u0647',
  }
}

export function pageBreakHtml(previous?: { printNumber?: PrintPageValue }, next?: { printNumber?: PrintPageValue }) {
  const labels = printPageBoundaryLabels(previous, next)
  return `<hr class="book-page-break" data-page-break="true" data-before="${escapeHtml(labels.before)}" data-after="${escapeHtml(labels.after)}" data-page-label="${escapeHtml(labels.page)}">`
}

export function pageDividerHtml(next?: { printNumber?: PrintPageValue }) {
  const labels = printPageBoundaryLabels(undefined, next)
  return `<div class="book-page-divider" data-page-label="${escapeHtml(labels.page)}"><span>${escapeHtml(labels.page)}</span></div>`
}

export function normalizeBookText(value = '') {
  return normalizeSymbolFontText(String(value))
    .replace(LEGACY_ZWS_PATTERN, BOOK_CONTENT_ZWNJ)
    .replace(/\u00AD/g, BOOK_CONTENT_ZWNJ)
    .replace(WORD_SUFFIX_HAYE_PATTERN, `$1${BOOK_CONTENT_ZWNJ}$2`)
    .replace(SAMPLE_BARDARI_PATTERN, `$1${BOOK_CONTENT_ZWNJ}$2`)
    .replace(RADON_KHAR_PATTERN, `$1${BOOK_CONTENT_ZWNJ}$2`)
    .replace(/\u200C{2,}/g, BOOK_CONTENT_ZWNJ)
}

export function escapeHtml(text = '') {
  return normalizeBookText(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function splitBookTextForDisplay(value = '') {
  const text = normalizeBookText(value)
  const parts: Array<{ text: string; numeric: boolean }> = []
  let cursor = 0
  for (const match of text.matchAll(BOOK_LTR_RUN_PATTERN)) {
    const index = match.index ?? 0
    const raw = match[0]
    const leadingSpace = raw.match(/^\s*/)?.[0] || ''
    const trailingSpace = raw.match(/\s*$/)?.[0] || ''
    const core = raw.slice(leadingSpace.length, raw.length - trailingSpace.length)
    if (index > cursor) parts.push({ text: text.slice(cursor, index), numeric: false })
    if (leadingSpace) parts.push({ text: leadingSpace, numeric: false })
    if (core) parts.push({ text: core, numeric: true })
    if (trailingSpace) parts.push({ text: trailingSpace, numeric: false })
    cursor = index + raw.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), numeric: false })
  return parts.length ? parts : [{ text, numeric: false }]
}

export function isBookLtrRunText(value = '') {
  const text = normalizeBookText(value)
  return BOOK_LTR_RUN_REQUIRED_PATTERN.test(text) && BOOK_LTR_RUN_TEXT_PATTERN.test(text)
}

export function bookDisplayTextHtml(value = '') {
  return splitBookTextForDisplay(value).map(part => {
    const escaped = escapeHtml(part.text)
    return part.numeric ? `<bdi class="book-number-run" dir="ltr">${escaped}</bdi>` : escaped
  }).join('')
}

export function inlineText(inline?: Array<{ text?: string }>, fallback = '') {
  return inline?.length ? inline.map(span => normalizeBookText(span.text || '')).join('') : normalizeBookText(fallback)
}

export function bookTextDirection(value = ''): 'rtl' | 'ltr' {
  const text = normalizeBookText(value)
  const rtlMatches = text.match(/[\u0600-\u06FF]/g)?.length || 0
  const latinMatches = text.match(/[A-Za-z]/g)?.length || 0
  return rtlMatches >= latinMatches ? 'rtl' : 'ltr'
}

export function normalizeBookSearchText(value = '') {
  return normalizeBookText(String(value))
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\u200B\u200C\u200D\u00AC\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function compactBookSearchText(value = '') {
  return normalizeBookSearchText(value).replace(/[\s._\-–—:؛،,()[\]{}«»"'`]+/g, '')
}

export function bookSearchMatches(text: string, query: string) {
  const raw = String(text || '')
  const cleanQuery = normalizeBookSearchText(query)
  if (!cleanQuery) return { matched: false, offset: -1 }
  const exactOffset = raw.toLowerCase().indexOf(String(query || '').toLowerCase())
  if (exactOffset >= 0) return { matched: true, offset: exactOffset }
  const normalizedOffset = normalizeBookSearchText(raw).indexOf(cleanQuery)
  if (normalizedOffset >= 0) return { matched: true, offset: Math.min(normalizedOffset, raw.length) }
  const compactOffset = compactBookSearchText(raw).indexOf(compactBookSearchText(query))
  return { matched: compactOffset >= 0, offset: compactOffset >= 0 ? Math.min(compactOffset, raw.length) : -1 }
}

export function bookSearchIncludes(text: string, query: string) {
  return bookSearchMatches(text, query).matched
}

export function citationTooltipAttributes(text = '') {
  const normalized = normalizeBookText(text)
  const escaped = escapeHtml(normalized)
  const direction = bookTextDirection(normalized)
  return {
    text: normalized,
    escaped,
    direction,
    htmlAttributes: ` data-tooltip-dir="${direction}" dir="${direction}"`,
  }
}

export function inlineToHtml(inline?: BookInlineSpan[], fallback = '') {
  if (!inline?.length) return bookDisplayTextHtml(fallback)
  return inline.map(span => {
    let content = bookDisplayTextHtml(span.text || '')
    const style = [
      span.color ? `color:${span.color}` : '',
      span.fontFamily ? `font-family:${span.fontFamily}` : '',
      span.fontSize ? `font-size:${span.fontSize}` : '',
    ].filter(Boolean).join(';')
    if (style) content = `<span style="${style}">${content}</span>`
    if (span.bold) content = `<strong>${content}</strong>`
    if (span.italic) content = `<em>${content}</em>`
    if (span.superscript) content = `<sup>${content}</sup>`
    if (span.subscript) content = `<sub>${content}</sub>`
    if (span.footnoteId) {
      const tooltip = citationTooltipAttributes(span.footnoteText || '')
      content = `<span class="citation-reference footnote-reference" data-footnote-id="${escapeHtml(span.footnoteId)}"${tooltip.escaped ? ` data-footnote-text="${tooltip.escaped}" title="${tooltip.escaped}"${tooltip.htmlAttributes}` : ''}><sup class="word-footnote-reference">${escapeHtml(span.footnoteId)}</sup></span>`
    }
    if (span.referenceText) {
      const tooltip = citationTooltipAttributes(span.referenceText)
      content = `<span class="citation-reference" data-reference-anchor="${escapeHtml(span.referenceAnchor || '')}" data-reference-text="${tooltip.escaped}" title="${tooltip.escaped}"${tooltip.htmlAttributes}>${content}</span>`
    }
    if (span.href) content = `<a href="${escapeHtml(span.href)}">${content}</a>`
    return content
  }).join('')
}

export function blockToReaderBlock(block: ImportParagraph, imageUrls: Record<string, string> = {}, page?: ImportPage, analysis?: WordImportAnalysis) {
  if (block.type === 'heading') return { id: block.id, type: 'heading', level: block.level || 2, content: normalizeBookText(block.text || ''), inline: block.inline, anchor: block.anchor, anchors: block.anchors, format: block.format }
  if (block.type === 'image') {
    const image = analysis?.images.find(item => item.id === block.imageId)
    return {
      id: block.id,
      type: 'image',
      url: imageUrls[block.imageId || ''] || '',
      caption: normalizeBookText(image?.caption || ''),
      imageId: block.imageId,
      printPage: block.printNumber ?? page?.printNumber,
      conversionStatus: image?.conversionStatus,
      conversionError: image?.conversionError,
      widthPx: block.imageWidthPx,
      widthPercent: block.imageWidthPercent,
    }
  }
  if (block.type === 'table') return { id: block.id, type: 'table', headers: block.rows?.[0] || [], rows: block.rows?.slice(1) || [] }
  if (block.type === 'math') return { id: block.id, type: 'math', expression: normalizeBookText(block.text || '') }
  if (block.type === 'list') return { id: block.id, type: 'list', ordered: block.ordered, items: block.items || [], level: block.listLevel, format: block.format }
  return { id: block.id, type: 'paragraph', content: normalizeBookText(block.text || ''), inline: block.inline, semantic: block.type, anchor: block.anchor, anchors: block.anchors, format: block.format }
}

export function blockToHtml(block: ImportParagraph | any) {
  if (block.type === 'callout') {
    const preset = calloutPreset(block.variant)
    const variant = block.variant || preset.value
    const title = block.title || preset.label
    const icon = block.icon || preset.emoji
    return `<section class="book-callout has-rendered-title callout-${escapeHtml(variant)}" data-callout-variant="${escapeHtml(variant)}" data-callout-title="${escapeHtml(title)}" data-callout-icon="${escapeHtml(icon)}"><div class="book-callout-head"><span class="book-callout-icon">${escapeHtml(icon)}</span><strong>${escapeHtml(title)}</strong></div><div class="book-callout-content">${(block.blocks || []).map(blockToHtml).join('')}</div></section>`
  }
  if (INTERACTIVE_KIND_SET.has(block.type)) {
    return `<section data-interactive-kind="${escapeHtml(block.type)}" kind="${escapeHtml(block.type)}" payload="${escapeHtml(encodeBookContentPayload(block))}"></section>`
  }
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level || 2))
    const id = block.anchor || block.id
    return `<h${level}${id ? ` id="${escapeHtml(id)}"` : ''}>${inlineToHtml(block.inline, block.text || block.content || '')}</h${level}>`
  }
  if (block.type === 'table') {
    const rows = block.rows || []
    return `<table><tbody>${rows.map((row: string[]) => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  }
  if (block.type === 'math') return `<p data-math="true">${escapeHtml(block.text || block.expression || '')}</p>`
  if (block.type === 'image') return `<p data-image-id="${escapeHtml(block.imageId)}">[\u062a\u0635\u0648\u06cc\u0631 \u06a9\u062a\u0627\u0628]</p>`
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul'
    return `<${tag}>${(block.items || []).map((item: any) => `<li>${inlineToHtml(item.inline, item.text)}</li>`).join('')}</${tag}>`
  }
  const semantic = block.type === 'caption' ? ' class="word-figure-caption"' : block.type === 'table-title' ? ' class="word-table-title"' : ''
  const id = block.anchor || block.id
  return `<p${semantic}${id ? ` id="${escapeHtml(id)}"` : ''}>${inlineToHtml(block.inline, block.text || block.content || '')}</p>`
}

export function pageText(page: ImportPage | { blocks?: any[] }) {
  return (page.blocks || []).map(block => normalizeBookText(block.text || block.content || block.items?.map((item: any) => item.text).join(' ') || block.rows?.flat().join(' ') || '')).join(' ')
}
