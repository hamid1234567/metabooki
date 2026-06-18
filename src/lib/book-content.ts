import type { ImportInlineSpan, ImportPage, ImportParagraph, WordImportAnalysis } from '@/lib/word-import-types'

export type BookInlineSpan = ImportInlineSpan & {
  color?: string
  fontFamily?: string
  fontSize?: string
}

export type PrintPageValue = number | string | null | undefined

export const BOOK_CONTENT_ZWNJ = '\u200C'

const LEGACY_ZWS_PATTERN = /\s*(?:Ãƒâ€šÃ‚Â¬|Ã‚Â¬|Ãƒâ€šÂ¬|Ã‚¬|Â¬|¬|\u00AC)\s*/g
const WORD_SUFFIX_HAYE_PATTERN = /([\u0600-\u06FF]{2,})(\u0647\u0627\u064a|\u0647\u0627\u06cc|\u0647\u0627\u0649|\u0647\u0627\u06cc\u06cc|\u0647\u0627\u064a\u064a)(?=$|[\s\u060c\u061b,.!?\u061f])/g
const SAMPLE_BARDARI_PATTERN = /(\u0646\u0645\u0648\u0646\u0647)(\u0628\u0631\u062f\u0627\u0631[\u0600-\u06FF]*)/g
const RADON_KHAR_PATTERN = /(\u0631\u0627\u062f\u0648\u0646)(\u062e\u0648\u0627\u0631[\u0600-\u06FF]*)/g

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
  return String(value)
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

export function inlineText(inline?: Array<{ text?: string }>, fallback = '') {
  return inline?.length ? inline.map(span => normalizeBookText(span.text || '')).join('') : normalizeBookText(fallback)
}

export function bookTextDirection(value = ''): 'rtl' | 'ltr' {
  const text = normalizeBookText(value)
  const rtlMatches = text.match(/[\u0600-\u06FF]/g)?.length || 0
  const latinMatches = text.match(/[A-Za-z]/g)?.length || 0
  return rtlMatches >= latinMatches ? 'rtl' : 'ltr'
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
  if (!inline?.length) return escapeHtml(fallback)
  return inline.map(span => {
    let content = escapeHtml(span.text || '')
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
      printPage: page?.printNumber,
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
