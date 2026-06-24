import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, ArrowRight, Bold, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Eraser, Eye, FileText, Image as ImageIcon, Info, Italic, Link2, List, ListOrdered, ListTree, Loader2, Palette, PanelRight, Redo2, Save, Sparkles, Strikethrough, Subscript, Superscript, Table2, Type, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBook } from '@/lib/book-repository'
import { updatePublisherBook, type PublisherBook } from '@/lib/publisher-books'
import { openReaderPreview } from '@/lib/app-routes'
import { supabase } from '@/integrations/supabase/client'
import { estimateAiTextUsage, runAiThroughGateway, type RunAiResult } from '@/lib/ai-gateway'
import { useAuthContext } from '@/lib/auth-context'
import { useCredits } from '@/hooks/useCredits'
import { creditsBus } from '@/lib/credits-bus'
import { buildTocFromHeadingsV2, createV2Id, documentV2ToConfirmedToc, documentV2ToLegacyPages, legacyBookToDocumentV2, normalizeBookTextV2, resolveTocTreeV2, textDirectionV2, tocAsFlatListV2, type BookBlockV2, type BookDocumentV2, type BookInlineV2, type BookTocItemV2, type CalloutBlockV2, type ParagraphBlockV2 } from '@/lib/book-document-v2'
import type { PrintPageValue } from '@/lib/book-content'
import type { MockBook } from '@/lib/mock-data'
import './editor-v2.css'

type EditorPanelV2 = 'toc' | 'upgrade' | 'media' | 'interactive' | 'ai'
type SaveStateV2 = 'idle' | 'saving' | 'saved' | 'error'
type SaveVisualStateV2 = SaveStateV2 | 'dirty'
type TextToolbarStateV2 = {
  hasSelection: boolean
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  superscript: boolean
  subscript: boolean
  alignment?: 'left' | 'right' | 'center' | 'justify'
}
type AiApprovalV2 = {
  usage: RunAiResult['usage']
  provider: string
  model: string
  pageText: string
}

const PANEL_LABELS: Record<EditorPanelV2, { title: string; icon: typeof ListTree }> = {
  toc: { title: 'فهرست', icon: ListTree },
  upgrade: { title: 'ارتقا متن', icon: FileText },
  media: { title: 'رسانه', icon: ImageIcon },
  interactive: { title: 'ابزار تعاملی', icon: PanelRight },
  ai: { title: 'هوش مصنوعی', icon: Sparkles },
}

const CALLOUT_VARIANTS_V2 = ['key', 'question', 'warning', 'quote', 'deep', 'practice', 'glossary', 'data', 'margin'] as const

const CALLOUT_META_V2: Record<(typeof CALLOUT_VARIANTS_V2)[number], { title: string; icon: string }> = {
  key: { title: 'نکته کلیدی', icon: '💡' },
  question: { title: 'مکث و فکر کن', icon: '❔' },
  warning: { title: 'اشتباه رایج', icon: '⚠️' },
  quote: { title: 'جمله طلایی', icon: '❝' },
  deep: { title: 'عمیق‌تر بخوان', icon: '🔍' },
  practice: { title: 'تمرین سریع', icon: '✅' },
  glossary: { title: 'تعریف واژه', icon: '📘' },
  data: { title: 'داده و منبع', icon: '📊' },
  margin: { title: 'یادداشت حاشیه‌ای', icon: '📝' },
}

const escapeHtmlV2 = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const attrV2 = (name: string, value: unknown) => value === undefined || value === null || value === '' ? '' : ` ${name}="${escapeHtmlV2(String(value))}"`

const FONT_SIZE_MAP_V2: Record<string, string> = {
  '1': '0.72rem',
  '2': '0.86rem',
  '3': '1rem',
  '4': '1.16rem',
  '5': '1.34rem',
  '6': '1.56rem',
  '7': '1.82rem',
}

function styleAttrFromInlineV2(style?: BookInlineV2['style']) {
  if (!style) return ''
  const declarations = [
    style.color ? `color:${escapeHtmlV2(style.color)}` : '',
    style.fontFamily ? `font-family:${escapeHtmlV2(style.fontFamily)}` : '',
    style.fontSize ? `font-size:${escapeHtmlV2(style.fontSize)}` : '',
  ].filter(Boolean)
  return declarations.length ? ` style="${declarations.join(';')}"` : ''
}

function blockStyleAttrV2(block: BookBlockV2) {
  const style = block.style || {}
  const declarations = [
    style.color ? `color:${escapeHtmlV2(String(style.color))}` : '',
    style.fontFamily ? `font-family:${escapeHtmlV2(String(style.fontFamily))}` : '',
    style.fontSize ? `font-size:${escapeHtmlV2(String(style.fontSize))}` : '',
    style.fontSizePt ? `font-size:${escapeHtmlV2(String(style.fontSizePt))}pt` : '',
    style.alignment ? `text-align:${escapeHtmlV2(String(style.alignment))}` : '',
    style.bold ? 'font-weight:800' : '',
    style.italic ? 'font-style:italic' : '',
  ].filter(Boolean)
  return declarations.length ? ` style="${declarations.join(';')}"` : ''
}

function normalizeAlignmentV2(value?: string | null) {
  const alignment = String(value || '').trim().toLowerCase()
  if (alignment === 'start') return 'right'
  if (alignment === 'end') return 'left'
  if (['left', 'right', 'center', 'justify'].includes(alignment)) return alignment
  return undefined
}

function boldWeightV2(value?: string | null) {
  const weight = String(value || '').trim().toLowerCase()
  return weight === 'bold' || Number(weight) >= 600
}

const EMPTY_TEXT_TOOLBAR_STATE_V2: TextToolbarStateV2 = {
  hasSelection: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false,
}

function citationAttrsV2(span: BookInlineV2) {
  const text = normalizeBookTextV2(span.footnoteText || span.referenceText || '')
  if (!text && !span.footnoteId) return ''
  return [
    ' class="citation-reference editor-v2-citation-reference"',
    span.footnoteId ? attrV2('data-footnote-id', span.footnoteId) : '',
    span.footnoteText ? attrV2('data-footnote-text', text) : '',
    span.referenceAnchor ? attrV2('data-reference-anchor', span.referenceAnchor) : '',
    span.referenceText ? attrV2('data-reference-text', text) : '',
    attrV2('data-tooltip-dir', textDirectionV2(text || span.text)),
  ].join('')
}

function inlineSpansToEditorHtmlV2(inline?: BookInlineV2[], fallback = '') {
  if (!inline?.length) return escapeHtmlV2(fallback)
  return inline.map(span => {
    let html = escapeHtmlV2(span.text)
    const marks = span.marks || []
    if (marks.includes('subscript')) html = `<sub>${html}</sub>`
    if (marks.includes('superscript')) html = `<sup>${html}</sup>`
    if (marks.includes('bold')) html = `<strong>${html}</strong>`
    if (marks.includes('italic')) html = `<em>${html}</em>`
    if (marks.includes('underline')) html = `<u>${html}</u>`
    if (marks.includes('strike')) html = `<s>${html}</s>`
    if (span.style) html = `<span${styleAttrFromInlineV2(span.style)}>${html}</span>`
    if (span.href) html = `<a href="${escapeHtmlV2(span.href)}">${html}</a>`
    if (span.footnoteText || span.referenceText || span.footnoteId) {
      const noteText = normalizeBookTextV2(span.footnoteText || span.referenceText || '')
      const dir = textDirectionV2(noteText || span.text)
      html = `<span${citationAttrsV2(span)} dir="${dir}">${html}${noteText ? `<span contenteditable="false" class="citation-tooltip" dir="${dir}">${escapeHtmlV2(noteText)}</span>` : ''}</span>`
    }
    return html
  }).join('')
}

function inlineToEditorHtmlV2(block: Extract<BookBlockV2, { type: 'paragraph' | 'heading' }>) {
  return inlineSpansToEditorHtmlV2(block.inline, block.text)
}

