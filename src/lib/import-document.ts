import type { ImportPage, ImportParagraph, WordImportAnalysis } from '@/lib/word-import-types'

export function blockToReaderBlock(block: ImportParagraph, imageUrls: Record<string, string> = {}) {
  if (block.type === 'heading') return { type: 'heading', level: block.level || 2, content: block.text || '', inline: block.inline, anchor: block.anchor, anchors: block.anchors }
  if (block.type === 'image') return { type: 'image', url: imageUrls[block.imageId || ''] || '', caption: '' }
  if (block.type === 'table') return { type: 'table', headers: block.rows?.[0] || [], rows: block.rows?.slice(1) || [] }
  if (block.type === 'math') return { type: 'math', expression: block.text || '' }
  return { type: 'paragraph', content: block.text || '', inline: block.inline, semantic: block.type, anchor: block.anchor, anchors: block.anchors }
}

export function analysisToReaderPages(analysis: WordImportAnalysis, imageUrls: Record<string, string> = {}) {
  return analysis.previewPages.map(page => ({
    title: page.blocks.find(block => block.type === 'heading')?.text || `صفحه ${(page.printNumber || page.number).toLocaleString('fa-IR')}`,
    blocks: page.blocks.map(block => blockToReaderBlock(block, imageUrls)),
  }))
}

export function analysisToEditorHtml(analysis: WordImportAnalysis) {
  return analysis.previewPages.map(page => page.blocks.map(blockToHtml).join('')).join('<hr data-page-break="true">')
}

function escapeHtml(text = '') {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function blockToHtml(block: ImportParagraph) {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level || 2))
    return `<h${level}${block.anchor ? ` id="${escapeHtml(block.anchor)}"` : ''}>${inlineToHtml(block)}</h${level}>`
  }
  if (block.type === 'table') {
    return `<table><tbody>${(block.rows || []).map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  }
  if (block.type === 'math') return `<p data-math="true">${escapeHtml(block.text)}</p>`
  if (block.type === 'image') return `<p data-image-id="${escapeHtml(block.imageId)}">[تصویر کتاب]</p>`
  const semantic = block.type === 'caption' ? ' class="word-figure-caption"' : block.type === 'table-title' ? ' class="word-table-title"' : ''
  return `<p${semantic}${block.anchor ? ` id="${escapeHtml(block.anchor)}"` : ''}>${inlineToHtml(block)}</p>`
}

function inlineToHtml(block: ImportParagraph) {
  if (!block.inline?.length) return escapeHtml(block.text)
  return block.inline.map(span => {
    let content = escapeHtml(span.text)
    if (span.bold) content = `<strong>${content}</strong>`
    if (span.italic) content = `<em>${content}</em>`
    if (span.superscript) content = `<sup>${content}</sup>`
    if (span.subscript) content = `<sub>${content}</sub>`
    if (span.footnoteId) content = `<sup data-footnote-id="${escapeHtml(span.footnoteId)}"${span.footnoteText ? ` title="${escapeHtml(span.footnoteText)}"` : ''}>${escapeHtml(span.footnoteId)}</sup>`
    if (span.referenceText) content = `<span data-reference-anchor="${escapeHtml(span.referenceAnchor)}" title="${escapeHtml(span.referenceText)}">${content}</span>`
    if (span.href) content = `<a href="${escapeHtml(span.href)}">${content}</a>`
    return content
  }).join('')
}

export function pageText(page: ImportPage) {
  return page.blocks.map(block => block.text || block.rows?.flat().join(' ') || '').join(' ')
}
