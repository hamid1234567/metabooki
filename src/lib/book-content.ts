import type { ImportInlineSpan, ImportPage, ImportParagraph, WordImportAnalysis } from '@/lib/word-import-types'

export type BookInlineSpan = ImportInlineSpan & {
  color?: string
  fontFamily?: string
  fontSize?: string
}

const LEGACY_ZWS_PATTERN = /\s*(?:Ãƒâ€šÃ‚Â¬|Ã‚Â¬|Ãƒâ€šÂ¬|Ã‚¬|Â¬|¬|\u00AC)\s*/g

export function normalizeBookText(value = '') {
  return String(value)
    .replace(LEGACY_ZWS_PATTERN, '\u200C')
    .replace(/\u00AD/g, '\u200C')
    .replace(/\u200C{2,}/g, '\u200C')
}

export function escapeHtml(text = '') {
  return normalizeBookText(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function inlineText(inline?: Array<{ text?: string }>, fallback = '') {
  return inline?.length ? inline.map(span => normalizeBookText(span.text || '')).join('') : normalizeBookText(fallback)
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
      const footnoteText = escapeHtml(span.footnoteText || '')
      content = `<span class="citation-reference footnote-reference" data-footnote-id="${escapeHtml(span.footnoteId)}"${footnoteText ? ` data-footnote-text="${footnoteText}" title="${footnoteText}"` : ''}><sup class="word-footnote-reference">${escapeHtml(span.footnoteId)}</sup></span>`
    }
    if (span.referenceText) {
      content = `<span class="citation-reference" data-reference-anchor="${escapeHtml(span.referenceAnchor || '')}" data-reference-text="${escapeHtml(span.referenceText)}" title="${escapeHtml(span.referenceText)}">${content}</span>`
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
  if (block.type === 'image') return `<p data-image-id="${escapeHtml(block.imageId)}">[تصویر کتاب]</p>`
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