function blockToEditorHtmlV2(block: BookBlockV2): string {
  if (block.type === 'heading') {
    return `<h${block.level}${attrV2('id', block.anchor || block.id)} data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="heading" data-level="${block.level}"${attrV2('dir', block.direction)}${blockStyleAttrV2(block)}>${inlineToEditorHtmlV2(block)}</h${block.level}>`
  }
  if (block.type === 'paragraph') {
    return `<p${attrV2('id', block.anchor || block.id)} data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="paragraph"${attrV2('dir', block.direction)}${blockStyleAttrV2(block)}>${inlineToEditorHtmlV2(block)}</p>`
  }
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul'
    return `<${tag} data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="list"${attrV2('dir', block.direction)}${blockStyleAttrV2(block)}>${block.items.map(item => `<li data-item-id="${escapeHtmlV2(item.id)}">${inlineSpansToEditorHtmlV2(item.inline, item.text)}</li>`).join('')}</${tag}>`
  }
  if (block.type === 'image') {
    const width = block.widthPercent ? `${Math.max(12, Math.min(100, block.widthPercent))}%` : block.widthPx ? `${Math.max(80, block.widthPx)}px` : ''
    return `<figure contenteditable="false" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="image"${attrV2('data-image-id', block.imageId)}${attrV2('data-width-px', block.widthPx)}${attrV2('data-width-percent', block.widthPercent)}>${block.url ? `<img src="${escapeHtmlV2(block.url)}" alt="${escapeHtmlV2(block.caption || '')}"${width ? ` style="max-width:${escapeHtmlV2(width)}"` : ''}>` : '<div class="book-v2-missing-image">تصویر در دسترس نیست</div>'}${block.caption ? `<figcaption>${escapeHtmlV2(block.caption)}</figcaption>` : ''}</figure>`
  }
  if (block.type === 'table') {
    const headers = block.headers?.length ? `<thead><tr>${block.headers.map(cell => `<th>${escapeHtmlV2(cell)}</th>`).join('')}</tr></thead>` : ''
    const rows = block.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtmlV2(cell)}</td>`).join('')}</tr>`).join('')
    return `<div contenteditable="false" class="final-table book-v2-table" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="table">${block.caption ? `<p class="reader-table-title">${escapeHtmlV2(block.caption)}</p>` : ''}<table>${headers}<tbody>${rows}</tbody></table></div>`
  }
  if (block.type === 'callout') {
    const body = block.blocks.map(blockToEditorHtmlV2).join('')
    return `<section contenteditable="false" class="book-callout editor-v2-callout has-rendered-title callout-${escapeHtmlV2(block.variant)}" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="callout" data-variant="${escapeHtmlV2(block.variant)}" data-callout-variant="${escapeHtmlV2(block.variant)}" data-callout-title="${escapeHtmlV2(block.title)}" data-callout-icon="${escapeHtmlV2(block.icon || '')}"><div class="book-callout-head"><span class="book-callout-icon">${escapeHtmlV2(block.icon || '')}</span><strong>${escapeHtmlV2(block.title)}</strong></div><div class="book-callout-content">${body}</div></section>`
  }
  if (block.type === 'interactive') {
    return `<section contenteditable="false" class="book-interactive-v2" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="interactive" data-kind="${escapeHtmlV2(block.kind)}"><strong>${escapeHtmlV2(block.title || String(block.payload.title || 'بخش تعاملی'))}</strong></section>`
  }
  if (block.type === 'math') {
    return `<p data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="math">${escapeHtmlV2(block.expression)}</p>`
  }
  return ''
}

function documentToEditorHtmlV2(bookDocument: BookDocumentV2) {
  return bookDocument.pages.map((page, index) => {
    const pageBreak = index > 0
      ? `<div contenteditable="false" class="editor-v2-flow-page-break" data-page-break="true"><span>${escapeHtmlV2(String(page.printNumber ?? index + 1))}</span></div>`
      : ''
    return `<section class="editor-v2-flow-page" data-page-index="${page.index}"${attrV2('data-print-page', page.printNumber)}>${pageBreak}${page.blocks.map(blockToEditorHtmlV2).join('')}</section>`
  }).join('')
}

function mergeInlineStyleFromElementV2(element: Element, inherited: BookInlineV2['style'] = {}) {
  const html = element as HTMLElement
  const tag = element.tagName.toLowerCase()
  const style = { ...(inherited || {}) }
  if (html.style.color) style.color = html.style.color
  if (html.style.fontFamily) style.fontFamily = html.style.fontFamily
  if (html.style.fontSize) style.fontSize = html.style.fontSize
  if (tag === 'font') {
    const color = element.getAttribute('color')
    const face = element.getAttribute('face')
    const size = element.getAttribute('size')
    if (color) style.color = color
    if (face) style.fontFamily = face
    if (size) style.fontSize = FONT_SIZE_MAP_V2[size] || size
  }
  return style
}

function blockStyleFromElementV2(element: Element, _old?: BookBlockV2 | null) {
  const html = element as HTMLElement
  const styledDescendant = element.querySelector<HTMLElement>('[style], [align]')
  const styleSource = styledDescendant || html
  const style: Record<string, unknown> = {}
  const alignment = normalizeAlignmentV2(html.style.textAlign || html.getAttribute('align') || styleSource.style.textAlign || styleSource.getAttribute('align'))
  if (alignment) style.alignment = alignment
  if (html.style.color) style.color = html.style.color
  if (html.style.fontFamily) style.fontFamily = html.style.fontFamily
  if (html.style.fontSize) style.fontSize = html.style.fontSize
  const fontWeight = html.style.fontWeight || styleSource.style.fontWeight
  if (fontWeight && (fontWeight === 'bold' || Number(fontWeight) >= 600)) style.bold = true
  if (html.style.fontStyle === 'italic' || styleSource.style.fontStyle === 'italic') style.italic = true
  return Object.keys(style).length ? style : undefined
}

function inlineFromDomV2(node: Node, marks: BookInlineV2['marks'] = [], href?: string, inheritedStyle: BookInlineV2['style'] = {}): BookInlineV2[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeBookTextV2(node.textContent || '')
    const style = Object.keys(inheritedStyle || {}).length ? { ...inheritedStyle } : undefined
    return text ? [{ text, marks: marks.length ? [...marks] : undefined, href, style }] : []
  }
  if (!(node instanceof Element)) return []
  if (node.classList.contains('citation-tooltip')) return []
  const tag = node.tagName.toLowerCase()
  const html = node as HTMLElement
  const nextMarks = [...(marks || [])]
  if ((tag === 'strong' || tag === 'b') && !nextMarks.includes('bold')) nextMarks.push('bold')
  if ((tag === 'em' || tag === 'i') && !nextMarks.includes('italic')) nextMarks.push('italic')
  if (tag === 'u' && !nextMarks.includes('underline')) nextMarks.push('underline')
  if ((tag === 's' || tag === 'strike') && !nextMarks.includes('strike')) nextMarks.push('strike')
  if (tag === 'sub' && !nextMarks.includes('subscript')) nextMarks.push('subscript')
  if (tag === 'sup' && !nextMarks.includes('superscript')) nextMarks.push('superscript')
  const fontWeight = html.style.fontWeight
  const textDecoration = html.style.textDecoration || html.style.textDecorationLine
  if (fontWeight && (fontWeight === 'bold' || Number(fontWeight) >= 600) && !nextMarks.includes('bold')) nextMarks.push('bold')
  if (html.style.fontStyle === 'italic' && !nextMarks.includes('italic')) nextMarks.push('italic')
  if (textDecoration.includes('underline') && !nextMarks.includes('underline')) nextMarks.push('underline')
  if ((textDecoration.includes('line-through') || textDecoration.includes('strike')) && !nextMarks.includes('strike')) nextMarks.push('strike')
  if ((html.style.verticalAlign === 'super' || html.style.verticalAlign === 'sup') && !nextMarks.includes('superscript')) nextMarks.push('superscript')
  if ((html.style.verticalAlign === 'sub' || html.style.verticalAlign === 'subscript') && !nextMarks.includes('subscript')) nextMarks.push('subscript')
  const nextHref = tag === 'a' ? node.getAttribute('href') || href : href
  const nextStyle = mergeInlineStyleFromElementV2(node, inheritedStyle)
  const footnoteText = normalizeBookTextV2((node as HTMLElement).dataset.footnoteText || '')
  const referenceText = normalizeBookTextV2((node as HTMLElement).dataset.referenceText || '')
  const footnoteId = (node as HTMLElement).dataset.footnoteId
  const referenceAnchor = (node as HTMLElement).dataset.referenceAnchor
  const children = Array.from(node.childNodes).flatMap(child => inlineFromDomV2(child, nextMarks, nextHref, nextStyle))
  if (!footnoteText && !referenceText && !footnoteId && !referenceAnchor) return children
  if (children.length) {
    return children.map((span, index) => index === 0
      ? { ...span, footnoteId, footnoteText: footnoteText || undefined, referenceAnchor, referenceText: referenceText || undefined }
      : span)
  }
  return [{ text: footnoteId || referenceAnchor || '', marks: nextMarks.length ? nextMarks : undefined, href: nextHref, style: Object.keys(nextStyle || {}).length ? nextStyle : undefined, footnoteId, footnoteText: footnoteText || undefined, referenceAnchor, referenceText: referenceText || undefined }]
}

function inlineFromElementV2(element: Element) {
  const inline = Array.from(element.childNodes).flatMap(child => inlineFromDomV2(child))
  return inline.length ? inline : undefined
}

function textFromElementV2(element: Element) {
  const inline = inlineFromElementV2(element)
  return inline?.map(span => span.text).join('') || normalizeBookTextV2((element as HTMLElement).innerText || element.textContent || '')
}

function inlineOnlyElementV2(element: Element) {
  const tag = element.tagName.toLowerCase()
  return ['span', 'font', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'a', 'br'].includes(tag)
}

function existingBlocksV2(bookDocument: BookDocumentV2) {
  const map = new Map<string, BookBlockV2>()
  const visit = (blocks: BookBlockV2[]) => {
    blocks.forEach(block => {
      map.set(block.id, block)
      if (block.type === 'callout') visit(block.blocks)
    })
  }
  bookDocument.pages.forEach(page => visit(page.blocks))
  return map
}

function tableBlockFromElementV2(element: Element, id: string, page: BookDocumentV2['pages'][number], old?: BookBlockV2 | null): BookBlockV2 | null {
  const table = element.tagName.toLowerCase() === 'table' ? element : element.querySelector('table')
  if (!table) return null
  const rows = Array.from(table.querySelectorAll('tr')).map(row =>
    Array.from(row.querySelectorAll('th,td')).map(cell => normalizeBookTextV2((cell as HTMLElement).innerText || cell.textContent || '')),
  ).filter(row => row.some(Boolean))
  if (!rows.length) return null
  const headerCells = Array.from(table.querySelectorAll('thead tr:first-child th')).map(cell => normalizeBookTextV2((cell as HTMLElement).innerText || cell.textContent || '')).filter(Boolean)
  const caption = normalizeBookTextV2(element.querySelector('caption')?.textContent || element.querySelector('.reader-table-title')?.textContent || '')
  return {
    ...(old && old.type === 'table' ? old : {}),
    id,
    type: 'table',
    headers: headerCells.length ? headerCells : undefined,
    rows: headerCells.length ? rows.slice(1) : rows,
    caption: caption || (old?.type === 'table' ? old.caption : undefined),
    anchor: old?.anchor || id,
    printNumber: page.printNumber,
    style: blockStyleFromElementV2(element, old),
  } as BookBlockV2
}

function elementToBlockV2(element: Element, page: BookDocumentV2['pages'][number], index: number, existing: Map<string, BookBlockV2>): BookBlockV2 | null {
  const html = element as HTMLElement
  if (html.dataset.pageBreak) return null
  const id = html.dataset.blockId || createV2Id('block', page.index, index, Date.now())
  const old = existing.get(id)
  const tag = element.tagName.toLowerCase()
  const v2Type = html.dataset.v2Type
  if (v2Type === 'callout' && old?.type === 'callout') return old
  if (v2Type === 'interactive' && old?.type === 'interactive') return old
  if (v2Type === 'table' && old?.type === 'table') return old
  if (v2Type === 'table' || tag === 'table' || element.querySelector(':scope > table')) return tableBlockFromElementV2(element, id, page, old)
  const nestedDirectList = element.querySelector<HTMLElement>(':scope > ol, :scope > ul')
  if (nestedDirectList && tag !== 'ol' && tag !== 'ul') {
    nestedDirectList.dataset.blockId ||= id
    if (html.style.textAlign && !nestedDirectList.style.textAlign) nestedDirectList.style.textAlign = html.style.textAlign
    if (html.style.fontFamily && !nestedDirectList.style.fontFamily) nestedDirectList.style.fontFamily = html.style.fontFamily
    if (html.style.fontSize && !nestedDirectList.style.fontSize) nestedDirectList.style.fontSize = html.style.fontSize
    if (html.style.color && !nestedDirectList.style.color) nestedDirectList.style.color = html.style.color
    const wrapperDirection = element.getAttribute('dir')
    if (wrapperDirection && !nestedDirectList.getAttribute('dir')) nestedDirectList.setAttribute('dir', wrapperDirection)
    return elementToBlockV2(nestedDirectList, page, index, existing)
  }
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6
    const inline = inlineFromElementV2(element)
    return { ...(old && old.type === 'heading' ? old : {}), id, type: 'heading', level, text: textFromElementV2(element), inline, anchor: old?.anchor || id, printNumber: page.printNumber, direction: (element.getAttribute('dir') as any) || old?.direction, style: blockStyleFromElementV2(element, old) }
  }
  if (tag === 'div') {
    const directContent = Array.from(element.children).filter(child => !(child as HTMLElement).dataset.pageBreak)
    if (directContent.length === 1 && ['ol', 'ul'].includes(directContent[0].tagName.toLowerCase())) {
      return elementToBlockV2(directContent[0], page, index, existing)
    }
  }
  if (tag === 'p' || tag === 'div') {
    const text = textFromElementV2(element)
    if (!text) return null
    return { ...(old && old.type === 'paragraph' ? old : {}), id, type: 'paragraph', text, inline: inlineFromElementV2(element), anchor: old?.anchor || id, printNumber: page.printNumber, direction: (element.getAttribute('dir') as any) || old?.direction, style: blockStyleFromElementV2(element, old) } as ParagraphBlockV2
  }
  if (tag === 'blockquote') {
    const text = textFromElementV2(element)
    if (!text) return null
    return { ...(old && old.type === 'paragraph' ? old : {}), id, type: 'paragraph', semantic: 'quote', text, inline: inlineFromElementV2(element), anchor: old?.anchor || id, printNumber: page.printNumber, direction: (element.getAttribute('dir') as any) || old?.direction, style: blockStyleFromElementV2(element, old) } as ParagraphBlockV2
  }
  if (tag === 'li' || inlineOnlyElementV2(element)) {
    const text = textFromElementV2(element)
    if (!text) return null
    return {
      ...(old && old.type === 'paragraph' ? old : {}),
      id,
      type: 'paragraph',
      text,
      inline: inlineFromElementV2(element),
      anchor: old?.anchor || id,
      printNumber: page.printNumber,
      direction: (element.getAttribute('dir') as any) || old?.direction,
      style: blockStyleFromElementV2(element, old),
    } as ParagraphBlockV2
  }
  if (tag === 'ol' || tag === 'ul') {
    const items = Array.from(element.querySelectorAll(':scope > li')).map((li, itemIndex) => ({
      id: (li as HTMLElement).dataset.itemId || createV2Id('item', id, itemIndex),
      text: textFromElementV2(li),
      inline: inlineFromElementV2(li),
    })).filter(item => item.text)
    if (!items.length) return null
    return { ...(old && old.type === 'list' ? old : {}), id, type: 'list', ordered: tag === 'ol', items, anchor: old?.anchor || id, printNumber: page.printNumber, direction: (element.getAttribute('dir') as any) || old?.direction, style: blockStyleFromElementV2(element, old) }
  }
  if (tag === 'figure') {
    const image = element.querySelector('img')
    return {
      ...(old && old.type === 'image' ? old : {}),
      id,
      type: 'image',
      url: image?.getAttribute('src') || (old?.type === 'image' ? old.url : ''),
      caption: textFromElementV2(element.querySelector('figcaption') || element),
      imageId: (element as HTMLElement).dataset.imageId || (old?.type === 'image' ? old.imageId : undefined),
      widthPx: Number((element as HTMLElement).dataset.widthPx) || (old?.type === 'image' ? old.widthPx : undefined),
      widthPercent: Number((element as HTMLElement).dataset.widthPercent) || (old?.type === 'image' ? old.widthPercent : undefined),
      anchor: old?.anchor || id,
      printNumber: page.printNumber,
    } as BookBlockV2
  }
  if (old) return old
  return null
}

function textNodeToParagraphV2(node: Text, page: BookDocumentV2['pages'][number], index: number): ParagraphBlockV2 | null {
  const text = normalizeBookTextV2(node.textContent || '')
  if (!text) return null
  const id = createV2Id('paragraph', page.index, index, Date.now())
  return {
    id,
    type: 'paragraph',
    text,
    inline: [{ text }],
    anchor: id,
    printNumber: page.printNumber,
  }
}

function editorNodeToBlockV2(node: ChildNode, page: BookDocumentV2['pages'][number], index: number, existing: Map<string, BookBlockV2>): BookBlockV2 | null {
  if (node.nodeType === Node.TEXT_NODE) return textNodeToParagraphV2(node as Text, page, index)
  if (node instanceof Element) return elementToBlockV2(node, page, index, existing)
  return null
}

function documentFromEditorDomV2(bookDocument: BookDocumentV2, root: HTMLElement | null): BookDocumentV2 {
  if (!root) return bookDocument
  const existing = existingBlocksV2(bookDocument)
  const pages = bookDocument.pages.map((page, pageIndex) => {
    const pageElement = root.querySelector<HTMLElement>(`.editor-v2-flow-page[data-page-index="${page.index}"]`) || root.querySelectorAll<HTMLElement>('.editor-v2-flow-page')[pageIndex]
    if (!pageElement) return page
    const blocks = Array.from(pageElement.childNodes)
      .map((node, index) => editorNodeToBlockV2(node, page, index, existing))
      .filter((block): block is BookBlockV2 => Boolean(block))
    return { ...page, blocks }
  })
  return rebuildDocumentTocV2({ ...bookDocument, pages, updatedAt: new Date().toISOString() })
}

function mapBlocksV2(blocks: BookBlockV2[], mapper: (block: BookBlockV2) => BookBlockV2 | BookBlockV2[] | null): BookBlockV2[] {
  return blocks.flatMap(block => {
    const nextBlock = block.type === 'callout' ? { ...block, blocks: mapBlocksV2(block.blocks, mapper) } : block
    const mapped = mapper(nextBlock)
    if (!mapped) return []
    return Array.isArray(mapped) ? mapped : [mapped]
  })
}

function findBlockV2(blocks: BookBlockV2[], id?: string): BookBlockV2 | null {
  if (!id) return null
  for (const block of blocks) {
    if (block.id === id) return block
    if (block.type === 'callout') {
      const found = findBlockV2(block.blocks, id)
      if (found) return found
    }
  }
  return null
}

function findBlockInDocumentV2(document: BookDocumentV2, id?: string) {
  for (const page of document.pages) {
    const block = findBlockV2(page.blocks, id)
    if (block) return block
  }
  return null
}

function rebuildDocumentTocV2(document: BookDocumentV2): BookDocumentV2 {
  return { ...document, toc: buildTocFromHeadingsV2(document.pages), updatedAt: new Date().toISOString() }
}

function updateBlockInDocumentV2(document: BookDocumentV2, blockId: string, mapper: (block: BookBlockV2) => BookBlockV2 | BookBlockV2[] | null) {
  const pages = document.pages.map(page => ({ ...page, blocks: mapBlocksV2(page.blocks, block => block.id === blockId ? mapper(block) : block) }))
  return rebuildDocumentTocV2({ ...document, pages })
}

function insertBlockAfterV2(document: BookDocumentV2, selectedBlockId: string | undefined, newBlock: BookBlockV2) {
  let inserted = false
  const insertInBlocks = (blocks: BookBlockV2[]): BookBlockV2[] => {
    const next: BookBlockV2[] = []
    blocks.forEach(block => {
      if (block.type === 'callout') next.push({ ...block, blocks: insertInBlocks(block.blocks) })
      else next.push(block)
      if (!inserted && selectedBlockId && block.id === selectedBlockId) {
        next.push(newBlock)
        inserted = true
      }
    })
    return next
  }
  const pages = document.pages.map(page => ({ ...page, blocks: insertInBlocks(page.blocks) }))
  if (!inserted) {
    const firstPage = pages[0] || { id: createV2Id('page', 1), index: 0, printNumber: 1, blocks: [] }
    firstPage.blocks = [...firstPage.blocks, newBlock]
    if (!pages.length) pages.push(firstPage)
  }
  return rebuildDocumentTocV2({ ...document, pages })
}

function createInteractiveTemplateV2(kind: string, printNumber?: PrintPageValue): BookBlockV2 {
  const id = createV2Id('interactive', kind, Date.now())
  const common = { id, type: 'interactive' as const, kind: kind as any, anchor: id, printNumber }
  if (kind === 'quiz') return { ...common, title: 'کوییز چندگزینه‌ای', payload: { question: 'سؤال را اینجا بنویسید', options: ['گزینه اول', 'گزینه دوم', 'گزینه سوم'], correct: 0, explanation: '' } }
  if (kind === 'truefalse') return { ...common, title: 'صحیح یا غلط', payload: { question: 'گزاره را اینجا بنویسید', options: ['صحیح', 'غلط'], correct: 0, explanation: '' } }
  if (kind === 'flashcard') return { ...common, title: 'فلش‌کارت', payload: { cards: [{ front: 'روی کارت', back: 'پشت کارت', image: '' }] } }
  if (kind === 'gallery') return { ...common, title: 'گالری تصویر', payload: { title: 'گالری تصویر', images: [{ url: '', caption: '' }] } }
  if (kind === 'timeline') return { ...common, title: 'تایم‌لاین', payload: { title: 'تایم‌لاین', events: [{ title: 'مرحله اول', description: '', image: '' }, { title: 'مرحله دوم', description: '', image: '' }] } }
  if (kind === 'author') return { ...common, title: 'معرفی نویسندگان', payload: { title: 'نویسندگان', authors: [{ name: '', role: '', bio: '', image: '' }] } }
  return { ...common, title: 'مراحل تعاملی', payload: { title: 'مراحل تعاملی', steps: [{ title: 'مرحله اول', description: '', image: '' }, { title: 'مرحله دوم', description: '', image: '' }] } }
}

function plainTextFromBlockV2(block: BookBlockV2): string {
  if (block.type === 'heading' || block.type === 'paragraph') return block.text
  if (block.type === 'callout') return block.blocks.map(plainTextFromBlockV2).join('\n')
  if (block.type === 'image') return block.caption || ''
  if (block.type === 'list') return block.items.map(item => item.text).join('\n')
  if (block.type === 'table') return [...(block.headers || []), ...block.rows.flat()].join(' ')
  if (block.type === 'math') return block.expression
  if (block.type === 'interactive') return String(block.title || block.payload.title || '')
  return ''
}

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function SaveIndicator({ state, floating = false }: { state: SaveVisualStateV2; floating?: boolean }) {
  const label = state === 'saving'
    ? 'در حال ذخیره'
    : state === 'saved'
      ? 'ذخیره شد'
      : state === 'error'
        ? 'ذخیره ناموفق'
        : state === 'dirty'
          ? 'ذخیره نشده'
        : 'منتشر شده'
  const isReady = state === 'saved'
  if (floating) {
    return (
      <span className={`editor-v2-save-state ${state} floating`} title={label} aria-label={label} aria-live="polite">
        <span className="editor-v2-save-icon">
          {state === 'saving' ? <Loader2 size={16} /> : <Save size={16} />}
          {isReady && <Check size={11} className="editor-v2-save-check" />}
        </span>
      </span>
    )
  }
  return (
    <span className={`editor-v2-save-state ${state}`} title={label} aria-live="polite">
      <span className="editor-v2-save-icon">
        {state === 'saving' ? <Loader2 size={14} /> : <Save size={14} />}
        {isReady && <Check size={10} className="editor-v2-save-check" />}
      </span>
      <span>{label}</span>
    </span>
  )
}

function TocTreeV2({
  items,
  activeId,
  openIds,
  onToggle,
  onJump,
  depth = 0,
}: {
  items: BookTocItemV2[]
  activeId?: string
  openIds: Set<string>
  onToggle: (id: string) => void
  onJump: (item: BookTocItemV2) => void
  depth?: number
}) {
  return (
    <div className="editor-v2-toc-tree" style={{ ['--toc-depth' as string]: depth }}>
      {items.map(item => {
        const hasChildren = Boolean(item.children?.length)
        const isOpen = openIds.has(item.id)
        return (
          <div key={item.id} className={`editor-v2-toc-node level-${item.level} ${activeId === item.id ? 'is-active' : ''}`}>
            <div className="editor-v2-toc-row">
              <button className="editor-v2-toc-title" type="button" title={item.title} onClick={() => onJump(item)}>
                {item.level === 1 && <span className="editor-v2-toc-h1-number">{item.printNumber || item.pageIndex + 1}</span>}
                <span>{item.title}</span>
              </button>
              {hasChildren && (
                <button className="editor-v2-toc-toggle" type="button" onClick={() => onToggle(item.id)} aria-label={isOpen ? 'جمع کردن' : 'باز کردن'}>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
                </button>
              )}
            </div>
            {hasChildren && isOpen && (
              <TocTreeV2 items={item.children || []} activeId={activeId} openIds={openIds} onToggle={onToggle} onJump={onJump} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RightPanelV2({
  document,
  activePanel,
  setActivePanel,
  activeTocId,
  onJumpToToc,
  onInsertImage,
  onInsertInteractive,
  onApplyCallout,
  onUnwrapCallout,
  canUnwrapCallout,
  onAiEnhance,
  aiBusy,
  aiMessage,
}: {
  document: BookDocumentV2
  activePanel: EditorPanelV2
  setActivePanel: (panel: EditorPanelV2) => void
  activeTocId?: string
  onJumpToToc: (item: BookTocItemV2) => void
  onInsertImage: (assetId: string) => void
  onInsertInteractive: (kind: string) => void
  onApplyCallout: (variant: (typeof CALLOUT_VARIANTS_V2)[number]) => void
  onUnwrapCallout: () => void
  canUnwrapCallout: boolean
  onAiEnhance: () => void
  aiBusy: boolean
  aiMessage: string
}) {
  const tree = useMemo(() => resolveTocTreeV2(document.toc), [document.toc])
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(tree.map(item => item.id)))
  useEffect(() => {
    setOpenIds(new Set(tree.map(item => item.id)))
  }, [tree])
  const toggle = useCallback((id: string) => {
    setOpenIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const ActiveIcon = PANEL_LABELS[activePanel].icon
  return (
    <aside className="editor-v2-side">
      <nav className="editor-v2-side-tabs" aria-label="ابزارهای ادیتور">
        {(Object.keys(PANEL_LABELS) as EditorPanelV2[]).map(panel => {
          const Icon = PANEL_LABELS[panel].icon
          return (
            <button key={panel} className={activePanel === panel ? 'is-active' : ''} type="button" onClick={() => setActivePanel(panel)}>
              <Icon size={14} />
              <span>{PANEL_LABELS[panel].title}</span>
            </button>
          )
        })}
      </nav>
      <section className="editor-v2-panel menu-glass-70">
        <header>
          <ActiveIcon size={14} />
          <strong>{PANEL_LABELS[activePanel].title}</strong>
        </header>
        {activePanel === 'toc' && (
          <>
            <div className="editor-v2-panel-actions">
              <button type="button" onClick={() => setOpenIds(new Set(tocAsFlatListV2(document).map(item => item.id)))}>باز کردن همه</button>
              <button type="button" onClick={() => setOpenIds(new Set())}>جمع کردن همه</button>
            </div>
            {tree.length ? <TocTreeV2 items={tree} activeId={activeTocId} openIds={openIds} onToggle={toggle} onJump={onJumpToToc} /> : <p className="editor-v2-empty-panel">فهرستی برای این کتاب ثبت نشده است.</p>}
          </>
        )}
        {activePanel === 'upgrade' && (
          <div className="editor-v2-action-grid">
            {CALLOUT_VARIANTS_V2.map(variant => <button key={variant} type="button" onClick={() => onApplyCallout(variant)}><span>{CALLOUT_META_V2[variant].icon}</span>{CALLOUT_META_V2[variant].title}</button>)}
            <button type="button" disabled={!canUnwrapCallout} onClick={onUnwrapCallout}><Undo2 size={15} />برگرداندن کال‌اوت به متن عادی</button>
            <p>برای تبدیل متن به کال‌اوت، نشانگر را داخل همان پاراگراف بگذارید یا متن را انتخاب کنید و نوع کال‌اوت را از همین پنل بزنید.</p>
          </div>
        )}
        {activePanel === 'media' && (
          <div className="editor-v2-media-list">
            {document.assets.length ? document.assets.slice(0, 80).map(asset => (
              <button key={asset.id} type="button" onClick={() => onInsertImage(asset.id)}>
                <img src={asset.url} alt={asset.caption || ''} loading="lazy" />
                <span>{asset.caption || `تصویر صفحه ${asset.printNumber || ''}`}</span>
              </button>
            )) : <p className="editor-v2-empty-panel">تصویری در سند شناسایی نشده است.</p>}
          </div>
        )}
        {activePanel === 'interactive' && (
          <div className="editor-v2-action-grid">
            {[
              ['quiz', 'Quiz چندگزینه‌ای'],
              ['truefalse', 'صحیح/غلط'],
              ['flashcard', 'فلش‌کارت'],
              ['accordion', 'آکاردئون'],
              ['tabs', 'تب‌ها'],
              ['timeline', 'تایم‌لاین'],
              ['gallery', 'گالری تصویر'],
              ['scrollytelling', 'استوری‌تلینگ'],
              ['algorithm', 'الگوریتم تعاملی'],
              ['author', 'معرفی نویسنده'],
            ].map(([kind, label]) => <button key={kind} type="button" onClick={() => onInsertInteractive(kind)}><Sparkles size={15} />{label}</button>)}
          </div>
        )}
        {activePanel === 'ai' && (
          <div className="editor-v2-action-grid">
            <button type="button" disabled={aiBusy} onClick={onAiEnhance}>
              {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              پیشنهاد ارتقای خوانایی
            </button>
            <p>{aiMessage || 'اگر بلوکی انتخاب شده باشد همان متن بررسی می‌شود؛ در غیر این صورت متن صفحه/ابتدای سند مبنا قرار می‌گیرد.'}</p>
          </div>
        )}
      </section>
    </aside>
  )
}

export default function EditorV2Page() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { balance: creditBalance } = useCredits(user)
  const [book, setBook] = useState<MockBook | null>(null)
  const [document, setDocument] = useState<BookDocumentV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveStateV2>('idle')
  const [activePanel, setActivePanel] = useState<EditorPanelV2>('toc')
  const [activeTocId, setActiveTocId] = useState<string>()
  const [selectedBlockId, setSelectedBlockId] = useState<string>()
  const [toolbarState, setToolbarState] = useState<TextToolbarStateV2>(EMPTY_TEXT_TOOLBAR_STATE_V2)
  const [dirty, setDirty] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiApproval, setAiApproval] = useState<AiApprovalV2 | null>(null)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)
  const savedSelectionRef = useRef<Range | null>(null)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const skipNextSurfaceSyncRef = useRef(false)
  const selectedBlock = useMemo(() => document ? findBlockInDocumentV2(document, selectedBlockId) : null, [document, selectedBlockId])
  const visualSaveState: SaveVisualStateV2 = saveState === 'saving'
    ? 'saving'
    : saveState === 'error'
      ? 'error'
      : dirty
        ? 'dirty'
        : 'saved'
  const saveButtonTitle = visualSaveState === 'saving'
    ? 'در حال ذخیره'
    : visualSaveState === 'error'
      ? 'تلاش دوباره برای ذخیره'
      : visualSaveState === 'dirty'
        ? 'تغییرات ذخیره‌نشده'
        : 'ذخیره شد'
  const saveButtonClass = `${visualSaveState === 'saving' ? 'is-saving' : ''} ${visualSaveState === 'saved' ? 'is-saved' : ''} ${visualSaveState === 'dirty' ? 'is-dirty' : ''} ${visualSaveState === 'error' ? 'is-error' : ''}`

  useEffect(() => {
    if (!document || !editorSurfaceRef.current) return
    if (skipNextSurfaceSyncRef.current) {
      skipNextSurfaceSyncRef.current = false
      return
    }
    if (dirty && editorSurfaceRef.current.matches(':focus-within')) return
    editorSurfaceRef.current.innerHTML = documentToEditorHtmlV2(document)
  }, [dirty, document])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    void getBook(id)
      .then(found => {
        if (!alive) return
        if (!found) {
          setError('کتاب پیدا نشد.')
          setBook(null)
          setDocument(null)
          return
        }
        const nextDocument = legacyBookToDocumentV2(found)
        setBook(found)
        setDocument(nextDocument)
        setActiveTocId(nextDocument.toc[0]?.id)
        setSelectedBlockId(undefined)
        setDirty(false)
      })
      .catch(reason => {
        if (!alive) return
        setError(reason instanceof Error ? reason.message : 'لود کتاب ناموفق بود.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  const saveDocument = useCallback(async () => {
    if (!book || !document) return
    const startedAt = performance.now()
    setSaveState('saving')
    const nextDocument = { ...documentFromEditorDomV2(document, editorSurfaceRef.current), updatedAt: new Date().toISOString() }
    const pages = documentV2ToLegacyPages(nextDocument)
    const confirmedToc = documentV2ToConfirmedToc(nextDocument)
    const metadata = {
      ...(book.metadata || {}),
      confirmed_toc: confirmedToc,
      editor_v2_schema_version: '2.0',
      editor_v2_document: nextDocument,
      editor_v2_saved_at: nextDocument.updatedAt,
    }
    try {
      const patch = {
        metadata,
        pages,
        preview_pages: pages.slice(0, 3).map((_, index) => index),
        page_count: pages.length,
        content_updated_at: nextDocument.updatedAt,
      } as Partial<PublisherBook>
      const nextBook = { ...book, ...patch } as MockBook
      updatePublisherBook(book.id, nextBook as PublisherBook)
      skipNextSurfaceSyncRef.current = true
      setDocument(nextDocument)
      setBook(nextBook)
      if (isUuid(book.id)) {
        void (supabase as any).from('books').update(patch).eq('id', book.id).then(({ error }: { error?: unknown }) => {
          if (error) console.warn('Editor V2 remote sync failed; local save is preserved.', error)
        }).catch((reason: unknown) => {
          console.warn('Editor V2 remote sync failed; local save is preserved.', reason)
        })
      }
      const remainingAnimationMs = 520 - (performance.now() - startedAt)
      if (remainingAnimationMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, remainingAnimationMs))
      }
      setDirty(false)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2200)
    } catch {
      const remainingAnimationMs = 360 - (performance.now() - startedAt)
      if (remainingAnimationMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, remainingAnimationMs))
      }
      setSaveState('error')
    }
  }, [book, document])

  useEffect(() => {
    if (!dirty || !book || !document || saveState === 'saving' || saveState === 'error') return
    const handle = window.setTimeout(() => void saveDocument(), 1800)
    return () => window.clearTimeout(handle)
  }, [book, dirty, document, saveDocument, saveState])

  const commitDocument = useCallback((updater: (current: BookDocumentV2) => BookDocumentV2) => {
    setDocument(current => {
      if (!current) return current
      const base = documentFromEditorDomV2(current, editorSurfaceRef.current)
      const next = updater(base)
      setDirty(true)
      return next
    })
  }, [])

  const rememberEditorSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorSurfaceRef.current) return
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    const selectionNode = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (selectionNode && editorSurfaceRef.current.contains(selectionNode)) {
      savedSelectionRef.current = range.cloneRange()
    }
  }, [])

  const restoreEditorSelection = useCallback(() => {
    editorSurfaceRef.current?.focus()
    const range = savedSelectionRef.current
    if (!range) return
    try {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    } catch {
      savedSelectionRef.current = null
    }
  }, [])

  const selectedBlockIdFromSavedRange = useCallback(() => {
    const range = savedSelectionRef.current
    const root = editorSurfaceRef.current
    if (!range || !root) return undefined
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    const target = element?.closest<HTMLElement>('[data-block-id]')
    return target && root.contains(target) ? target.dataset.blockId : undefined
  }, [])

  const selectedEditorBlockElement = useCallback(() => {
    if (!selectedBlockId || !editorSurfaceRef.current) return null
    const safeId = selectedBlockId.replace(/"/g, '\\"')
    return editorSurfaceRef.current.querySelector<HTMLElement>(`[data-block-id="${safeId}"]`)
  }, [selectedBlockId])

  const editorElementFromCurrentSelection = useCallback(() => {
    const root = editorSurfaceRef.current
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!range || !root) return null
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    return element && root.contains(element) ? element : null
  }, [])

  const readToolbarStateFromSelection = useCallback((): TextToolbarStateV2 => {
    const element = editorElementFromCurrentSelection()
    const root = editorSurfaceRef.current
    if (!element || !root) return { ...EMPTY_TEXT_TOOLBAR_STATE_V2 }
    const target = element.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, li, ol, ul')
    const computed = window.getComputedStyle(element)
    const commandState = (command: string) => {
      try {
        return window.document.queryCommandState(command)
      } catch {
        return false
      }
    }
    const alignment = normalizeAlignmentV2(target?.style.textAlign || target?.getAttribute('align') || computed.textAlign)
    return {
      hasSelection: true,
      bold: commandState('bold') || boldWeightV2(computed.fontWeight),
      italic: commandState('italic') || computed.fontStyle === 'italic',
      underline: commandState('underline') || computed.textDecorationLine.includes('underline'),
      strike: commandState('strikeThrough') || computed.textDecorationLine.includes('line-through'),
      superscript: commandState('superscript') || computed.verticalAlign === 'super',
      subscript: commandState('subscript') || computed.verticalAlign === 'sub',
      alignment: alignment as TextToolbarStateV2['alignment'],
    }
  }, [editorElementFromCurrentSelection])

  const updateSelectedBlockFromDom = useCallback(() => {
    rememberEditorSelection()
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const target = element?.closest<HTMLElement>('[data-block-id]')
    setSelectedBlockId(target?.dataset.blockId)
    setToolbarState(readToolbarStateFromSelection())
  }, [readToolbarStateFromSelection, rememberEditorSelection])

  const markEditorDirty = useCallback(() => {
    setDirty(true)
    window.setTimeout(updateSelectedBlockFromDom, 0)
  }, [updateSelectedBlockFromDom])

  const refreshDocumentFromEditor = useCallback(() => {
    setDocument(current => current ? documentFromEditorDomV2(current, editorSurfaceRef.current) : current)
  }, [])

  const scheduleRefreshDocumentFromEditor = useCallback(() => {
    window.requestAnimationFrame(() => refreshDocumentFromEditor())
  }, [refreshDocumentFromEditor])

  const pushEditorHistory = useCallback(() => {
    const html = editorSurfaceRef.current?.innerHTML
    if (!html) return
    const stack = undoStackRef.current
    if (stack[stack.length - 1] !== html) {
      undoStackRef.current = [...stack.slice(-59), html]
      redoStackRef.current = []
    }
  }, [])

  const restoreEditorHtmlSnapshot = useCallback((html: string) => {
    if (!editorSurfaceRef.current) return
    editorSurfaceRef.current.innerHTML = html
    markEditorDirty()
    scheduleRefreshDocumentFromEditor()
  }, [markEditorDirty, scheduleRefreshDocumentFromEditor])

  const undoEditorChange = useCallback(() => {
    const currentHtml = editorSurfaceRef.current?.innerHTML
    const previousHtml = undoStackRef.current.pop()
    if (!previousHtml || !currentHtml) return
    redoStackRef.current = [...redoStackRef.current.slice(-59), currentHtml]
    restoreEditorHtmlSnapshot(previousHtml)
  }, [restoreEditorHtmlSnapshot])

  const redoEditorChange = useCallback(() => {
    const currentHtml = editorSurfaceRef.current?.innerHTML
    const nextHtml = redoStackRef.current.pop()
    if (!nextHtml || !currentHtml) return
    undoStackRef.current = [...undoStackRef.current.slice(-59), currentHtml]
    restoreEditorHtmlSnapshot(nextHtml)
  }, [restoreEditorHtmlSnapshot])

  const handleEditorBeforeInput = useCallback(() => {
    pushEditorHistory()
  }, [pushEditorHistory])

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    const isUndo = (event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey
    const isRedo = (event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))
    if (isUndo) {
      event.preventDefault()
      undoEditorChange()
      return
    }
    if (isRedo) {
      event.preventDefault()
      redoEditorChange()
    }
  }, [redoEditorChange, undoEditorChange])

  const applyInlineStyleToSelection = useCallback((style: Partial<CSSStyleDeclaration>) => {
    restoreEditorSelection()
    const selection = window.getSelection()
    if (!editorSurfaceRef.current) return false
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!range) {
      const fallbackTarget = selectedEditorBlockElement()
      if (!fallbackTarget) return false
      pushEditorHistory()
      Object.assign(fallbackTarget.style, style)
      markEditorDirty()
      scheduleRefreshDocumentFromEditor()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!element || !editorSurfaceRef.current.contains(element)) {
      const fallbackTarget = selectedEditorBlockElement()
      if (!fallbackTarget) return false
      pushEditorHistory()
      Object.assign(fallbackTarget.style, style)
      markEditorDirty()
      scheduleRefreshDocumentFromEditor()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    pushEditorHistory()
    if (range.collapsed) {
      const target = element.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, li')
      if (!target) return false
      Object.assign(target.style, style)
      markEditorDirty()
      rememberEditorSelection()
      scheduleRefreshDocumentFromEditor()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    const span = window.document.createElement('span')
    Object.assign(span.style, style)
    try {
      range.surroundContents(span)
    } catch {
      const contents = range.extractContents()
      span.appendChild(contents)
      range.insertNode(span)
    }
    const nextRange = window.document.createRange()
    nextRange.selectNodeContents(span)
    const activeSelection = selection || window.getSelection()
    if (!activeSelection) return false
    activeSelection.removeAllRanges()
    activeSelection.addRange(nextRange)
    savedSelectionRef.current = nextRange.cloneRange()
    markEditorDirty()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
    return true
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor, selectedEditorBlockElement])

  const applyRegularToSelection = useCallback(() => {
    restoreEditorSelection()
    pushEditorHistory()
    ;(['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript'] as const).forEach(command => {
      try {
        if (window.document.queryCommandState(command)) window.document.execCommand(command, false)
      } catch {
        // Ignore unsupported browser command states.
      }
    })
    const target = editorElementFromCurrentSelection()?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, li') || selectedEditorBlockElement()
    if (target) {
      target.style.fontWeight = ''
      target.style.fontStyle = ''
      target.style.textDecoration = ''
      target.style.textDecorationLine = ''
      target.style.verticalAlign = ''
    }
    markEditorDirty()
    rememberEditorSelection()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [editorElementFromCurrentSelection, markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor, selectedEditorBlockElement])

  const applyBlockAlignment = useCallback((alignment: 'left' | 'right' | 'center' | 'justify') => {
    restoreEditorSelection()
    const target = editorElementFromCurrentSelection()?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, ol, ul') || selectedEditorBlockElement()
    if (!target) return
    pushEditorHistory()
    target.style.textAlign = alignment
    markEditorDirty()
    rememberEditorSelection()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [editorElementFromCurrentSelection, markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor, selectedEditorBlockElement])

  const execTextCommand = useCallback((command: string, value?: string) => {
    if (command === 'undo') {
      undoEditorChange()
      return
    }
    if (command === 'redo') {
      redoEditorChange()
      return
    }
    pushEditorHistory()
    restoreEditorSelection()
    window.document.execCommand(command, false, value)
    markEditorDirty()
    rememberEditorSelection()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, redoEditorChange, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor, undoEditorChange])

  const formatCurrentBlock = useCallback((tag: string) => {
    pushEditorHistory()
    restoreEditorSelection()
    window.document.execCommand('formatBlock', false, tag)
    markEditorDirty()
    rememberEditorSelection()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor])

  const setCurrentBlockDirection = useCallback((direction: 'rtl' | 'ltr') => {
    pushEditorHistory()
    restoreEditorSelection()
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const target = element?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, ol, ul')
    target?.setAttribute('dir', direction)
    markEditorDirty()
    rememberEditorSelection()
    scheduleRefreshDocumentFromEditor()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleRefreshDocumentFromEditor])

  const createLinkForSelection = useCallback(() => {
    const href = window.prompt('آدرس لینک را وارد کنید')
    if (!href?.trim()) return
    execTextCommand('createLink', href.trim())
  }, [execTextCommand])

  const insertSimpleTable = useCallback(() => {
    const tableId = createV2Id('table', Date.now())
    const html = `<table data-block-id="${tableId}" data-v2-type="table"><tbody><tr><td>عنوان</td><td>مقدار</td></tr><tr><td></td><td></td></tr></tbody></table>`
    execTextCommand('insertHTML', html)
  }, [execTextCommand])

  const wrapSelectedCallout = useCallback((variant: (typeof CALLOUT_VARIANTS_V2)[number]) => {
    const targetBlockId = selectedBlockId || selectedBlockIdFromSavedRange()
    if (!targetBlockId) {
      setAiMessage('برای ساخت کال‌اوت، نشانگر را داخل یک پاراگراف بگذارید یا بخشی از متن را انتخاب کنید.')
      setActivePanel('upgrade')
      return
    }
    const meta = CALLOUT_META_V2[variant]
    commitDocument(current => updateBlockInDocumentV2(current, targetBlockId, block => {
      if (block.type === 'callout') return { ...block, variant, title: meta.title, icon: meta.icon }
      if (block.type !== 'paragraph' && block.type !== 'heading') return block
      const paragraph: ParagraphBlockV2 = block.type === 'paragraph'
        ? block
        : { ...block, type: 'paragraph', text: block.text, inline: block.inline, semantic: undefined }
      const callout: CalloutBlockV2 = {
        id: createV2Id('callout', targetBlockId, Date.now()),
        type: 'callout',
        variant,
        title: meta.title,
        icon: meta.icon,
        anchor: createV2Id('callout-anchor', targetBlockId),
        printNumber: block.printNumber,
        blocks: [{ ...paragraph, id: createV2Id('callout-text', targetBlockId), anchor: createV2Id('callout-text-anchor', targetBlockId) }],
      }
      window.setTimeout(() => setSelectedBlockId(callout.id), 0)
      return callout
    }))
  }, [commitDocument, selectedBlockId, selectedBlockIdFromSavedRange])

  const unwrapSelectedCallout = useCallback(() => {
    if (!selectedBlockId) return
    commitDocument(current => updateBlockInDocumentV2(current, selectedBlockId, block => block.type === 'callout' ? block.blocks : block))
    setSelectedBlockId(undefined)
  }, [commitDocument, selectedBlockId])

  const insertImageFromAsset = useCallback((assetId: string) => {
    const asset = document?.assets.find(item => item.id === assetId)
    if (!asset) return
    const block: BookBlockV2 = {
      id: createV2Id('image', asset.id, Date.now()),
      type: 'image',
      url: asset.url,
      caption: asset.caption,
      imageId: asset.id,
      anchor: createV2Id('image-anchor', asset.id, Date.now()),
      printNumber: asset.printNumber,
      status: asset.status,
      issue: asset.issue,
    }
    commitDocument(current => insertBlockAfterV2(current, selectedBlockId, block))
    setSelectedBlockId(block.id)
  }, [commitDocument, document?.assets, selectedBlockId])

  const insertInteractiveBlock = useCallback((kind: string) => {
    const printNumber = selectedBlock?.printNumber
    const block = createInteractiveTemplateV2(kind, printNumber)
    commitDocument(current => insertBlockAfterV2(current, selectedBlockId, block))
    setSelectedBlockId(block.id)
  }, [commitDocument, selectedBlock?.printNumber, selectedBlockId])

  const aiSourceText = useCallback(() => {
    if (!document) return ''
    const selectedText = selectedBlock ? plainTextFromBlockV2(selectedBlock).trim() : ''
    if (selectedText) return selectedText.slice(0, 6000)
    return document.pages
      .flatMap(page => page.blocks)
      .map(plainTextFromBlockV2)
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 6000)
  }, [document, selectedBlock])

  const requestAiEnhance = useCallback(async () => {
    if (!document) return
    const pageText = aiSourceText()
    if (!pageText.trim()) {
      setAiMessage('متنی برای تحلیل پیدا نشد.')
      return
    }
    setAiBusy(true)
    setAiMessage('در حال برآورد هزینه...')
    try {
      const estimate = await estimateAiTextUsage({ action: 'callout_suggestions', bookTitle: document.title, pageText, bookId: document.sourceBookId, user })
      setAiApproval({ usage: estimate.usage, provider: estimate.provider, model: estimate.model, pageText })
      setAiMessage('هزینه برآورد شد؛ برای اجرا تایید کنید.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'برآورد هزینه ناموفق بود.')
    } finally {
      setAiBusy(false)
    }
  }, [aiSourceText, document, user])

  const recordAiUsage = useCallback((usage: RunAiResult['usage']) => {
    const before = Math.max(Number(creditBalance || 0), Number(usage.chargedCredits || 0))
    const after = Math.max(0, before - Number(usage.chargedCredits || 0))
    creditsBus.emit(after)
  }, [creditBalance])

  const runApprovedAi = useCallback(async () => {
    if (!document || !aiApproval) return
    setAiBusy(true)
    setAiMessage('در حال تولید پیشنهاد...')
    try {
      const result = await runAiThroughGateway({ action: 'callout_suggestions', bookTitle: document.title, pageText: aiApproval.pageText, bookId: document.sourceBookId, user })
      const suggestion = result.content?.type === 'callout_suggestions' ? result.content.suggestions?.[0] : null
      const variant = CALLOUT_VARIANTS_V2.includes((suggestion?.variant || '') as any) ? suggestion?.variant as (typeof CALLOUT_VARIANTS_V2)[number] : 'key'
      const meta = CALLOUT_META_V2[variant]
      const paragraph: ParagraphBlockV2 = {
        id: createV2Id('ai-callout-text', Date.now()),
        type: 'paragraph',
        text: normalizeBookTextV2(suggestion?.text || result.text || aiApproval.pageText.slice(0, 600)),
        anchor: createV2Id('ai-callout-text-anchor', Date.now()),
      }
      const callout: CalloutBlockV2 = {
        id: createV2Id('ai-callout', Date.now()),
        type: 'callout',
        variant,
        title: normalizeBookTextV2(suggestion?.title || meta.title),
        icon: meta.icon,
        anchor: createV2Id('ai-callout-anchor', Date.now()),
        printNumber: selectedBlock?.printNumber,
        blocks: [paragraph],
      }
      commitDocument(current => insertBlockAfterV2(current, selectedBlockId, callout))
      setSelectedBlockId(callout.id)
      recordAiUsage(result.usage)
      setAiApproval(null)
      setAiMessage('پیشنهاد هوش مصنوعی به متن اضافه شد.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'تولید پیشنهاد ناموفق بود.')
    } finally {
      setAiBusy(false)
    }
  }, [aiApproval, commitDocument, document, recordAiUsage, selectedBlock?.printNumber, selectedBlockId, user])

  const jumpToToc = useCallback((item: BookTocItemV2) => {
    setActiveTocId(item.id)
    window.setTimeout(() => {
      const target = window.document.getElementById(item.anchor || item.blockId || '')
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else canvasRef.current?.querySelector<HTMLElement>(`[data-page-index="${item.pageIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }, [])

  const scrollToTop = useCallback(() => {
    canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (loading) {
    return (
      <div className="editor-v2-loading">
        <Loader2 className="animate-spin" />
        <span>در حال آماده‌سازی ادیتور جدید...</span>
      </div>
    )
  }

  if (error || !document || !book) {
    return (
      <div className="editor-v2-error menu-glass-70">
        <BookOpen size={32} />
        <h1>{error || 'کتاب پیدا نشد.'}</h1>
        <Button onClick={() => navigate('/publisher/me')}><ArrowRight size={18} />بازگشت به انتشارات</Button>
      </div>
    )
  }

  return (
    <div className="editor-v2-root" dir="rtl">
      <header className="editor-v2-topbar menu-glass-70">
        <div className="editor-v2-title">
          <Button variant="ghost" size="icon" onClick={() => navigate('/publisher/me')} aria-label="بازگشت"><ArrowRight size={19} /></Button>
          {document.coverUrl && <img src={document.coverUrl} alt={document.title} loading="lazy" />}
          <div>
            <small>Editor V2</small>
            <h1>{document.title}</h1>
          </div>
        </div>
        <div className="editor-v2-actions">
          <Button variant="outline" onClick={() => setMetadataOpen(value => !value)}><Info size={17} />مشخصات</Button>
          <Button variant="outline" onClick={() => openReaderPreview(book.id, `/edit-v2/${book.id}`)}><Eye size={17} />پیش‌نمایش</Button>
          <Button className={`editor-v2-manual-save ${saveButtonClass}`} onClick={() => void saveDocument()} disabled={saveState === 'saving'} title={saveButtonTitle}>
            <span className="editor-v2-save-button-icon">
              {visualSaveState === 'saving' ? <Loader2 size={17} /> : <Save size={17} />}
              {visualSaveState === 'saved' && <Check size={10} className="editor-v2-save-button-check" />}
            </span>
            ذخیره دستی
          </Button>
        </div>
      </header>

      {metadataOpen && (
        <section className="editor-v2-metadata menu-glass-70">
          <div><span>نویسنده</span><strong>{document.metadata.author || 'ثبت نشده'}</strong></div>
          <div><span>ناشر</span><strong>{document.metadata.publisherName || 'ثبت نشده'}</strong></div>
          <div><span>نوع کتاب</span><strong>{document.metadata.bookType || 'ثبت نشده'}</strong></div>
          <div><span>دسته‌بندی</span><strong>{document.metadata.category || 'ثبت نشده'}</strong></div>
          <div><span>صفحات</span><strong>{document.pages.length.toLocaleString('fa-IR')}</strong></div>
        </section>
      )}

      <div className="editor-v2-layout">
        <RightPanelV2 document={document} activePanel={activePanel} setActivePanel={setActivePanel} activeTocId={activeTocId} onJumpToToc={jumpToToc} onInsertImage={insertImageFromAsset} onInsertInteractive={insertInteractiveBlock} onApplyCallout={wrapSelectedCallout} onUnwrapCallout={unwrapSelectedCallout} canUnwrapCallout={selectedBlock?.type === 'callout'} onAiEnhance={requestAiEnhance} aiBusy={aiBusy} aiMessage={aiMessage} />
        <main
          className="editor-v2-canvas"
          ref={canvasRef}
          onClick={event => {
            const target = event.target as HTMLElement
            if (target.closest('.editor-v2-paper, .editor-v2-toolbar, [data-block-id]')) return
            setSelectedBlockId(undefined)
          }}
        >
          <section
            className="editor-v2-toolbar menu-glass-70"
            onClick={event => event.stopPropagation()}
            onPointerDownCapture={rememberEditorSelection}
            onMouseDownCapture={rememberEditorSelection}
            onMouseDown={event => {
              if ((event.target as HTMLElement).closest('button')) event.preventDefault()
            }}
          >
            <Button variant="outline" size="icon" onClick={() => execTextCommand('undo')} title="بازگشت"><Undo2 size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('redo')} title="انجام دوباره"><Redo2 size={17} /></Button>
            <span className="editor-v2-toolbar-divider" />
            <Button variant="outline" size="icon" onClick={() => formatCurrentBlock('p')} title="متن عادی"><Type size={17} /></Button>
            <select defaultValue="" onChange={event => { if (event.target.value) formatCurrentBlock(event.target.value); event.target.value = '' }} title="سطح عنوان">
              <option value="" disabled>H</option>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
            </select>
            <select defaultValue="" onChange={event => { if (event.target.value) applyInlineStyleToSelection({ fontFamily: event.target.value }); event.target.value = '' }} title="فونت">
              <option value="" disabled>فونت</option>
              <option value="Vazirmatn">Vazirmatn</option>
              <option value="Tahoma">Tahoma</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times</option>
            </select>
            <select defaultValue="" onChange={event => { if (event.target.value) applyInlineStyleToSelection({ fontSize: FONT_SIZE_MAP_V2[event.target.value] || event.target.value }); event.target.value = '' }} title="اندازه متن">
              <option value="" disabled>اندازه</option>
              <option value="1">خیلی ریز</option>
              <option value="2">ریز</option>
              <option value="3">عادی</option>
              <option value="4">درشت</option>
              <option value="5">خیلی درشت</option>
            </select>
            <label className="editor-v2-color-tool" title="رنگ متن">
              <Palette size={16} />
              <input type="color" defaultValue="#172033" onChange={event => applyInlineStyleToSelection({ color: event.target.value })} />
            </label>
            <span className="editor-v2-toolbar-divider" />
            <Button variant="outline" size="icon" onClick={applyRegularToSelection} title="Regular" aria-pressed={toolbarState.hasSelection && !toolbarState.bold && !toolbarState.italic} className={toolbarState.hasSelection && !toolbarState.bold && !toolbarState.italic ? 'is-active' : undefined}><span className="editor-v2-regular-mark">R</span></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('bold')} title="پررنگ" aria-pressed={toolbarState.bold} className={toolbarState.bold ? 'is-active' : undefined}><Bold size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('italic')} title="مورب" aria-pressed={toolbarState.italic} className={toolbarState.italic ? 'is-active' : undefined}><Italic size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('underline')} title="زیرخط" aria-pressed={toolbarState.underline} className={toolbarState.underline ? 'is-active' : undefined}><UnderlineIcon size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('strikeThrough')} title="خط‌خورده" aria-pressed={toolbarState.strike} className={toolbarState.strike ? 'is-active' : undefined}><Strikethrough size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('superscript')} title="بالانویس" aria-pressed={toolbarState.superscript} className={toolbarState.superscript ? 'is-active' : undefined}><Superscript size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('subscript')} title="زیرنویس" aria-pressed={toolbarState.subscript} className={toolbarState.subscript ? 'is-active' : undefined}><Subscript size={17} /></Button>
            <Button variant="outline" size="icon" onClick={createLinkForSelection} title="لینک"><Link2 size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('removeFormat')} title="پاک کردن فرمت"><Eraser size={17} /></Button>
            <span className="editor-v2-toolbar-divider" />
            <Button variant="outline" size="icon" onClick={() => execTextCommand('insertUnorderedList')} title="فهرست نقطه‌ای"><List size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => execTextCommand('insertOrderedList')} title="فهرست شماره‌ای"><ListOrdered size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => applyBlockAlignment('right')} title="راست‌چین" aria-pressed={toolbarState.alignment === 'right'} className={toolbarState.alignment === 'right' ? 'is-active' : undefined}><AlignRight size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => applyBlockAlignment('center')} title="وسط‌چین" aria-pressed={toolbarState.alignment === 'center'} className={toolbarState.alignment === 'center' ? 'is-active' : undefined}><AlignCenter size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => applyBlockAlignment('left')} title="چپ‌چین" aria-pressed={toolbarState.alignment === 'left'} className={toolbarState.alignment === 'left' ? 'is-active' : undefined}><AlignLeft size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => applyBlockAlignment('justify')} title="تراز کامل" aria-pressed={toolbarState.alignment === 'justify'} className={toolbarState.alignment === 'justify' ? 'is-active' : undefined}><AlignJustify size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentBlockDirection('rtl')} title="جهت راست به چپ"><ArrowRight size={17} /></Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentBlockDirection('ltr')} title="جهت چپ به راست"><ArrowLeft size={17} /></Button>
            <span className="editor-v2-toolbar-divider" />
            <Button variant="outline" size="icon" onClick={insertSimpleTable} title="جدول ساده"><Table2 size={17} /></Button>
          </section>

          <div className="editor-v2-paper">
            <div
              ref={editorSurfaceRef}
              className="editor-v2-flow-editor"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBeforeInput={handleEditorBeforeInput}
              onKeyDown={handleEditorKeyDown}
              onInput={markEditorDirty}
              onMouseUp={updateSelectedBlockFromDom}
              onKeyUp={updateSelectedBlockFromDom}
              onFocus={updateSelectedBlockFromDom}
            />
          </div>
        </main>
      </div>

      <div className="editor-v2-floating">
        <button type="button" onClick={scrollToTop} aria-label="برگشت به ابتدای ادیتور">↑</button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: -window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش قبلی"><ChevronRight size={18} /></button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش بعدی"><ChevronLeft size={18} /></button>
        <button
          type="button"
          className={`editor-v2-floating-save ${saveButtonClass}`}
          onClick={() => void saveDocument()}
          disabled={saveState === 'saving'}
          aria-label={saveButtonTitle}
          title={saveButtonTitle}
        >
          <span className="editor-v2-save-icon">
            {visualSaveState === 'saving' ? <Loader2 size={17} /> : <Save size={17} />}
            {visualSaveState === 'saved' && <Check size={11} className="editor-v2-save-check" />}
          </span>
        </button>
      </div>

      {aiApproval && (
        <div className="editor-v2-modal-backdrop">
          <section className="editor-v2-ai-modal menu-glass-70" role="dialog" aria-modal="true">
            <header>
              <Sparkles size={20} />
              <strong>تایید هزینه هوش مصنوعی</strong>
            </header>
            <p>این عملیات فقط پیشنهاد callout تولید می‌کند و هیچ بخشی از متن اصلی را حذف یا جایگزین نمی‌کند.</p>
            <div className="editor-v2-ai-cost">
              <span><b>{aiApproval.usage.chargedCredits.toLocaleString('fa-IR')}</b><small>کردیت</small></span>
              <span><b>{aiApproval.usage.chargedToman.toLocaleString('fa-IR')}</b><small>تومان</small></span>
              <span><b>${aiApproval.usage.chargedUsd.toFixed(6)}</b><small>دلار</small></span>
            </div>
            <small>{aiApproval.provider} · {aiApproval.model}</small>
            <footer>
              <Button variant="outline" onClick={() => setAiApproval(null)} disabled={aiBusy}>لغو</Button>
              <Button onClick={() => void runApprovedAi()} disabled={aiBusy}>{aiBusy ? 'در حال تولید...' : 'تایید و اجرا'}</Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
