import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, AlertTriangle, ArrowLeft, ArrowRight, Bold, BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eraser, Eye, FileText, Image as ImageIcon, Info, Italic, Link2, List, ListOrdered, ListTree, Loader2, PanelRight, Redo2, Save, Search, Sparkles, Strikethrough, Subscript, Superscript, Table2, Type, Underline as UnderlineIcon, Undo2, Upload, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBook } from '@/lib/book-repository'
import { notifyPublisherBookChanged, updatePublisherBook, type PublisherBook } from '@/lib/publisher-books'
import { openReaderPreview } from '@/lib/app-routes'
import { supabase } from '@/integrations/supabase/client'
import { estimateAiTextUsage, generateAiImageThroughGateway, runAiThroughGateway, type RunAiResult } from '@/lib/ai-gateway'
import { useAuthContext } from '@/lib/auth-context'
import { useCredits } from '@/hooks/useCredits'
import { creditsBus } from '@/lib/credits-bus'
import { buildTocFromHeadingsV2, cleanImageCaptionV2, createV2Id, documentV2ToConfirmedToc, documentV2ToLegacyPages, legacyBookToDocumentV2, normalizeBookTextV2, resolveTocTreeV2, textDirectionV2, tocAsFlatListV2, type BookBlockV2, type BookDocumentV2, type BookInlineV2, type BookTocItemV2, type CalloutBlockV2, type ParagraphBlockV2 } from '@/lib/book-document-v2'
import { backfillPageEngineForBook, isUuidV2, loadPageEngineDocument, savePageEngineDocument } from '@/lib/page-content-engine'
import { bookDisplayTextHtml, isBookLtrRunText, type PrintPageValue } from '@/lib/book-content'
import type { MockBook } from '@/lib/mock-data'
import './editor-v2.css'

type EditorPanelV2 = 'toc' | 'upgrade' | 'media' | 'references' | 'interactive' | 'ai'
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

const EDITOR_V2_AUTOSAVE_DELAY_MS = 60_000

const PANEL_LABELS: Record<EditorPanelV2, { title: string; icon: typeof ListTree }> = {
  toc: { title: 'فهرست', icon: ListTree },
  upgrade: { title: 'ارتقا متن', icon: FileText },
  media: { title: 'رسانه', icon: ImageIcon },
  references: { title: 'ارجاعات', icon: Link2 },
  interactive: { title: 'ابزار تعاملی', icon: PanelRight },
  ai: { title: 'هوش مصنوعی', icon: Sparkles },
}

const CALLOUT_VARIANTS_V2 = ['key', 'question', 'warning', 'quote', 'deep', 'practice', 'glossary', 'data', 'margin'] as const

const TEXT_COLOR_SWATCHES_V2 = [
  { label: 'مشکی', value: '#111827' },
  { label: 'آبی', value: '#2563EB' },
  { label: 'سبز', value: '#16A34A' },
  { label: 'نارنجی', value: '#EA580C' },
  { label: 'قرمز', value: '#DC2626' },
  { label: 'بنفش', value: '#7C3AED' },
] as const

const CALLOUT_META_V2: Record<(typeof CALLOUT_VARIANTS_V2)[number], { title: string; icon: string }> = {
  key: { title: 'نکته کلیدی', icon: '💡' },
  question: { title: 'مکث و فکر کن', icon: '؟' },
  warning: { title: 'اشتباه رایج', icon: '⚠' },
  quote: { title: 'جمله طلایی', icon: '❝' },
  deep: { title: 'عمیق‌تر بخوان', icon: '🔍' },
  practice: { title: 'تمرین سریع', icon: '✓' },
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

function imageFigureStyleAttrV2(width: string) {
  const declarations = [
    width ? `--editor-v2-image-width:${escapeHtmlV2(width)}` : '',
  ].filter(Boolean)
  return declarations.length ? ` style="${declarations.join(';')}"` : ''
}

function normalizeCaptionElementV2(caption: HTMLElement | null | undefined) {
  if (!caption) return
  caption.dataset.imageCaption = 'true'
  if (!caption.dataset.placeholder) caption.dataset.placeholder = 'کپشن تصویر را اینجا بنویسید'
  const text = normalizeBookTextV2(caption.innerText || caption.textContent || '')
  if (text) {
    caption.dataset.captionEmpty = 'false'
    return
  }
  caption.innerHTML = ''
  caption.dataset.captionEmpty = 'true'
}

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

function canJoinLtrEditorRunV2(span: BookInlineV2) {
  if (span.href || span.imageRefId || span.footnoteId || span.footnoteText || span.referenceText || span.referenceAnchor) return false
  return isBookLtrRunText(span.text || '')
}

function isEditorInlineWhitespaceV2(span: BookInlineV2) {
  return !span.href
    && !span.imageRefId
    && !span.footnoteId
    && !span.footnoteText
    && !span.referenceText
    && !span.referenceAnchor
    && !span.marks?.length
    && /^\s+$/.test(normalizeBookTextV2(span.text || ''))
}

function nextNonSpaceEditorInlineV2(inline: BookInlineV2[], startIndex: number) {
  return inline.slice(startIndex).find(span => !isEditorInlineWhitespaceV2(span))
}

function groupEditorInlineRunsV2(inline: BookInlineV2[]) {
  const groups: Array<{ ltr: boolean; spans: BookInlineV2[] }> = []
  let current: BookInlineV2[] = []

  const flush = (ltr = false) => {
    if (!current.length) return
    groups.push({ ltr, spans: current })
    current = []
  }

  inline.forEach((span, index) => {
    const joins = canJoinLtrEditorRunV2(span)
    const nextNonSpace = nextNonSpaceEditorInlineV2(inline, index + 1)
    const joinsAsSpace = isEditorInlineWhitespaceV2(span) && current.length && Boolean(nextNonSpace && canJoinLtrEditorRunV2(nextNonSpace))
    if (joins || joinsAsSpace) {
      current.push(span)
      return
    }
    flush(true)
    groups.push({ ltr: false, spans: [span] })
  })
  flush(true)
  return groups
}

function editorInlineSpanHtmlV2(span: BookInlineV2, isolated = false) {
  let html = isolated ? escapeHtmlV2(normalizeBookTextV2(span.text)) : bookDisplayTextHtml(span.text)
  const marks = span.marks || []
  if (marks.includes('subscript')) html = `<sub>${html}</sub>`
  if (marks.includes('superscript')) html = `<sup>${html}</sup>`
  if (marks.includes('bold')) html = `<strong>${html}</strong>`
  if (marks.includes('italic')) html = `<em>${html}</em>`
  if (marks.includes('underline')) html = `<u>${html}</u>`
  if (marks.includes('strike')) html = `<s>${html}</s>`
  if (span.style) html = `<span${styleAttrFromInlineV2(span.style)}>${html}</span>`
  if (span.href) html = `<a href="${escapeHtmlV2(span.href)}">${html}</a>`
  if (span.imageRefId) html = `<span class="book-image-reference editor-v2-image-reference" data-image-ref-id="${escapeHtmlV2(span.imageRefId)}">${html}</span>`
  if (span.footnoteText || span.referenceText || span.footnoteId) {
    const noteText = normalizeBookTextV2(span.footnoteText || span.referenceText || '')
    const dir = textDirectionV2(noteText || span.text)
    html = `<span${citationAttrsV2(span)} dir="${dir}">${html}${noteText ? `<span contenteditable="false" class="citation-tooltip" dir="${dir}">${escapeHtmlV2(noteText)}</span>` : ''}</span>`
  }
  return html
}

function inlineSpansToEditorHtmlV2(inline?: BookInlineV2[], fallback = '') {
  if (!inline?.length) return bookDisplayTextHtml(fallback)
  return groupEditorInlineRunsV2(inline).map(group => {
    const html = group.spans.map(span => editorInlineSpanHtmlV2(span, group.ltr)).join('')
    return group.ltr ? `<bdi class="book-ltr-inline-run" dir="ltr">${html}</bdi>` : html
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
    const cleanCaption = cleanImageCaptionV2(block.caption)
    const width = block.widthPercent ? `${Math.max(12, Math.min(100, block.widthPercent))}%` : block.widthPx ? `${Math.max(80, block.widthPx)}px` : ''
    const sizePercent = Math.round(block.widthPercent ? Math.max(5, Math.min(100, block.widthPercent)) : 100)
    const autoSize = block.widthPercent ? 'false' : 'true'
    return `<figure data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="image"${attrV2('data-image-id', block.imageId)}${attrV2('data-auto-caption', block.autoCaption ? 'true' : undefined)}${attrV2('data-width-px', block.widthPx)}${attrV2('data-width-percent', block.widthPercent)}${attrV2('data-image-size-auto', autoSize)}${imageFigureStyleAttrV2(width)}><div class="editor-v2-image-controls" contenteditable="false"><button type="button" data-image-delete="true" title="حذف تصویر" aria-label="حذف تصویر">×</button></div>${block.url ? `<img contenteditable="false" src="${escapeHtmlV2(block.url)}" alt="${escapeHtmlV2(cleanCaption)}">` : '<div class="book-v2-missing-image" contenteditable="false">تصویر در دسترس نیست</div>'}<div class="editor-v2-image-size-control" contenteditable="false"><span>درصد از عرض متن</span><input type="range" min="5" max="100" step="1" value="${sizePercent}" data-image-size-range="true" aria-label="درصد اشغال عرض متن توسط تصویر"><b data-image-size-value="true">${sizePercent}%</b></div><figcaption contenteditable="true" data-image-caption="true"${attrV2('data-auto-caption', block.autoCaption ? 'true' : undefined)} data-placeholder="کپشن تصویر را اینجا بنویسید" data-caption-empty="${cleanCaption ? 'false' : 'true'}">${cleanCaption ? inlineSpansToEditorHtmlV2(block.captionInline, cleanCaption) : ''}</figcaption></figure>`
  }
  if (block.type === 'table') {
    const headers = block.headers?.length ? `<thead><tr>${block.headers.map(cell => `<th>${escapeHtmlV2(cell)}</th>`).join('')}</tr></thead>` : ''
    const rows = block.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtmlV2(cell)}</td>`).join('')}</tr>`).join('')
    return `<div contenteditable="false" class="final-table book-v2-table" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="table">${block.caption ? `<p class="reader-table-title">${escapeHtmlV2(block.caption)}</p>` : ''}<table>${headers}<tbody>${rows}</tbody></table></div>`
  }
  if (block.type === 'callout') {
    const body = block.blocks.map(blockToEditorHtmlV2).join('')
    const direction = block.direction || textDirectionV2(block.blocks.map(plainTextFromBlockV2).join(' '))
    return `<section class="book-callout editor-v2-callout has-rendered-title callout-${escapeHtmlV2(block.variant)}" data-block-id="${escapeHtmlV2(block.id)}" data-v2-type="callout" data-variant="${escapeHtmlV2(block.variant)}" data-callout-variant="${escapeHtmlV2(block.variant)}" data-callout-title="${escapeHtmlV2(block.title)}" data-callout-icon="${escapeHtmlV2(block.icon || '')}"${attrV2('dir', direction)}><button type="button" class="book-callout-unwrap editor-v2-callout-unwrap" contenteditable="false" data-callout-unwrap="true" aria-label="Unwrap callout">×</button><div class="book-callout-head"><span class="book-callout-icon" contenteditable="false">${escapeHtmlV2(block.icon || '')}</span><strong class="book-callout-title" contenteditable="true" data-callout-title-editor="true">${escapeHtmlV2(block.title)}</strong></div><div class="book-callout-bg-icon" contenteditable="false">${escapeHtmlV2(block.icon || '')}</div><div class="book-callout-content">${body}</div></section>`
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
      ? pageBreakHtmlV2(page, index)
      : ''
    return `<section class="editor-v2-flow-page" data-page-index="${page.index}"${attrV2('data-print-page', page.printNumber)}>${pageBreak}${page.blocks.map(blockToEditorHtmlV2).join('')}</section>`
  }).join('')
}

function pageBreakHtmlV2(page: BookDocumentV2['pages'][number], index: number) {
  const label = String(page.printNumber ?? index + 1)
  return `<div contenteditable="false" draggable="false" role="separator" aria-label="صفحه چاپی ${escapeHtmlV2(label)}" class="editor-v2-flow-page-break" data-page-break="true" data-locked-page-break="true"><span contenteditable="false">${escapeHtmlV2(label)}</span></div>`
}

function createPageBreakElementV2(page: BookDocumentV2['pages'][number], index: number) {
  const template = window.document.createElement('template')
  template.innerHTML = pageBreakHtmlV2(page, index)
  return template.content.firstElementChild as HTMLElement
}

function normalizePageBreakElementV2(element: HTMLElement, page: BookDocumentV2['pages'][number], index: number) {
  const label = String(page.printNumber ?? index + 1)
  element.className = 'editor-v2-flow-page-break'
  element.dataset.pageBreak = 'true'
  element.dataset.lockedPageBreak = 'true'
  element.contentEditable = 'false'
  element.draggable = false
  element.setAttribute('role', 'separator')
  element.setAttribute('aria-label', `صفحه چاپی ${label}`)
  let span = element.querySelector('span')
  if (!span) {
    span = window.document.createElement('span')
    element.innerHTML = ''
    element.appendChild(span)
  }
  span.contentEditable = 'false'
  span.textContent = label
}

function restoreEditorPageBreaksV2(bookDocument: BookDocumentV2, root: HTMLElement | null) {
  if (!root) return false
  let changed = false
  bookDocument.pages.forEach((page, pageIndex) => {
    const pageElement = root.querySelector<HTMLElement>(`.editor-v2-flow-page[data-page-index="${page.index}"]`) || root.querySelectorAll<HTMLElement>('.editor-v2-flow-page')[pageIndex]
    if (!pageElement || pageIndex === 0) return
    const pageBreaks = Array.from(pageElement.querySelectorAll<HTMLElement>(':scope > [data-page-break="true"], :scope > .editor-v2-flow-page-break'))
    let pageBreak = pageBreaks[0]
    if (!pageBreak) {
      pageBreak = createPageBreakElementV2(page, pageIndex)
      pageElement.insertBefore(pageBreak, pageElement.firstChild)
      changed = true
    }
    normalizePageBreakElementV2(pageBreak, page, pageIndex)
    if (pageElement.firstElementChild !== pageBreak) {
      pageElement.insertBefore(pageBreak, pageElement.firstChild)
      changed = true
    }
    pageBreaks.slice(1).forEach(extra => {
      extra.remove()
      changed = true
    })
  })
  return changed
}

function selectionTouchesLockedPageBreakV2(root: HTMLElement | null, selection = window.getSelection()) {
  if (!root || !selection?.rangeCount) return false
  const pageBreaks = Array.from(root.querySelectorAll<HTMLElement>('[data-locked-page-break="true"], [data-page-break="true"], .editor-v2-flow-page-break'))
  if (!pageBreaks.length) return false
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (element?.closest('[data-locked-page-break="true"], [data-page-break="true"], .editor-v2-flow-page-break')) return true
    for (const pageBreak of pageBreaks) {
      try {
        if (range.intersectsNode(pageBreak)) return true
      } catch {
        // Some browser/range combinations can throw on detached nodes.
      }
    }
  }
  return false
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

function inlineFromDomV2(node: Node, marks: BookInlineV2['marks'] = [], href?: string, inheritedStyle: BookInlineV2['style'] = {}, imageRefId?: string): BookInlineV2[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeBookTextV2(node.textContent || '')
    const style = Object.keys(inheritedStyle || {}).length ? { ...inheritedStyle } : undefined
    return text ? [{ text, marks: marks.length ? [...marks] : undefined, href, imageRefId, style }] : []
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
  const nextImageRefId = (node as HTMLElement).dataset.imageRefId || imageRefId
  const nextStyle = mergeInlineStyleFromElementV2(node, inheritedStyle)
  const footnoteText = normalizeBookTextV2((node as HTMLElement).dataset.footnoteText || '')
  const referenceText = normalizeBookTextV2((node as HTMLElement).dataset.referenceText || '')
  const footnoteId = (node as HTMLElement).dataset.footnoteId
  const referenceAnchor = (node as HTMLElement).dataset.referenceAnchor
  const children = Array.from(node.childNodes).flatMap(child => inlineFromDomV2(child, nextMarks, nextHref, nextStyle, nextImageRefId))
  if (!footnoteText && !referenceText && !footnoteId && !referenceAnchor && !nextImageRefId) return children
  if (children.length) {
    return children.map((span, index) => index === 0
      ? { ...span, imageRefId: nextImageRefId, footnoteId, footnoteText: footnoteText || undefined, referenceAnchor, referenceText: referenceText || undefined }
      : span)
  }
  return [{ text: footnoteId || referenceAnchor || '', marks: nextMarks.length ? nextMarks : undefined, href: nextHref, imageRefId: nextImageRefId, style: Object.keys(nextStyle || {}).length ? nextStyle : undefined, footnoteId, footnoteText: footnoteText || undefined, referenceAnchor, referenceText: referenceText || undefined }]
}

function inlineFromElementV2(element: Element) {
  const inline = Array.from(element.childNodes).flatMap(child => inlineFromDomV2(child))
  return inline.length ? inline : undefined
}

function textFromElementV2(element: Element) {
  const inline = inlineFromElementV2(element)
  return inline?.map(span => span.text).join('') || normalizeBookTextV2((element as HTMLElement).innerText || element.textContent || '')
}

function isAutoCaptionCandidateTextV2(value: string) {
  const text = normalizeBookTextV2(value)
    .replace(/^[\s\u200c\u200d\u200f\u202a-\u202e:：،,؛.;\-–—()（）[\]]+/g, '')
    .trim()
    .toLowerCase()
  return text.startsWith('شکل')
    || text.startsWith('تصویر')
    || text.startsWith('figure')
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
  if (v2Type === 'callout') {
    const variant = html.dataset.calloutVariant || html.dataset.variant || (old?.type === 'callout' ? old.variant : 'key')
    const meta = CALLOUT_META_V2[(CALLOUT_VARIANTS_V2.includes(variant as any) ? variant : 'key') as (typeof CALLOUT_VARIANTS_V2)[number]]
    const titleElement = element.querySelector<HTMLElement>(':scope > .book-callout-head [data-callout-title-editor], :scope > .book-callout-head strong')
    const title = normalizeBookTextV2(titleElement?.innerText || html.dataset.calloutTitle || (old?.type === 'callout' ? old.title : meta.title))
    const icon = html.dataset.calloutIcon || (old?.type === 'callout' ? old.icon : meta.icon)
    const contentElement = element.querySelector<HTMLElement>(':scope > .book-callout-content')
    const direction = (html.getAttribute('dir') === 'ltr' || html.getAttribute('dir') === 'rtl')
      ? html.getAttribute('dir') as 'ltr' | 'rtl'
      : old?.type === 'callout'
        ? old.direction
        : textDirectionV2(contentElement?.innerText || title)
    const contentNodes = contentElement ? Array.from(contentElement.childNodes) : Array.from(element.childNodes).filter(node => {
      if (!(node instanceof Element)) return true
      return !node.classList.contains('book-callout-head')
        && !node.classList.contains('book-callout-bg-icon')
        && !node.matches('[data-callout-unwrap]')
    })
    const blocks = editorNodesToBlocksV2(contentNodes, page, existing)
    const fallbackBlocks = old?.type === 'callout' ? old.blocks : []
    return {
      ...(old?.type === 'callout' ? old : {}),
      id,
      type: 'callout',
      variant: (CALLOUT_VARIANTS_V2.includes(variant as any) ? variant : 'key') as (typeof CALLOUT_VARIANTS_V2)[number],
      title,
      icon,
      anchor: old?.anchor || id,
      printNumber: page.printNumber,
      direction,
      blocks: blocks.length ? blocks : fallbackBlocks,
    } as CalloutBlockV2
  }
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
    const captionElement = element.querySelector<HTMLElement>('figcaption[data-image-caption], figcaption')
    normalizeCaptionElementV2(captionElement)
    const rawCaption = captionElement ? textFromElementV2(captionElement) : ''
    const caption = cleanImageCaptionV2(rawCaption)
    const captionInline = caption && captionElement ? inlineFromElementV2(captionElement) : undefined
    return {
      ...(old && old.type === 'image' ? old : {}),
      id,
      type: 'image',
      url: image?.getAttribute('src') || (old?.type === 'image' ? old.url : ''),
      caption,
      captionInline,
      autoCaption: html.dataset.autoCaption === 'true' || captionElement?.getAttribute('data-auto-caption') === 'true' || (old?.type === 'image' ? old.autoCaption : undefined),
      imageId: (element as HTMLElement).dataset.imageId || (old?.type === 'image' ? old.imageId : undefined),
      widthPx: Number((element as HTMLElement).dataset.widthPx) || (old?.type === 'image' ? old.widthPx : undefined),
      widthPercent: Number((element as HTMLElement).dataset.widthPercent) || (old?.type === 'image' ? old.widthPercent : undefined),
      anchor: old?.anchor || id,
      printNumber: page.printNumber,
      status: old?.type === 'image' ? old.status : undefined,
      issue: old?.type === 'image' ? old.issue : undefined,
    } as BookBlockV2
  }
  if (old) return old
  return null
}

function looseInlineNodeV2(node: ChildNode) {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(normalizeBookTextV2(node.textContent || ''))
  return node instanceof Element && inlineOnlyElementV2(node)
}

function looseInlineNodesToParagraphV2(nodes: ChildNode[], page: BookDocumentV2['pages'][number], index: number, existing: Map<string, BookBlockV2>): ParagraphBlockV2 | null {
  const inline = nodes.flatMap(node => inlineFromDomV2(node))
  const text = inline.map(span => span.text).join('')
  if (!text) return null
  const blockIdElement = nodes.find((node): node is Element => node instanceof Element && Boolean((node as HTMLElement).dataset.blockId))
  const id = blockIdElement ? (blockIdElement as HTMLElement).dataset.blockId || createV2Id('paragraph', page.index, index, Date.now()) : createV2Id('paragraph', page.index, index, Date.now())
  const old = existing.get(id)
  const directionElement = nodes.find((node): node is Element => node instanceof Element && Boolean(node.getAttribute('dir')))
  return {
    ...(old && old.type === 'paragraph' ? old : {}),
    id,
    type: 'paragraph',
    text,
    inline,
    anchor: old?.anchor || id,
    printNumber: page.printNumber,
    direction: (directionElement?.getAttribute('dir') as any) || old?.direction,
  }
}

function editorNodeToBlockV2(node: ChildNode, page: BookDocumentV2['pages'][number], index: number, existing: Map<string, BookBlockV2>): BookBlockV2 | null {
  if (node instanceof Element) return elementToBlockV2(node, page, index, existing)
  return null
}

function editorNodesToBlocksV2(nodes: ChildNode[], page: BookDocumentV2['pages'][number], existing: Map<string, BookBlockV2>): BookBlockV2[] {
  const blocks: BookBlockV2[] = []
  let inlineBuffer: ChildNode[] = []
  const flushInline = (index: number) => {
    if (!inlineBuffer.length) return
    const paragraph = looseInlineNodesToParagraphV2(inlineBuffer, page, index, existing)
    if (paragraph) blocks.push(paragraph)
    inlineBuffer = []
  }
  nodes.forEach((node, index) => {
    if (looseInlineNodeV2(node)) {
      inlineBuffer.push(node)
      return
    }
    if (node.nodeType === Node.TEXT_NODE) return
    flushInline(index)
    const block = editorNodeToBlockV2(node, page, index, existing)
    if (block) blocks.push(block)
  })
  flushInline(nodes.length)
  return blocks
}

function documentFromEditorDomV2(bookDocument: BookDocumentV2, root: HTMLElement | null): BookDocumentV2 {
  if (!root) return bookDocument
  restoreEditorPageBreaksV2(bookDocument, root)
  const existing = existingBlocksV2(bookDocument)
  const pages = bookDocument.pages.map((page, pageIndex) => {
    const pageElement = root.querySelector<HTMLElement>(`.editor-v2-flow-page[data-page-index="${page.index}"]`) || root.querySelectorAll<HTMLElement>('.editor-v2-flow-page')[pageIndex]
    if (!pageElement) return page
    const blocks = editorNodesToBlocksV2(Array.from(pageElement.childNodes), page, existing)
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

function findBlockPageIndexV2(document: BookDocumentV2 | null | undefined, id?: string) {
  if (!document || !id) return undefined
  for (const page of document.pages) {
    if (findBlockV2(page.blocks, id)) return page.index
  }
  return undefined
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

type EditorMediaReferenceV2 = {
  key: string
  assetId?: string
  blockId?: string
  url: string
  caption?: string
  autoCaption?: boolean
  printNumber?: PrintPageValue
  status?: Extract<BookBlockV2, { type: 'image' }>['status']
  issue?: string
  needsCheck: boolean
  source: 'asset' | 'block'
  distance: number
}

type EditorInlineReferenceV2 = {
  key: string
  type: 'link' | 'footnote' | 'reference' | 'image'
  label: string
  text: string
  target?: string
  blockId?: string
  printNumber?: PrintPageValue
}

function printNumberDistanceV2(value: PrintPageValue | undefined, selected: PrintPageValue | undefined) {
  const a = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  const b = Number(String(selected ?? '').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 9999
  return Math.abs(a - b)
}

function collectMediaReferencesV2(document: BookDocumentV2, selectedPrintNumber?: PrintPageValue): EditorMediaReferenceV2[] {
  const assetMap = new Map(document.assets.map(asset => [asset.id, asset]))
  const refs: EditorMediaReferenceV2[] = []
  const seenAssetIds = new Set<string>()
  const pushImageBlock = (block: Extract<BookBlockV2, { type: 'image' }>) => {
    const asset = block.imageId ? assetMap.get(block.imageId) : undefined
    if (block.imageId) seenAssetIds.add(block.imageId)
    const caption = block.caption || asset?.caption || ''
    const status = block.status || asset?.status
    const issue = block.issue || asset?.issue
    refs.push({
      key: `block-${block.id}`,
      assetId: block.imageId,
      blockId: block.id,
      url: block.url || asset?.url || '',
      caption,
      autoCaption: block.autoCaption,
      printNumber: block.printNumber || asset?.printNumber,
      status,
      issue,
      needsCheck: !caption.trim() || Boolean(issue) || ['missing', 'needs-conversion', 'error'].includes(String(status || '')),
      source: 'block',
      distance: printNumberDistanceV2(block.printNumber || asset?.printNumber, selectedPrintNumber),
    })
  }
  const visit = (blocks: BookBlockV2[]) => {
    blocks.forEach(block => {
      if (block.type === 'image') pushImageBlock(block)
      if (block.type === 'callout') visit(block.blocks)
    })
  }
  document.pages.forEach(page => visit(page.blocks))
  document.assets.forEach(asset => {
    if (seenAssetIds.has(asset.id)) return
    const caption = asset.caption || ''
    refs.push({
      key: `asset-${asset.id}`,
      assetId: asset.id,
      url: asset.url,
      caption,
      printNumber: asset.printNumber,
      status: asset.status,
      issue: asset.issue,
      needsCheck: !caption.trim() || Boolean(asset.issue) || ['missing', 'needs-conversion', 'error'].includes(String(asset.status || '')),
      source: 'asset',
      distance: printNumberDistanceV2(asset.printNumber, selectedPrintNumber),
    })
  })
  return refs.sort((a, b) => a.distance - b.distance || Number(b.needsCheck) - Number(a.needsCheck) || String(a.printNumber || '').localeCompare(String(b.printNumber || ''), 'fa'))
}

function collectInlineReferencesV2(document: BookDocumentV2): EditorInlineReferenceV2[] {
  const refs: EditorInlineReferenceV2[] = []
  const visitInline = (inline: BookInlineV2[] | undefined, blockId: string, printNumber?: PrintPageValue) => {
    inline?.forEach((span, index) => {
      const text = normalizeBookTextV2(span.text || span.footnoteId || span.referenceAnchor || '')
      if (span.href) {
        refs.push({ key: `${blockId}-link-${index}`, type: 'link', label: 'لینک', text, target: span.href, blockId, printNumber })
      }
      if (span.footnoteId || span.footnoteText) {
        refs.push({ key: `${blockId}-footnote-${index}`, type: 'footnote', label: `پاورقی ${span.footnoteId || ''}`.trim(), text, target: span.footnoteText, blockId, printNumber })
      }
      if (span.referenceText || span.referenceAnchor) {
        refs.push({ key: `${blockId}-reference-${index}`, type: 'reference', label: 'رفرنس', text, target: span.referenceText || span.referenceAnchor, blockId, printNumber })
      }
      if (span.imageRefId) {
        refs.push({ key: `${blockId}-image-${index}`, type: 'image', label: 'اتصال به تصویر', text, target: span.imageRefId, blockId, printNumber })
      }
    })
  }
  const visitBlocks = (blocks: BookBlockV2[], printNumber?: PrintPageValue) => {
    blocks.forEach(block => {
      if (block.type === 'paragraph' || block.type === 'heading') visitInline(block.inline, block.id, block.printNumber || printNumber)
      if (block.type === 'list') block.items.forEach((item, index) => visitInline(item.inline, `${block.id}-item-${index}`, block.printNumber || printNumber))
      if (block.type === 'image') visitInline(block.captionInline, block.id, block.printNumber || printNumber)
      if (block.type === 'callout') visitBlocks(block.blocks, block.printNumber || printNumber)
    })
  }
  document.pages.forEach(page => visitBlocks(page.blocks, page.printNumber))
  return refs
}

function fileToDataUrlV2(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('خواندن فایل ناموفق بود.'))
    reader.readAsDataURL(file)
  })
}

function extensionFromImageFileV2(file: File) {
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('svg')) return 'svg'
  return 'jpg'
}

async function uploadEditorImageFileV2(userId: string | undefined, bookId: string, assetId: string, file: File) {
  if (!userId || !isUuidV2(bookId) || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
    return fileToDataUrlV2(file)
  }
  const safeAssetId = assetId.replace(/[^\w.-]+/g, '-')
  const path = `${userId}/editor-v2/${bookId}/${safeAssetId}.${extensionFromImageFileV2(file)}`
  const storage = (supabase as any).storage.from('book-imports')
  const uploaded = await storage.upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (uploaded.error) throw uploaded.error
  const signed = await storage.createSignedUrl(path, 60 * 60 * 24 * 365)
  if (signed.error) throw signed.error
  return signed.data?.signedUrl || fileToDataUrlV2(file)
}

const isUuid = isUuidV2

function formatAutosaveCountdownV2(value: number | null) {
  if (value === null) return ''
  const seconds = Math.max(0, Math.ceil(value))
  return seconds.toLocaleString('fa-IR', { useGrouping: false })
}

function jsonBytesV2(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? null)).length
  } catch {
    return 0
  }
}

function formatBytesV2(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  if (value < 1024) return `${Math.round(value).toLocaleString('en-US')} B`
  const kb = value / 1024
  if (kb < 1024) return `${kb.toLocaleString('en-US', { maximumFractionDigits: 1 })} KB`
  return `${(kb / 1024).toLocaleString('en-US', { maximumFractionDigits: 2 })} MB`
}

function formatMsV2(value: number) {
  if (!Number.isFinite(value)) return 'unknown'
  if (value < 1000) return `${Math.round(value).toLocaleString('en-US')} ms`
  return `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} s`
}

function showSaveTrafficToastV2(report: {
  mode: 'supabase' | 'supabase/page-engine' | 'local'
  manual?: boolean
  totalMs: number
  networkMs: number
  requestBytes: number
  responseBytes: number
}) {
  const title = report.mode === 'supabase' || report.mode === 'supabase/page-engine'
    ? `${report.manual ? 'Manual' : 'Auto'} save traffic report`
    : 'Local save report'
  const description = report.mode === 'supabase' || report.mode === 'supabase/page-engine'
    ? [
        `• Storage mode: ${report.mode === 'supabase/page-engine' ? 'page-based content engine' : 'legacy full book row'}`,
        `• Supabase time: ${formatMsV2(report.networkMs)}`,
        `• Total save time: ${formatMsV2(report.totalMs)}`,
        `• Upload payload: ${formatBytesV2(report.requestBytes)}`,
        `• Supabase response egress: ${formatBytesV2(report.responseBytes)}`,
        `• Approx. total traffic: ${formatBytesV2(report.requestBytes + report.responseBytes)}`,
      ].join('\n')
    : [
        `• Total save time: ${formatMsV2(report.totalMs)}`,
        `• Prepared payload size: ${formatBytesV2(report.requestBytes)}`,
        '• Saved locally; no Supabase egress was used.',
      ].join('\n')
  toast.info(title, { description, duration: 20_000 })
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

type TextToolbarV2Props = {
  toolbarState: TextToolbarStateV2
  rememberEditorSelection: () => void
  execTextCommand: (command: string, value?: string) => void
  formatCurrentBlock: (tag: string) => void
  applyInlineStyleToSelection: (style: Partial<CSSStyleDeclaration>) => boolean
  applyRegularToSelection: () => void
  applyBlockAlignment: (alignment: 'left' | 'right' | 'center' | 'justify') => void
  setCurrentBlockDirection: (direction: 'rtl' | 'ltr') => void
  createLinkForSelection: () => void
  insertSimpleTable: () => void
  onPreview: () => void
}

function TextToolbarV2({
  toolbarState,
  rememberEditorSelection,
  execTextCommand,
  formatCurrentBlock,
  applyInlineStyleToSelection,
  applyRegularToSelection,
  applyBlockAlignment,
  setCurrentBlockDirection,
  createLinkForSelection,
  insertSimpleTable,
  onPreview,
}: TextToolbarV2Props) {
  return (
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
        <option value="p">متن عادی</option>
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
      <div className="editor-v2-color-swatches" role="group" aria-label="رنگ متن">
        {TEXT_COLOR_SWATCHES_V2.map(color => (
          <button
            key={color.value}
            type="button"
            className="editor-v2-color-swatch"
            style={{ '--swatch-color': color.value } as CSSProperties}
            title={`رنگ متن: ${color.label}`}
            aria-label={`رنگ متن: ${color.label}`}
            onMouseDown={event => {
              event.preventDefault()
              rememberEditorSelection()
            }}
            onClick={() => applyInlineStyleToSelection({ color: color.value })}
          />
        ))}
      </div>
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
      <Button variant="outline" size="icon" onClick={() => setCurrentBlockDirection('rtl')} title="جهت راست به چپ"><ArrowLeft size={17} /></Button>
      <Button variant="outline" size="icon" onClick={() => setCurrentBlockDirection('ltr')} title="جهت چپ به راست"><ArrowRight size={17} /></Button>
      <span className="editor-v2-toolbar-divider" />
      <Button variant="outline" size="icon" onClick={insertSimpleTable} title="جدول ساده"><Table2 size={17} /></Button>
      <span className="editor-v2-toolbar-divider" />
      <Button variant="outline" size="icon" onClick={onPreview} title="پیش‌نمایش"><Eye size={17} /></Button>
    </section>
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
  selectedBlock,
  activePanel,
  setActivePanel,
  activeTocId,
  onJumpToToc,
  onInsertImage,
  onUploadImage,
  onGenerateImage,
  onAutoCaption,
  mediaMessage,
  onResolveMediaIssue,
  onJumpToBlock,
  canLinkImageRef,
  onLinkImageRef,
  onApplyTextLink,
  onRemoveTextLink,
  onInsertInteractive,
  onApplyCallout,
  onUnwrapCallout,
  canUnwrapCallout,
  onAiEnhance,
  aiBusy,
  aiMessage,
}: {
  document: BookDocumentV2
  selectedBlock?: BookBlockV2 | null
  activePanel: EditorPanelV2
  setActivePanel: (panel: EditorPanelV2) => void
  activeTocId?: string
  onJumpToToc: (item: BookTocItemV2) => void
  onInsertImage: (assetId: string) => void
  onUploadImage: (file: File) => void
  onGenerateImage: (prompt: string) => void
  onAutoCaption: () => void
  mediaMessage: string
  onResolveMediaIssue: (ref: EditorMediaReferenceV2) => void
  onJumpToBlock: (blockId: string) => void
  canLinkImageRef: boolean
  onLinkImageRef: (ref: EditorMediaReferenceV2) => void
  onApplyTextLink: (href: string) => boolean
  onRemoveTextLink: () => boolean
  onInsertInteractive: (kind: string) => void
  onApplyCallout: (variant: (typeof CALLOUT_VARIANTS_V2)[number]) => void
  onUnwrapCallout: () => void
  canUnwrapCallout: boolean
  onAiEnhance: () => void
  aiBusy: boolean
  aiMessage: string
}) {
  const tree = useMemo(() => resolveTocTreeV2(document.toc), [document.toc])
  const selectedPrintNumber = selectedBlock?.printNumber
  const mediaRefs = useMemo(() => collectMediaReferencesV2(document), [document])
  const libraryMediaRefs = useMemo(() => collectMediaReferencesV2(document, selectedPrintNumber), [document, selectedPrintNumber])
  const inlineRefs = useMemo(() => collectInlineReferencesV2(document), [document])
  const mediaIssueCount = mediaRefs.filter(item => item.needsCheck).length
  const [mediaQuery, setMediaQuery] = useState('')
  const [referenceQuery, setReferenceQuery] = useState('')
  const [linkHref, setLinkHref] = useState('')
  const [referenceMessage, setReferenceMessage] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const filteredMediaRefs = useMemo(() => {
    const query = normalizeBookTextV2(mediaQuery).toLowerCase()
    return mediaRefs.filter(item => {
      if (!query) return true
      return normalizeBookTextV2(`${item.caption || ''} ${item.issue || ''} ${item.printNumber || ''}`).toLowerCase().includes(query)
    })
  }, [mediaRefs, mediaQuery])
  const filteredLibraryMediaRefs = useMemo(() => {
    const query = normalizeBookTextV2(mediaQuery).toLowerCase()
    return libraryMediaRefs.filter(item => {
      if (!query) return true
      return normalizeBookTextV2(`${item.caption || ''} ${item.issue || ''} ${item.printNumber || ''}`).toLowerCase().includes(query)
    })
  }, [libraryMediaRefs, mediaQuery])
  const filteredReferenceMediaRefs = useMemo(() => {
    const query = normalizeBookTextV2(referenceQuery).toLowerCase()
    return libraryMediaRefs.filter(item => {
      if (!query) return true
      return normalizeBookTextV2(`${item.caption || ''} ${item.issue || ''} ${item.printNumber || ''}`).toLowerCase().includes(query)
    })
  }, [libraryMediaRefs, referenceQuery])
  const filteredInlineRefs = useMemo(() => {
    const query = normalizeBookTextV2(referenceQuery).toLowerCase()
    return inlineRefs.filter(item => {
      if (!query) return true
      return normalizeBookTextV2(`${item.label} ${item.text} ${item.target || ''} ${item.printNumber || ''}`).toLowerCase().includes(query)
    })
  }, [inlineRefs, referenceQuery])
  const nearestMediaRef = useMemo(() => {
    if (!canLinkImageRef) return undefined
    return libraryMediaRefs.find(item => item.url && (item.blockId || item.assetId))
      || mediaRefs.find(item => item.url && (item.blockId || item.assetId))
  }, [canLinkImageRef, libraryMediaRefs, mediaRefs])
  useEffect(() => {
    if (activePanel !== 'references' || !canLinkImageRef || !nearestMediaRef) return
    const handle = window.setTimeout(() => {
      const safeKey = CSS.escape(nearestMediaRef.key)
      const target = window.document.querySelector<HTMLElement>(`[data-media-ref-key="${safeKey}"]`)
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 90)
    return () => window.clearTimeout(handle)
  }, [activePanel, canLinkImageRef, nearestMediaRef])
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
              {panel === 'media' && mediaIssueCount > 0 && <b className="editor-v2-tab-badge">{mediaIssueCount.toLocaleString('fa-IR')}</b>}
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
          <div className="editor-v2-action-grid editor-v2-callout-picker">
            {CALLOUT_VARIANTS_V2.map(variant => (
              <button
                key={variant}
                type="button"
                className={`editor-v2-callout-option callout-${variant}`}
                onClick={() => onApplyCallout(variant)}
              >
                <span>{CALLOUT_META_V2[variant].icon}</span>
                {CALLOUT_META_V2[variant].title}
              </button>
            ))}
            <button type="button" disabled={!canUnwrapCallout} onClick={onUnwrapCallout}><Undo2 size={15} />برگرداندن کال‌اوت به متن عادی</button>
            <p>برای تبدیل متن به کال‌اوت، نشانگر را داخل همان پاراگراف بگذارید یا متن را انتخاب کنید و نوع کال‌اوت را از همین پنل بزنید.</p>
          </div>
        )}
        {activePanel === 'media' && (
          <div className="editor-v2-media-panel">
            <div className="editor-v2-media-actions">
              <label>
                <Upload size={14} />
                آپلود
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={event => event.target.files?.[0] && onUploadImage(event.target.files[0])} />
              </label>
              <button type="button" onClick={() => setLibraryOpen(true)}><ImageIcon size={14} />انتخاب از کتاب</button>
              <button type="button" className="editor-v2-media-auto-caption" onClick={onAutoCaption}><FileText size={14} />درج خودکار کپشن</button>
            </div>
            {mediaMessage && <p className="editor-v2-media-message">{mediaMessage}</p>}

            <div className="editor-v2-media-ai">
              <textarea value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} placeholder="پرامپت تولید تصویر با هوش مصنوعی..." />
              <button type="button" onClick={() => aiPrompt.trim() && onGenerateImage(aiPrompt.trim())}><Wand2 size={14} />تولید و درج</button>
            </div>

            <div className="editor-v2-media-search">
              <Search size={14} />
              <input value={mediaQuery} onChange={event => setMediaQuery(event.target.value)} placeholder="جستجو در تصاویر، کپشن یا شماره صفحه..." />
            </div>
            {mediaIssueCount > 0 && (
              <div className="editor-v2-media-issues">
                <h4><AlertTriangle size={14} />نیازمند بررسی</h4>
                {mediaRefs.filter(item => item.needsCheck).slice(0, 8).map(item => (
                  <article
                    key={item.key}
                    role={item.blockId ? 'button' : undefined}
                    tabIndex={item.blockId ? 0 : undefined}
                    onClick={() => item.blockId && onJumpToBlock(item.blockId)}
                    onKeyDown={event => {
                      if (item.blockId && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        onJumpToBlock(item.blockId)
                      }
                    }}
                  >
                    {item.url ? <img src={item.url} alt={item.caption || ''} loading="lazy" /> : <span className="editor-v2-missing-thumb"><AlertTriangle size={14} /></span>}
                    <div>
                      <b>{item.caption || 'بدون کپشن'}</b>
                      <small>صفحه چاپی: {item.printNumber || 'نامشخص'}{item.issue ? ` · ${item.issue}` : ''}</small>
                      {item.autoCaption && <em className="editor-v2-media-auto-badge">اتوکپشن</em>}
                    </div>
                    <button type="button" onClick={event => { event.stopPropagation(); onResolveMediaIssue(item) }}><CheckCircle2 size={13} /></button>
                  </article>
                ))}
              </div>
            )}

            <div className="editor-v2-media-list">
              {filteredMediaRefs.length ? filteredMediaRefs.slice(0, 80).map(item => (
                <button
                  key={item.key}
                  type="button"
                  data-media-ref-key={item.key}
                  className={`${item.needsCheck ? 'has-issue' : ''}`}
                  disabled={!item.url || !item.blockId}
                  onClick={() => {
                    if (item.blockId) onJumpToBlock(item.blockId)
                  }}
                  title="رفتن به محل تصویر"
                >
                  {item.url ? <img src={item.url} alt={item.caption || ''} loading="lazy" /> : <span className="editor-v2-missing-thumb"><ImageIcon size={16} /></span>}
                  <span>{item.caption || `تصویر صفحه ${item.printNumber || ''}`}</span>
                  <small>صفحه {item.printNumber || 'نامشخص'}{item.autoCaption ? <><span> · </span><em className="editor-v2-media-auto-badge inline">اتوکپشن</em></> : ''}</small>
                </button>
              )) : <p className="editor-v2-empty-panel">تصویری برای نمایش پیدا نشد.</p>}
            </div>

            {libraryOpen && (
              <div className="editor-v2-media-modal" role="dialog" aria-modal="true">
                <div className="editor-v2-media-modal-card menu-glass-70">
                  <header>
                    <strong>انتخاب تصویر از کتاب</strong>
                    <button type="button" onClick={() => setLibraryOpen(false)}>×</button>
                  </header>
                  <div className="editor-v2-media-search">
                    <Search size={14} />
                    <input value={mediaQuery} onChange={event => setMediaQuery(event.target.value)} placeholder="جستجو..." autoFocus />
                  </div>
                  <div className="editor-v2-media-library">
                    {filteredLibraryMediaRefs.map(item => (
                      <button key={item.key} type="button" className={item.needsCheck ? 'has-issue' : ''} disabled={!item.assetId || !item.url} onClick={() => { if (item.assetId) { onInsertImage(item.assetId); setLibraryOpen(false) } }}>
                        {item.url ? <img src={item.url} alt={item.caption || ''} loading="lazy" /> : <span className="editor-v2-missing-thumb"><ImageIcon size={18} /></span>}
                        <b>{item.caption || 'بدون کپشن'}</b>
                        <small>صفحه چاپی: {item.printNumber || 'نامشخص'}{item.autoCaption ? ' · اتوکپشن' : ''}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activePanel === 'references' && (
          <div className="editor-v2-reference-panel">
            <div className="editor-v2-reference-box">
              <h4><Link2 size={14} />لینک متن انتخاب‌شده</h4>
              <input value={linkHref} onChange={event => setLinkHref(event.target.value)} placeholder="https://... یا #bookmark" />
              <div className="editor-v2-reference-actions">
                <button
                  type="button"
                  disabled={!canLinkImageRef || !linkHref.trim()}
                  onClick={() => {
                    const ok = onApplyTextLink(linkHref.trim())
                    setReferenceMessage(ok ? 'لینک روی متن انتخاب‌شده اعمال شد.' : 'اول متن مورد نظر را داخل سند انتخاب کنید.')
                    if (ok) setLinkHref('')
                  }}
                >
                  اعمال لینک
                </button>
                <button
                  type="button"
                  onClick={() => setReferenceMessage(onRemoveTextLink() ? 'لینک از متن انتخاب‌شده حذف شد.' : 'متنی که لینک داشته باشد انتخاب نشده است.')}
                >
                  حذف لینک
                </button>
              </div>
              {!canLinkImageRef && <small>برای ایجاد لینک یا اتصال به تصویر، ابتدا متن داخل سند را انتخاب کنید.</small>}
            </div>

            <div className="editor-v2-media-search">
              <Search size={14} />
              <input value={referenceQuery} onChange={event => setReferenceQuery(event.target.value)} placeholder="جستجو در ارجاعات، پاورقی، رفرنس یا تصاویر..." />
            </div>
            {referenceMessage && <p className="editor-v2-media-message">{referenceMessage}</p>}

            <details className="editor-v2-reference-accordion" open>
              <summary>اتصال متن به تصویر</summary>
              {canLinkImageRef && (
                <p className="editor-v2-media-link-hint">
                  متن انتخاب شده است؛ روی تصویر بزنید تا همان متن به تصویر وصل شود. تصاویر نزدیک به همین صفحه در اولویت هستند.
                </p>
              )}
              <div className="editor-v2-media-list compact">
                {filteredReferenceMediaRefs.slice(0, 50).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    data-media-ref-key={item.key}
                    className={`${item.needsCheck ? 'has-issue' : ''} ${nearestMediaRef?.key === item.key ? 'is-nearest' : ''} ${canLinkImageRef ? 'is-link-target' : ''}`}
                    disabled={!item.url || (!item.blockId && !item.assetId)}
                    onClick={() => {
                      if (canLinkImageRef) {
                        onLinkImageRef(item)
                        setReferenceMessage('متن انتخاب‌شده به تصویر وصل شد.')
                      } else if (item.blockId) onJumpToBlock(item.blockId)
                    }}
                    title={canLinkImageRef ? 'اتصال متن انتخاب‌شده به این تصویر' : 'رفتن به محل تصویر'}
                  >
                    {item.url ? <img src={item.url} alt={item.caption || ''} loading="lazy" /> : <span className="editor-v2-missing-thumb"><ImageIcon size={16} /></span>}
                    <span>{item.caption || `تصویر صفحه ${item.printNumber || ''}`}</span>
                    <small>صفحه {item.printNumber || 'نامشخص'}</small>
                  </button>
                ))}
              </div>
            </details>

            <details className="editor-v2-reference-accordion" open>
              <summary>پاورقی‌ها، رفرنس‌ها و لینک‌های موجود</summary>
              <div className="editor-v2-reference-list">
                {filteredInlineRefs.length ? filteredInlineRefs.slice(0, 80).map(item => (
                  <details key={item.key} className={`editor-v2-reference-item type-${item.type}`}>
                    <summary>
                      <b>{item.label}</b>
                      <span>{item.text || item.target || 'بدون متن'}</span>
                      <small>صفحه {item.printNumber || 'نامشخص'}</small>
                    </summary>
                    <div>
                      <label>
                        متن انتخاب‌شده
                        <textarea readOnly value={item.text} />
                      </label>
                      <label>
                        مقصد / متن ارجاع
                        <textarea readOnly value={item.target || ''} />
                      </label>
                      {item.blockId && <button type="button" onClick={() => onJumpToBlock(item.blockId!)}>رفتن به محل ارجاع</button>}
                    </div>
                  </details>
                )) : <p className="editor-v2-empty-panel">هنوز ارجاعی در این بخش پیدا نشد.</p>}
              </div>
            </details>
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
            <p>{aiMessage || 'اگر بلوکی انتخاب شده باشد همان متن بررسی می‌شود؛ در غیر این صورت متن صفحه یا ابتدای سند مبنا قرار می‌گیرد.'}</p>
          </div>
        )}
      </section>
    </aside>
  )
}

export default function EditorV2Page() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthContext()
  const userId = user?.id || ''
  const { balance: creditBalance } = useCredits(user)
  const [book, setBook] = useState<MockBook | null>(null)
  const [document, setDocument] = useState<BookDocumentV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveStateV2>('idle')
  const [autoSaveRemainingSeconds, setAutoSaveRemainingSeconds] = useState<number | null>(null)
  const [saveProgress, setSaveProgress] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<EditorPanelV2>('toc')
  const [activeTocId, setActiveTocId] = useState<string>()
  const [selectedBlockId, setSelectedBlockId] = useState<string>()
  const [hasTextSelection, setHasTextSelection] = useState(false)
  const [toolbarState, setToolbarState] = useState<TextToolbarStateV2>(EMPTY_TEXT_TOOLBAR_STATE_V2)
  const [dirty, setDirty] = useState(false)
  const [dirtyRevision, setDirtyRevision] = useState(0)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [mediaMessage, setMediaMessage] = useState('')
  const [aiApproval, setAiApproval] = useState<AiApprovalV2 | null>(null)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)
  const dirtyPageIndexesRef = useRef<Set<number>>(new Set())
  const savedSelectionRef = useRef<Range | null>(null)
  const lastInlineStyleTargetRef = useRef<HTMLElement | null>(null)
  const calloutActionLockRef = useRef(false)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const skipNextSurfaceSyncRef = useRef(false)
  const editRevisionRef = useRef(0)
  const saveIdleTimerRef = useRef<number | null>(null)
  const autoSaveDueAtRef = useRef<number | null>(null)
  const autoSaveTimeoutRef = useRef<number | null>(null)
  const autoSaveTickerRef = useRef<number | null>(null)
  const selectedBlock = useMemo(() => document ? findBlockInDocumentV2(document, selectedBlockId) : null, [document, selectedBlockId])
  const autoSaveCountdownLabel = formatAutosaveCountdownV2(autoSaveRemainingSeconds)
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
        ? autoSaveCountdownLabel
          ? `ذخیره خودکار تا پایان زمان سنج انجام می شود. برای ذخیره بلادرنگ کلیک کنید.`
          : 'ذخیره خودکار تا پایان زمان سنج انجام می شود. برای ذخیره بلادرنگ کلیک کنید.'
        : 'ذخیره شد'
  const saveButtonClass = `${visualSaveState === 'saving' ? 'is-saving' : ''} ${visualSaveState === 'saved' ? 'is-saved' : ''} ${visualSaveState === 'dirty' ? 'is-dirty' : ''} ${visualSaveState === 'error' ? 'is-error' : ''}`
  const recordAiUsage = useCallback((usage: RunAiResult['usage']) => {
    const before = Math.max(Number(creditBalance || 0), Number(usage.chargedCredits || 0))
    const after = Math.max(0, before - Number(usage.chargedCredits || 0))
    creditsBus.emit(after)
  }, [creditBalance])

  const clearAutoSaveSchedule = useCallback((clearDeadline = true) => {
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
    if (autoSaveTickerRef.current) {
      window.clearInterval(autoSaveTickerRef.current)
      autoSaveTickerRef.current = null
    }
    if (clearDeadline) {
      autoSaveDueAtRef.current = null
      setAutoSaveRemainingSeconds(null)
    }
  }, [])

  useEffect(() => () => {
    if (saveIdleTimerRef.current) window.clearTimeout(saveIdleTimerRef.current)
    clearAutoSaveSchedule()
  }, [clearAutoSaveSchedule])

  useEffect(() => {
    if (!document || !editorSurfaceRef.current) return
    if (skipNextSurfaceSyncRef.current) {
      skipNextSurfaceSyncRef.current = false
      return
    }
    if (editorSurfaceRef.current.matches(':focus-within')) return
    if (dirty) return
    editorSurfaceRef.current.innerHTML = documentToEditorHtmlV2(document)
    restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
  }, [dirty, document])

  useEffect(() => {
    if (authLoading) return
    let alive = true
    setLoading(true)
    setError('')
    void getBook(id)
      .then(async found => {
        if (!alive) return
        if (!found) {
          setError('کتاب پیدا نشد.')
          setBook(null)
          setDocument(null)
          return
        }
        if (!user) {
          setError('برای ویرایش کتاب باید وارد حساب ناشر شوید.')
          setBook(null)
          setDocument(null)
          return
        }
        if (isUuid(found.id)) {
          const ownPublisher = await (supabase as any).from('publisher_profiles').select('id').eq('user_id', user.id).maybeSingle()
          if (!alive) return
          if (ownPublisher.error) throw ownPublisher.error
          if (!ownPublisher.data?.id || ownPublisher.data.id !== found.publisher_id) {
            setError('شما مالک انتشارات این کتاب نیستید و اجازه ویرایش آن را ندارید.')
            setBook(null)
            setDocument(null)
            return
          }
        } else if (user.mockData?.id && found.publisher_id !== user.mockData.id) {
          setError('شما مالک انتشارات این کتاب نیستید و اجازه ویرایش آن را ندارید.')
          setBook(null)
          setDocument(null)
          return
        }
        if (found.status === 'published' && found.review_status === 'approved') {
          setError('این کتاب منتشر شده است و امکان ویرایش مستقیم ندارد. اگر هنوز خریداری نشده، ابتدا آن را از صفحه انتشارات از نشر خارج کنید.')
          setBook(null)
          setDocument(null)
          return
        }
        const loaded = await loadPageEngineDocument(found)
        const nextDocument = loaded.document || legacyBookToDocumentV2(found)
        setBook(found)
        setDocument(nextDocument)
        setActiveTocId(nextDocument.toc[0]?.id)
        setSelectedBlockId(undefined)
        editRevisionRef.current = 0
        dirtyPageIndexesRef.current = new Set()
        setDirtyRevision(0)
        setDirty(false)
        if (!loaded.pageEngine && isUuid(found.id)) {
          void backfillPageEngineForBook(found).catch(() => {})
        }
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
  }, [authLoading, id, userId])

  const saveDocument = useCallback(async (options: { manual?: boolean } = {}) => {
    if (!book || !document) return
    if (!dirty) {
      clearAutoSaveSchedule()
      if (options.manual) {
        setSaveState('saved')
        if (saveIdleTimerRef.current) window.clearTimeout(saveIdleTimerRef.current)
        saveIdleTimerRef.current = window.setTimeout(() => setSaveState(current => current === 'saved' ? 'idle' : current), 1200)
      }
      return
    }
    clearAutoSaveSchedule()
    const startedAt = performance.now()
    const capturedRevision = editRevisionRef.current
    setSaveState('saving')
    setSaveProgress(6)
    const nextDocument = { ...documentFromEditorDomV2(document, editorSurfaceRef.current), updatedAt: new Date().toISOString() }
    const pages = documentV2ToLegacyPages(nextDocument)
    const confirmedToc = documentV2ToConfirmedToc(nextDocument)
    const dirtyPageIndexes = dirtyPageIndexesRef.current.size
      ? new Set(dirtyPageIndexesRef.current)
      : new Set(nextDocument.pages.map(page => page.index))
    let pageEngineResult: Awaited<ReturnType<typeof savePageEngineDocument>> | null = null
    if (isUuid(book.id)) {
      try {
        pageEngineResult = await savePageEngineDocument(book.id, nextDocument, dirtyPageIndexes)
        setSaveProgress(68)
      } catch {
        pageEngineResult = null
        setSaveProgress(24)
      }
    }
    const usePageEngine = Boolean(pageEngineResult)
    const metadata = {
      ...(book.metadata || {}),
      confirmed_toc: confirmedToc,
      editor_v2_schema_version: usePageEngine ? '2.0-page' : '2.0',
      editor_v2_page_engine: usePageEngine || undefined,
      editor_v2_page_count: nextDocument.pages.length,
      ...(usePageEngine ? {} : { editor_v2_document: nextDocument }),
      editor_v2_saved_at: nextDocument.updatedAt,
    } as Record<string, unknown>
    if (usePageEngine) delete metadata.editor_v2_document
    let saveReport: Parameters<typeof showSaveTrafficToastV2>[0] | null = null
    try {
      const patch = (usePageEngine
        ? {
          metadata,
          preview_pages: pages.slice(0, 3).map((_, index) => index),
          content_updated_at: nextDocument.updatedAt,
        }
        : {
          metadata,
          pages,
          preview_pages: pages.slice(0, 3).map((_, index) => index),
          page_count: pages.length,
          content_updated_at: nextDocument.updatedAt,
        }) as unknown as Partial<PublisherBook>
      const nextBook = { ...book, ...patch, pages } as MockBook
      if (isUuid(book.id)) {
        const { page_count: _pageCount, ...remotePatch } = patch as Partial<PublisherBook> & { page_count?: number }
        const requestBytes = jsonBytesV2(remotePatch) + (pageEngineResult?.requestBytes || 0)
        const networkStartedAt = performance.now()
        const result = await (supabase as any).from('books').update(remotePatch).eq('id', book.id)
        setSaveProgress(92)
        const networkMs = performance.now() - networkStartedAt + (pageEngineResult?.networkMs || 0)
        const responseBytes = jsonBytesV2({
          data: result.data ?? null,
          count: result.count ?? null,
          status: result.status ?? null,
          statusText: result.statusText ?? null,
          error: result.error ? {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
            hint: result.error.hint,
          } : null,
        }) + (pageEngineResult?.responseBytes || 0)
        saveReport = {
          mode: pageEngineResult ? 'supabase/page-engine' : 'supabase',
          manual: options.manual,
          totalMs: performance.now() - startedAt,
          networkMs,
          requestBytes,
          responseBytes,
        }
        const { error } = result
        if (error) throw error
      } else {
        saveReport = {
          mode: 'local',
          manual: options.manual,
          totalMs: performance.now() - startedAt,
          networkMs: 0,
          requestBytes: jsonBytesV2(patch),
          responseBytes: 0,
        }
        updatePublisherBook(book.id, nextBook as PublisherBook)
        setSaveProgress(92)
      }
      notifyPublisherBookChanged(book.id)
      const remainingAnimationMs = 520 - (performance.now() - startedAt)
      if (remainingAnimationMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, remainingAnimationMs))
      }
      if (editRevisionRef.current === capturedRevision) {
        skipNextSurfaceSyncRef.current = true
        setDocument(nextDocument)
        setBook(nextBook)
        setDirty(false)
        dirtyPageIndexesRef.current = new Set()
        setSaveProgress(100)
        setSaveState('saved')
      } else {
        setDirty(true)
        setSaveState('idle')
      }
      if (saveIdleTimerRef.current) window.clearTimeout(saveIdleTimerRef.current)
      saveIdleTimerRef.current = window.setTimeout(() => {
        setSaveState(current => current === 'saved' ? 'idle' : current)
        setSaveProgress(null)
      }, 2200)
      if (saveReport) showSaveTrafficToastV2(saveReport)
    } catch {
      const remainingAnimationMs = 360 - (performance.now() - startedAt)
      if (remainingAnimationMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, remainingAnimationMs))
      }
      setSaveState('error')
      setSaveProgress(null)
      if (saveReport) {
        toast.error('Save failed', {
          description: [
            `• Supabase time: ${formatMsV2(saveReport.networkMs)}`,
            `• Upload payload: ${formatBytesV2(saveReport.requestBytes)}`,
            `• Supabase response egress: ${formatBytesV2(saveReport.responseBytes)}`,
          ].join('\n'),
          duration: 20_000,
        })
      }
    }
  }, [book, clearAutoSaveSchedule, dirty, document])

  useEffect(() => {
    if (!dirty || !book || !document || saveState === 'saving' || saveState === 'error') {
      if (!dirty || saveState === 'error') clearAutoSaveSchedule()
      return
    }
    if (!autoSaveDueAtRef.current) {
      autoSaveDueAtRef.current = Date.now() + EDITOR_V2_AUTOSAVE_DELAY_MS
    }
    clearAutoSaveSchedule(false)
    const updateRemaining = () => {
      const dueAt = autoSaveDueAtRef.current
      setAutoSaveRemainingSeconds(dueAt ? Math.max(0, Math.ceil((dueAt - Date.now()) / 1000)) : null)
    }
    updateRemaining()
    autoSaveTickerRef.current = window.setInterval(updateRemaining, 1000)
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveDueAtRef.current = null
      setAutoSaveRemainingSeconds(null)
      void saveDocument()
    }, Math.max(0, autoSaveDueAtRef.current - Date.now()))
    return () => clearAutoSaveSchedule(false)
  }, [book, clearAutoSaveSchedule, dirty, dirtyRevision, document, saveDocument, saveState])

  const pushEditorHistory = useCallback(() => {
    const html = editorSurfaceRef.current?.innerHTML
    if (!html) return
    const stack = undoStackRef.current
    if (stack[stack.length - 1] !== html) {
      undoStackRef.current = [...stack.slice(-59), html]
      redoStackRef.current = []
    }
  }, [])

  const commitDocument = useCallback((updater: (current: BookDocumentV2) => BookDocumentV2, options: { recordHistory?: boolean } = {}) => {
    if (options.recordHistory) pushEditorHistory()
    setDocument(current => {
      if (!current) return current
      const base = documentFromEditorDomV2(current, editorSurfaceRef.current)
      const next = updater(base)
      dirtyPageIndexesRef.current = new Set(next.pages.map(page => page.index))
      setDirty(true)
      return next
    })
  }, [pushEditorHistory])

  const rememberEditorSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorSurfaceRef.current) {
      setHasTextSelection(false)
      return
    }
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    const selectionNode = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (selectionNode && editorSurfaceRef.current.contains(selectionNode)) {
      savedSelectionRef.current = range.cloneRange()
      setHasTextSelection(!selection.isCollapsed && Boolean(selection.toString().trim()))
      return
    }
    setHasTextSelection(false)
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

  const selectedBlockIdFromEditorTarget = useCallback(() => {
    const root = editorSurfaceRef.current
    if (!root) return selectedBlockId
    const selection = window.getSelection()
    const ranges = [
      selection?.rangeCount ? selection.getRangeAt(0) : null,
      savedSelectionRef.current,
    ].filter(Boolean) as Range[]
    for (const range of ranges) {
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
      const target = element?.closest<HTMLElement>('[data-block-id]')
      if (target && root.contains(target)) return target.dataset.blockId || selectedBlockId
    }
    return selectedBlockId
  }, [selectedBlockId])

  const selectedEditorBlockElement = useCallback(() => {
    if (!selectedBlockId || !editorSurfaceRef.current) return null
    const safeId = selectedBlockId.replace(/"/g, '\\"')
    return editorSurfaceRef.current.querySelector<HTMLElement>(`[data-block-id="${safeId}"]`)
  }, [selectedBlockId])

  useEffect(() => {
    const root = editorSurfaceRef.current
    if (!root) return
    root.querySelectorAll('.is-editor-selected').forEach(element => element.classList.remove('is-editor-selected'))
    if (!selectedBlockId) return
    const safeId = selectedBlockId.replace(/"/g, '\\"')
    root.querySelector<HTMLElement>(`[data-block-id="${safeId}"]`)?.classList.add('is-editor-selected')
  }, [selectedBlockId, document?.updatedAt])

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

  const syncImageSizeControl = useCallback((figure?: HTMLElement | null) => {
    if (!figure?.matches('figure[data-v2-type="image"]')) return
    const input = figure.querySelector<HTMLInputElement>('input[data-image-size-range="true"]')
    const label = figure.querySelector<HTMLElement>('[data-image-size-value="true"]')
    if (!input || !label) return
    const explicitPercent = Number(figure.dataset.widthPercent || 0)
    let percent = explicitPercent
    if (!percent || figure.dataset.imageSizeAuto === 'true') {
      const parentWidth = Math.max(1, figure.parentElement?.getBoundingClientRect().width || 0)
      const figureWidth = Math.max(1, figure.getBoundingClientRect().width)
      percent = Math.round((figureWidth / parentWidth) * 100)
    }
    percent = Math.max(5, Math.min(100, percent || 100))
    input.value = String(percent)
    label.textContent = `${percent}%`
  }, [])

  const updateSelectedBlockFromDom = useCallback(() => {
    rememberEditorSelection()
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const target = element?.closest<HTMLElement>('[data-block-id]')
    syncImageSizeControl(target?.matches('figure[data-v2-type="image"]') ? target : target?.closest<HTMLElement>('figure[data-v2-type="image"]'))
    setSelectedBlockId(target?.dataset.blockId)
    setToolbarState(readToolbarStateFromSelection())
  }, [readToolbarStateFromSelection, rememberEditorSelection, syncImageSizeControl])

  const markDirtyPageFromNode = useCallback((source?: EventTarget | Node | null) => {
    const root = editorSurfaceRef.current
    const selection = window.getSelection()
    const sourceNode = source instanceof Node
      ? source
      : selection?.anchorNode || savedSelectionRef.current?.commonAncestorContainer || null
    const element = sourceNode instanceof Element ? sourceNode : sourceNode?.parentElement
    const pageElement = element?.closest<HTMLElement>('.editor-v2-flow-page')
      || (selectedBlockId ? root?.querySelector<HTMLElement>(`[data-block-id="${selectedBlockId.replace(/"/g, '\\"')}"]`)?.closest<HTMLElement>('.editor-v2-flow-page') : null)
    const pageIndex = Number(pageElement?.dataset.pageIndex)
    if (Number.isFinite(pageIndex)) dirtyPageIndexesRef.current.add(pageIndex)
  }, [selectedBlockId])

  const markEditorDirty = useCallback((source?: EventTarget | Node | null) => {
    markDirtyPageFromNode(source)
    editRevisionRef.current += 1
    setDirtyRevision(editRevisionRef.current)
    setDirty(true)
    window.setTimeout(updateSelectedBlockFromDom, 0)
  }, [markDirtyPageFromNode, updateSelectedBlockFromDom])

  const refreshDocumentFromEditor = useCallback(() => {
    setDocument(current => current ? documentFromEditorDomV2(current, editorSurfaceRef.current) : current)
  }, [])

  const scheduleRefreshDocumentFromEditor = useCallback(() => {
    window.requestAnimationFrame(() => refreshDocumentFromEditor())
  }, [refreshDocumentFromEditor])

  const scheduleToolbarDocumentRefresh = useCallback(() => {
    skipNextSurfaceSyncRef.current = true
    scheduleRefreshDocumentFromEditor()
  }, [scheduleRefreshDocumentFromEditor])

  const applyImageReferenceToSelection = useCallback((ref: EditorMediaReferenceV2) => {
    const imageRefId = ref.blockId || ref.assetId
    if (!imageRefId) return
    restoreEditorSelection()
    const selection = window.getSelection()
    const root = editorSurfaceRef.current
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!selection || !range || !root || selection.isCollapsed || !selection.toString().trim()) {
      setMediaMessage('برای اتصال تصویر، اول متن مورد نظر را انتخاب کنید.')
      return
    }
    const container = range.commonAncestorContainer
    const selectionNode = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!selectionNode || !root.contains(selectionNode)) {
      setMediaMessage('انتخاب متن داخل سند فعال نیست.')
      return
    }
    pushEditorHistory()
    const wrapper = window.document.createElement('span')
    wrapper.className = 'book-image-reference editor-v2-image-reference'
    wrapper.dataset.imageRefId = imageRefId
    wrapper.title = ref.caption || 'مشاهده تصویر مرتبط'
    try {
      range.surroundContents(wrapper)
    } catch {
      const contents = range.extractContents()
      wrapper.appendChild(contents)
      range.insertNode(wrapper)
    }
    const nextRange = window.document.createRange()
    nextRange.selectNodeContents(wrapper)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    savedSelectionRef.current = nextRange.cloneRange()
    setHasTextSelection(true)
    setMediaMessage('متن انتخاب‌شده به تصویر وصل شد.')
    markEditorDirty()
    scheduleToolbarDocumentRefresh()
  }, [markEditorDirty, pushEditorHistory, restoreEditorSelection, scheduleToolbarDocumentRefresh])

  const handleEditorSurfaceInput = useCallback((event: any) => {
    const target = event.target as HTMLElement
    document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
    normalizeCaptionElementV2(target.closest<HTMLElement>('figcaption[data-image-caption], figcaption'))
    const sizeInput = target.closest<HTMLInputElement>('input[data-image-size-range="true"]')
    if (sizeInput) {
      const figure = sizeInput.closest<HTMLElement>('figure[data-v2-type="image"][data-block-id]')
      const blockId = figure?.dataset.blockId
      if (!figure || !blockId) return
      if (sizeInput.dataset.historyRecorded !== 'true') {
        pushEditorHistory()
        sizeInput.dataset.historyRecorded = 'true'
      }
      const percent = Math.max(5, Math.min(100, Number(sizeInput.value) || 100))
      figure.dataset.widthPercent = String(percent)
      figure.dataset.widthPx = ''
      figure.dataset.imageSizeAuto = 'false'
      figure.style.setProperty('--editor-v2-image-width', `${percent}%`)
      figure.style.maxWidth = ''
      const valueLabel = figure.querySelector<HTMLElement>('[data-image-size-value="true"]')
      if (valueLabel) valueLabel.textContent = `${percent}%`
      setSelectedBlockId(blockId)
      markEditorDirty(target)
      scheduleToolbarDocumentRefresh()
      return
    }
    markEditorDirty(target)
  }, [document, markEditorDirty, pushEditorHistory, scheduleToolbarDocumentRefresh])

  const restoreEditorHtmlSnapshot = useCallback((html: string) => {
    if (!editorSurfaceRef.current) return
    editorSurfaceRef.current.innerHTML = html
    markEditorDirty()
    skipNextSurfaceSyncRef.current = true
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

  const handleEditorBeforeInput = useCallback((event: any) => {
    if (selectionTouchesLockedPageBreakV2(editorSurfaceRef.current)) {
      event.preventDefault()
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      return
    }
    pushEditorHistory()
  }, [document, pushEditorHistory])

  const cutEditorSelection = useCallback(async () => {
    const root = editorSurfaceRef.current
    const selection = window.getSelection()
    if (!root || !selection?.rangeCount || selection.isCollapsed) return false
    if (selectionTouchesLockedPageBreakV2(root, selection)) {
      document && restoreEditorPageBreaksV2(document, root)
      return false
    }
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    if (!root.contains(container.nodeType === Node.ELEMENT_NODE ? container as Node : container.parentElement)) return false
    pushEditorHistory()
    root.focus()
    try {
      if (window.document.execCommand('cut')) {
        window.setTimeout(() => {
          markEditorDirty()
          rememberEditorSelection()
          scheduleToolbarDocumentRefresh()
        }, 0)
        return true
      }
    } catch {
      // Fall back to a manual text cut below.
    }
    const text = selection.toString()
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      // Clipboard permission can be denied; still remove the selected text like a normal cut command.
    }
    range.deleteContents()
    selection.removeAllRanges()
    markEditorDirty()
    rememberEditorSelection()
    scheduleToolbarDocumentRefresh()
    return true
  }, [document, markEditorDirty, pushEditorHistory, rememberEditorSelection, scheduleToolbarDocumentRefresh])

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    const code = event.code
    const isModifierShortcut = event.ctrlKey || event.metaKey
    const isUndo = isModifierShortcut && (key === 'z' || code === 'KeyZ') && !event.shiftKey
    const isRedo = isModifierShortcut && (key === 'y' || code === 'KeyY' || ((key === 'z' || code === 'KeyZ') && event.shiftKey))
    const isCut = isModifierShortcut && (key === 'x' || code === 'KeyX')
    const isDeleteCommand = key === 'backspace' || key === 'delete'
    if (isDeleteCommand && selectionTouchesLockedPageBreakV2(editorSurfaceRef.current)) {
      event.preventDefault()
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      return
    }
    if (isUndo) {
      event.preventDefault()
      undoEditorChange()
      return
    }
    if (isRedo) {
      event.preventDefault()
      redoEditorChange()
      return
    }
    if (isCut) {
      event.preventDefault()
      void cutEditorSelection()
    }
  }, [cutEditorSelection, document, redoEditorChange, undoEditorChange])

  const handleEditorCopy = useCallback((_event: ReactClipboardEvent<HTMLDivElement>) => {
    rememberEditorSelection()
  }, [rememberEditorSelection])

  const handleEditorCut = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    if (selectionTouchesLockedPageBreakV2(editorSurfaceRef.current)) {
      event.preventDefault()
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      return
    }
    pushEditorHistory()
    window.setTimeout(() => {
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      markEditorDirty()
      rememberEditorSelection()
      scheduleToolbarDocumentRefresh()
    }, 0)
  }, [document, markEditorDirty, pushEditorHistory, rememberEditorSelection, scheduleToolbarDocumentRefresh])

  const handleEditorPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    if (selectionTouchesLockedPageBreakV2(editorSurfaceRef.current)) {
      event.preventDefault()
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      return
    }
    pushEditorHistory()
    window.setTimeout(() => {
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      markEditorDirty()
      rememberEditorSelection()
      scheduleToolbarDocumentRefresh()
    }, 0)
  }, [document, markEditorDirty, pushEditorHistory, rememberEditorSelection, scheduleToolbarDocumentRefresh])

  const handleEditorDrop = useCallback(() => {
    pushEditorHistory()
    window.setTimeout(() => {
      document && restoreEditorPageBreaksV2(document, editorSurfaceRef.current)
      markEditorDirty()
      rememberEditorSelection()
      scheduleToolbarDocumentRefresh()
    }, 0)
  }, [document, markEditorDirty, pushEditorHistory, rememberEditorSelection, scheduleToolbarDocumentRefresh])

  const applyInlineStyleToSelection = useCallback((style: Partial<CSSStyleDeclaration>) => {
    const keepInlineTargetSelected = (target: HTMLElement) => {
      const nextRange = window.document.createRange()
      nextRange.selectNodeContents(target)
      const activeSelection = window.getSelection()
      activeSelection?.removeAllRanges()
      activeSelection?.addRange(nextRange)
      savedSelectionRef.current = nextRange.cloneRange()
      lastInlineStyleTargetRef.current = target
    }

    const applyStyleToLastInlineTarget = () => {
      const target = lastInlineStyleTargetRef.current
      if (!target || !editorSurfaceRef.current?.contains(target)) return false
      pushEditorHistory()
      Object.assign(target.style, style)
      markEditorDirty()
      keepInlineTargetSelected(target)
      scheduleToolbarDocumentRefresh()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }

    restoreEditorSelection()
    const selection = window.getSelection()
    if (!editorSurfaceRef.current) return false
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!range) {
      if (applyStyleToLastInlineTarget()) return true
      const fallbackTarget = selectedEditorBlockElement()
      if (!fallbackTarget) return false
      pushEditorHistory()
      Object.assign(fallbackTarget.style, style)
      markEditorDirty()
      scheduleToolbarDocumentRefresh()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!element || !editorSurfaceRef.current.contains(element)) {
      if (applyStyleToLastInlineTarget()) return true
      const fallbackTarget = selectedEditorBlockElement()
      if (!fallbackTarget) return false
      pushEditorHistory()
      Object.assign(fallbackTarget.style, style)
      markEditorDirty()
      scheduleToolbarDocumentRefresh()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    pushEditorHistory()
    if (range.collapsed) {
      const target = element.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, li')
      if (!target) return false
      Object.assign(target.style, style)
      lastInlineStyleTargetRef.current = target
      markEditorDirty()
      rememberEditorSelection()
      scheduleToolbarDocumentRefresh()
      window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
      return true
    }
    const existingInlineTarget = element.closest<HTMLElement>('span[style]')
    if (existingInlineTarget && editorSurfaceRef.current.contains(existingInlineTarget) && existingInlineTarget.textContent === range.toString()) {
      Object.assign(existingInlineTarget.style, style)
      keepInlineTargetSelected(existingInlineTarget)
      markEditorDirty()
      scheduleToolbarDocumentRefresh()
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
    lastInlineStyleTargetRef.current = span
    markEditorDirty()
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
    return true
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh, selectedEditorBlockElement])

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
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [editorElementFromCurrentSelection, markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh, selectedEditorBlockElement])

  const applyBlockAlignment = useCallback((alignment: 'left' | 'right' | 'center' | 'justify') => {
    restoreEditorSelection()
    const target = editorElementFromCurrentSelection()?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6, ol, ul') || selectedEditorBlockElement()
    if (!target) return
    pushEditorHistory()
    target.style.textAlign = alignment
    markEditorDirty()
    rememberEditorSelection()
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [editorElementFromCurrentSelection, markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh, selectedEditorBlockElement])

  const retagEditorBlockElement = useCallback((element: HTMLElement, tag: string) => {
    const normalizedTag = tag.toLowerCase()
    if (element.tagName.toLowerCase() === normalizedTag) return element
    const replacement = window.document.createElement(normalizedTag)
    Array.from(element.attributes).forEach(attribute => {
      replacement.setAttribute(attribute.name, attribute.value)
    })
    while (element.firstChild) replacement.appendChild(element.firstChild)
    element.replaceWith(replacement)
    return replacement
  }, [])

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
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, redoEditorChange, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh, undoEditorChange])

  const formatCurrentBlock = useCallback((tag: string) => {
    pushEditorHistory()
    restoreEditorSelection()
    const beforeTarget = editorElementFromCurrentSelection()?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6') || selectedEditorBlockElement()
    window.document.execCommand('formatBlock', false, tag)
    let target = editorElementFromCurrentSelection()?.closest<HTMLElement>('[data-block-id], p, h1, h2, h3, h4, h5, h6') || beforeTarget
    if (target && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      target = retagEditorBlockElement(target, tag)
      target.dataset.v2Type = tag === 'p' ? 'paragraph' : 'heading'
      if (tag === 'p') {
        target.removeAttribute('aria-level')
        target.classList.remove('editor-v2-heading')
      }
      setSelectedBlockId(target.dataset.blockId)
    }
    markEditorDirty()
    rememberEditorSelection()
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [editorElementFromCurrentSelection, markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, retagEditorBlockElement, scheduleToolbarDocumentRefresh, selectedEditorBlockElement])

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
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => setToolbarState(readToolbarStateFromSelection()), 0)
  }, [markEditorDirty, pushEditorHistory, readToolbarStateFromSelection, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh])

  const createLinkForSelection = useCallback(() => {
    rememberEditorSelection()
    setActivePanel('references')
  }, [rememberEditorSelection])

  const applyTextLinkToSelection = useCallback((href: string) => {
    if (!href.trim()) return false
    restoreEditorSelection()
    const selection = window.getSelection()
    const root = editorSurfaceRef.current
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!selection || !range || !root || selection.isCollapsed || !selection.toString().trim()) return false
    const container = range.commonAncestorContainer
    const selectionNode = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!selectionNode || !root.contains(selectionNode)) return false
    pushEditorHistory()
    try {
      window.document.execCommand('createLink', false, href.trim())
    } catch {
      const wrapper = window.document.createElement('a')
      wrapper.href = href.trim()
      const contents = range.extractContents()
      wrapper.appendChild(contents)
      range.insertNode(wrapper)
    }
    markEditorDirty()
    rememberEditorSelection()
    scheduleToolbarDocumentRefresh()
    return true
  }, [markEditorDirty, pushEditorHistory, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh])

  const removeTextLinkFromSelection = useCallback(() => {
    restoreEditorSelection()
    const selection = window.getSelection()
    const root = editorSurfaceRef.current
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    if (!range || !root) return false
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!element || !root.contains(element)) return false
    const link = element.closest<HTMLAnchorElement>('a')
    pushEditorHistory()
    if (link) {
      link.replaceWith(...Array.from(link.childNodes))
    } else {
      try {
        window.document.execCommand('unlink')
      } catch {
        return false
      }
    }
    markEditorDirty()
    rememberEditorSelection()
    scheduleToolbarDocumentRefresh()
    return true
  }, [markEditorDirty, pushEditorHistory, rememberEditorSelection, restoreEditorSelection, scheduleToolbarDocumentRefresh])

  const insertSimpleTable = useCallback(() => {
    const tableId = createV2Id('table', Date.now())
    const html = `<table data-block-id="${tableId}" data-v2-type="table"><tbody><tr><td>عنوان</td><td>مقدار</td></tr><tr><td></td><td></td></tr></tbody></table>`
    execTextCommand('insertHTML', html)
  }, [execTextCommand])

  const wrapSelectedCallout = useCallback((variant: (typeof CALLOUT_VARIANTS_V2)[number]) => {
    if (calloutActionLockRef.current) return
    calloutActionLockRef.current = true
    const targetBlockId = selectedBlockIdFromEditorTarget()
    const root = editorSurfaceRef.current
    const target = targetBlockId && root
      ? root.querySelector<HTMLElement>(`[data-block-id="${targetBlockId.replace(/"/g, '\\"')}"]`)
      : null
    if (!targetBlockId) {
      calloutActionLockRef.current = false
      setAiMessage('برای ساخت کال‌اوت، نشانگر را داخل یک پاراگراف بگذارید یا بخشی از متن را انتخاب کنید.')
      setActivePanel('upgrade')
      return
    }
    const meta = CALLOUT_META_V2[variant]
    if (!target || !root?.contains(target)) {
      calloutActionLockRef.current = false
      setAiMessage('متن انتخاب‌شده در بوم ادیتور پیدا نشد.')
      return
    }
    const selection = window.getSelection()
    const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current
    const selectedBlockElements = (() => {
      if (!activeRange || activeRange.collapsed) return []
      const targetPage = target.closest<HTMLElement>('.editor-v2-flow-page')
      return Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'))
        .filter(element => {
          if (element.closest('section.editor-v2-callout[data-v2-type="callout"]')) return false
          if (targetPage && element.closest('.editor-v2-flow-page') !== targetPage) return false
          if (!['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'ul'].includes(element.tagName.toLowerCase())) return false
          try {
            return activeRange.intersectsNode(element)
          } catch {
            return false
          }
        })
        .filter((element, _index, elements) => !elements.some(other => other !== element && other.contains(element)))
    })()
    const existingCallout = target.closest<HTMLElement>('section.editor-v2-callout[data-v2-type="callout"]')
    pushEditorHistory()
    if (existingCallout) {
      existingCallout.className = `book-callout editor-v2-callout has-rendered-title callout-${variant}`
      existingCallout.dataset.variant = variant
      existingCallout.dataset.calloutVariant = variant
      existingCallout.dataset.calloutTitle = meta.title
      existingCallout.dataset.calloutIcon = meta.icon
      if (!existingCallout.getAttribute('dir')) {
        existingCallout.setAttribute('dir', textDirectionV2(existingCallout.innerText || meta.title))
      }
      const iconElement = existingCallout.querySelector<HTMLElement>('.book-callout-icon')
      const bgIconElement = existingCallout.querySelector<HTMLElement>('.book-callout-bg-icon')
      const titleElement = existingCallout.querySelector<HTMLElement>('[data-callout-title-editor], .book-callout-head strong')
      if (iconElement) iconElement.textContent = meta.icon
      if (bgIconElement) bgIconElement.textContent = meta.icon
      if (!bgIconElement) {
        const bgIcon = window.document.createElement('div')
        bgIcon.className = 'book-callout-bg-icon'
        bgIcon.contentEditable = 'false'
        bgIcon.textContent = meta.icon
        existingCallout.insertBefore(bgIcon, existingCallout.querySelector('.book-callout-content'))
      }
      if (!existingCallout.querySelector('[data-callout-unwrap]')) {
        const unwrapButton = window.document.createElement('button')
        unwrapButton.type = 'button'
        unwrapButton.className = 'book-callout-unwrap editor-v2-callout-unwrap'
        unwrapButton.contentEditable = 'false'
        unwrapButton.dataset.calloutUnwrap = 'true'
        unwrapButton.setAttribute('aria-label', 'Unwrap callout')
        unwrapButton.textContent = '×'
        existingCallout.prepend(unwrapButton)
      }
      if (titleElement && !titleElement.textContent?.trim()) titleElement.textContent = meta.title
      setSelectedBlockId(existingCallout.dataset.blockId)
    } else {
      const wrappedTargets = selectedBlockElements.length > 1 ? selectedBlockElements : [target]
      const editableTargets = wrappedTargets.map(item => /^h[1-6]$/i.test(item.tagName) ? retagEditorBlockElement(item, 'p') : item)
      if (!editableTargets.every(item => ['p', 'div', 'ol', 'ul'].includes(item.tagName.toLowerCase()))) {
        calloutActionLockRef.current = false
        setAiMessage('فقط پاراگراف‌ها، عنوان‌ها یا لیست‌های انتخاب‌شده را می‌توان به یک کال‌اوت تبدیل کرد.')
        return
      }
      editableTargets.forEach(item => {
        if (item.tagName.toLowerCase() === 'p' || item.tagName.toLowerCase() === 'div') item.dataset.v2Type = 'paragraph'
      })
      const calloutId = createV2Id('callout', targetBlockId, Date.now())
      const section = window.document.createElement('section')
      section.className = `book-callout editor-v2-callout has-rendered-title callout-${variant}`
      section.dir = textDirectionV2(editableTargets.map(item => item.innerText).join('\n') || meta.title)
      section.dataset.blockId = calloutId
      section.dataset.v2Type = 'callout'
      section.dataset.variant = variant
      section.dataset.calloutVariant = variant
      section.dataset.calloutTitle = meta.title
      section.dataset.calloutIcon = meta.icon
      section.innerHTML = `<button type="button" class="book-callout-unwrap editor-v2-callout-unwrap" contenteditable="false" data-callout-unwrap="true" aria-label="Unwrap callout">×</button><div class="book-callout-head"><span class="book-callout-icon" contenteditable="false">${escapeHtmlV2(meta.icon)}</span><strong class="book-callout-title" contenteditable="true" data-callout-title-editor="true">${escapeHtmlV2(meta.title)}</strong></div><div class="book-callout-bg-icon" contenteditable="false">${escapeHtmlV2(meta.icon)}</div><div class="book-callout-content"></div>`
      const content = section.querySelector<HTMLElement>('.book-callout-content')
      editableTargets[0].replaceWith(section)
      editableTargets.forEach(item => content?.appendChild(item))
      setSelectedBlockId(calloutId)
    }
    markEditorDirty()
    scheduleToolbarDocumentRefresh()
    window.setTimeout(() => { calloutActionLockRef.current = false }, 180)
  }, [markEditorDirty, pushEditorHistory, retagEditorBlockElement, scheduleToolbarDocumentRefresh, selectedBlockIdFromEditorTarget])

  const unwrapCalloutElement = useCallback((callout: HTMLElement) => {
    pushEditorHistory()
    const content = callout.querySelector<HTMLElement>('.book-callout-content')
    const children = Array.from(content?.childNodes || [])
    if (!children.length) {
      callout.remove()
    } else {
      callout.replaceWith(...children)
    }
    markEditorDirty()
    scheduleToolbarDocumentRefresh()
    setSelectedBlockId(undefined)
  }, [markEditorDirty, pushEditorHistory, scheduleToolbarDocumentRefresh])

  const unwrapSelectedCallout = useCallback(() => {
    if (calloutActionLockRef.current) return
    calloutActionLockRef.current = true
    const targetBlockId = selectedBlockIdFromEditorTarget()
    const root = editorSurfaceRef.current
    const target = targetBlockId && root
      ? root.querySelector<HTMLElement>(`[data-block-id="${targetBlockId.replace(/"/g, '\\"')}"]`)
      : null
    const callout = target?.closest<HTMLElement>('section.editor-v2-callout[data-v2-type="callout"]')
    if (!targetBlockId || !callout) {
      calloutActionLockRef.current = false
      return
    }
    unwrapCalloutElement(callout)
    window.setTimeout(() => { calloutActionLockRef.current = false }, 180)
  }, [selectedBlockIdFromEditorTarget, unwrapCalloutElement])

  const insertBlockIntoEditorDom = useCallback((block: BookBlockV2, insertionBlockId?: string) => {
    const root = editorSurfaceRef.current
    if (!root) return
    const template = window.document.createElement('template')
    template.innerHTML = blockToEditorHtmlV2(block)
    const element = template.content.firstElementChild as HTMLElement | null
    if (!element) return
    const safeId = insertionBlockId?.replace(/"/g, '\\"')
    const target = safeId ? root.querySelector<HTMLElement>(`[data-block-id="${safeId}"]`) : null
    if (target) {
      target.insertAdjacentElement('afterend', element)
    } else {
      const page = root.querySelector<HTMLElement>('.editor-v2-flow-page') || root
      page.appendChild(element)
    }
    skipNextSurfaceSyncRef.current = true
    window.setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20)
  }, [])

  const insertImageFromAsset = useCallback((assetId: string) => {
    const asset = document?.assets.find(item => item.id === assetId)
    if (!asset) return
    const insertionBlockId = selectedBlockIdFromEditorTarget() || selectedBlockId
    const anchorBlock = document ? findBlockInDocumentV2(document, insertionBlockId) : null
    const block: BookBlockV2 = {
      id: createV2Id('image', asset.id, Date.now()),
      type: 'image',
      url: asset.url,
      caption: asset.caption,
      imageId: asset.id,
      anchor: createV2Id('image-anchor', asset.id, Date.now()),
      printNumber: anchorBlock?.printNumber || asset.printNumber,
      status: asset.status,
      issue: asset.issue,
    }
    commitDocument(current => insertBlockAfterV2(current, insertionBlockId, block))
    insertBlockIntoEditorDom(block, insertionBlockId)
    setSelectedBlockId(block.id)
  }, [commitDocument, document, insertBlockIntoEditorDom, selectedBlockId, selectedBlockIdFromEditorTarget])

  const insertUploadedImage = useCallback(async (file: File) => {
    const insertionBlockId = selectedBlockIdFromEditorTarget() || selectedBlockId
    const anchorBlock = document ? findBlockInDocumentV2(document, insertionBlockId) : null
    try {
      const url = await fileToDataUrlV2(file)
      const asset = {
        id: createV2Id('asset-upload', Date.now(), file.name),
        type: 'image' as const,
        url,
        caption: file.name.replace(/\.[^.]+$/, ''),
        printNumber: anchorBlock?.printNumber,
        status: 'ready' as const,
      }
      const block: BookBlockV2 = {
        id: createV2Id('image', asset.id, Date.now()),
        type: 'image',
        url,
        caption: asset.caption,
        imageId: asset.id,
        anchor: createV2Id('image-anchor', asset.id, Date.now()),
        printNumber: asset.printNumber,
        status: 'ready',
        widthPercent: 80,
      }
      commitDocument(current => {
        const next = insertBlockAfterV2(current, insertionBlockId, block)
        return { ...next, assets: [...next.assets, asset] }
      })
      insertBlockIntoEditorDom(block, insertionBlockId)
      setSelectedBlockId(block.id)
      setAiMessage('تصویر آپلود و در سند درج شد.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'آپلود تصویر ناموفق بود.')
    }
  }, [commitDocument, document, insertBlockIntoEditorDom, selectedBlockId, selectedBlockIdFromEditorTarget])

  const generateImageFromPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return
    const insertionBlockId = selectedBlockIdFromEditorTarget() || selectedBlockId
    const anchorBlock = document ? findBlockInDocumentV2(document, insertionBlockId) : null
    setAiBusy(true)
    setAiMessage('در حال تولید تصویر...')
    try {
      const result = await generateAiImageThroughGateway({
        prompt,
        purpose: 'interactive',
        bookId: document?.sourceBookId,
        pageIndex: anchorBlock?.printNumber ? Number(anchorBlock.printNumber) : undefined,
        user,
      })
      const asset = {
        id: createV2Id('asset-ai', Date.now()),
        type: 'image' as const,
        url: result.imageUrl,
        caption: prompt.slice(0, 90),
        printNumber: anchorBlock?.printNumber,
        status: 'ready' as const,
      }
      const block: BookBlockV2 = {
        id: createV2Id('image', asset.id, Date.now()),
        type: 'image',
        url: result.imageUrl,
        caption: asset.caption,
        imageId: asset.id,
        anchor: createV2Id('image-anchor', asset.id, Date.now()),
        printNumber: asset.printNumber,
        status: 'ready',
        widthPercent: 80,
      }
      commitDocument(current => {
        const next = insertBlockAfterV2(current, insertionBlockId, block)
        return { ...next, assets: [...next.assets, asset] }
      })
      insertBlockIntoEditorDom(block, insertionBlockId)
      recordAiUsage(result.usage)
      setSelectedBlockId(block.id)
      setAiMessage('تصویر تولید و درج شد.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'تولید تصویر ناموفق بود.')
    } finally {
      setAiBusy(false)
    }
  }, [commitDocument, document, insertBlockIntoEditorDom, recordAiUsage, selectedBlockId, selectedBlockIdFromEditorTarget, user])

  const resizeImageBlock = useCallback((blockId: string, widthPercent: number) => {
    commitDocument(current => updateBlockInDocumentV2(current, blockId, block => {
      if (block.type !== 'image') return block
      return { ...block, widthPercent, widthPx: undefined }
    }))
  }, [commitDocument])

  const deleteImageBlock = useCallback((blockId: string) => {
    const figure = editorSurfaceRef.current?.querySelector<HTMLElement>(`figure[data-v2-type="image"][data-block-id="${blockId.replace(/"/g, '\\"')}"]`)
    const domAssetId = figure?.dataset.imageId
    if (figure) {
      pushEditorHistory()
      figure.remove()
      skipNextSurfaceSyncRef.current = true
    }
    commitDocument(current => {
      const removedAssetIds = new Set<string>()
      const pages = current.pages.map(page => ({
        ...page,
        blocks: mapBlocksV2(page.blocks, block => {
          if (block.type === 'image' && block.id === blockId) {
            if (block.imageId) removedAssetIds.add(block.imageId)
            return null
          }
          return block
        }),
      }))
      if (domAssetId) removedAssetIds.add(domAssetId)
      const usedAssetIds = new Set<string>()
      pages.forEach(page => {
        const visit = (blocks: BookBlockV2[]) => blocks.forEach(block => {
          if (block.type === 'image' && block.imageId) usedAssetIds.add(block.imageId)
          if (block.type === 'callout') visit(block.blocks)
        })
        visit(page.blocks)
      })
      const assets = current.assets.filter(asset => !removedAssetIds.has(asset.id) || usedAssetIds.has(asset.id))
      return rebuildDocumentTocV2({ ...current, pages, assets })
    }, { recordHistory: true })
    setSelectedBlockId(current => current === blockId ? undefined : current)
    scheduleRefreshDocumentFromEditor()
  }, [commitDocument, pushEditorHistory, scheduleRefreshDocumentFromEditor])

  const handleImageResizePointerDown = useCallback((event: any) => {
    const target = event.target as HTMLElement
    const deleteButton = target.closest<HTMLElement>('[data-image-delete="true"]')
    if (deleteButton) {
      const figure = deleteButton.closest<HTMLElement>('figure[data-v2-type="image"][data-block-id]')
      const blockId = figure?.dataset.blockId
      if (blockId) {
        event.preventDefault()
        event.stopPropagation()
        deleteImageBlock(blockId)
      }
      return
    }
    const handle = target.closest<HTMLElement>('[data-image-resize-handle]')
    if (!handle) return
    const figure = handle.closest<HTMLElement>('figure[data-v2-type="image"][data-block-id]')
    const image = figure?.querySelector<HTMLImageElement>('img')
    const blockId = figure?.dataset.blockId
    const container = figure?.parentElement
    if (!figure || !image || !blockId || !container) return
    event.preventDefault()
    event.stopPropagation()
    pushEditorHistory()
    setSelectedBlockId(blockId)
    const side = handle.dataset.imageResizeHandle
    const startX = Number(event.clientX)
    const startWidth = image.getBoundingClientRect().width
    const containerWidth = Math.max(240, container.getBoundingClientRect().width)
    let latestPercent = Math.max(20, Math.min(100, Number(figure.dataset.widthPercent || 0) || (startWidth / containerWidth) * 100))
    const move = (moveEvent: PointerEvent) => {
      const delta = side === 'start' ? startX - moveEvent.clientX : moveEvent.clientX - startX
      latestPercent = Math.max(20, Math.min(100, ((startWidth + delta) / containerWidth) * 100))
      figure.dataset.widthPercent = String(Math.round(latestPercent))
      figure.dataset.widthPx = ''
      figure.style.maxWidth = `${latestPercent}%`
      image.style.maxWidth = '100%'
    }
    const up = () => {
      window.document.removeEventListener('pointermove', move)
      window.document.removeEventListener('pointerup', up)
      resizeImageBlock(blockId, Math.round(latestPercent))
    }
    window.document.addEventListener('pointermove', move)
    window.document.addEventListener('pointerup', up, { once: true })
  }, [deleteImageBlock, pushEditorHistory, resizeImageBlock])

  const handleEditorSurfaceClick = useCallback((event: any) => {
    const target = event.target as HTMLElement
    const deleteButton = target.closest<HTMLElement>('[data-image-delete="true"]')
    if (deleteButton) {
      const figure = deleteButton.closest<HTMLElement>('figure[data-v2-type="image"][data-block-id]')
      const blockId = figure?.dataset.blockId
      if (blockId) {
        event.preventDefault()
        event.stopPropagation()
        deleteImageBlock(blockId)
      }
      return
    }
    updateSelectedBlockFromDom()
  }, [deleteImageBlock, updateSelectedBlockFromDom])

  const applyAutoCaptions = useCallback(() => {
    const root = editorSurfaceRef.current
    if (!root) return
    const figures = Array.from(root.querySelectorAll<HTMLElement>('figure[data-v2-type="image"][data-block-id]'))
    const changes: string[] = []
    figures.forEach(figure => {
      let caption = figure.querySelector<HTMLElement>('figcaption[data-image-caption], figcaption')
      const existingCaption = normalizeBookTextV2(caption?.innerText || caption?.textContent || '')
      if (existingCaption.trim()) return
      const next = figure.nextElementSibling as HTMLElement | null
      if (!next) return
      const tag = next.tagName.toLowerCase()
      if (!['p', 'div'].includes(tag)) return
      if (next.matches('[data-page-break="true"], figure, table, ol, ul, h1, h2, h3, h4, h5, h6')) return
      const candidateText = normalizeBookTextV2(next.innerText || next.textContent || '')
      if (!isAutoCaptionCandidateTextV2(candidateText)) return
      if (!caption) {
        caption = window.document.createElement('figcaption')
        caption.contentEditable = 'true'
        caption.dataset.imageCaption = 'true'
        caption.dataset.placeholder = 'کپشن تصویر را اینجا بنویسید'
        figure.appendChild(caption)
      }
      if (!changes.length) pushEditorHistory()
      caption.dataset.autoCaption = 'true'
      figure.dataset.autoCaption = 'true'
      while (next.firstChild) caption.appendChild(next.firstChild)
      next.remove()
      changes.push(figure.dataset.blockId || '')
    })
    if (!changes.length) {
      setMediaMessage('کپشن تازه‌ای برای انتقال پیدا نشد.')
      return
    }
    setSelectedBlockId(changes[0])
    markEditorDirty()
    scheduleToolbarDocumentRefresh()
    setMediaMessage(`${changes.length.toLocaleString('fa-IR')} کپشن به‌صورت خودکار تشخیص داده شد.`)
  }, [markEditorDirty, pushEditorHistory, scheduleToolbarDocumentRefresh])

  const resolveMediaIssue = useCallback((ref: EditorMediaReferenceV2) => {
    commitDocument(current => {
      const assets = current.assets.map(asset => asset.id === ref.assetId ? { ...asset, status: 'ready' as const, issue: undefined, caption: asset.caption || ref.caption || 'تصویر کتاب' } : asset)
      const pages = current.pages.map(page => ({
        ...page,
        blocks: mapBlocksV2(page.blocks, block => {
          if (block.type === 'image' && (block.id === ref.blockId || block.imageId === ref.assetId)) {
            return { ...block, status: 'ready', issue: undefined, caption: block.caption || ref.caption || 'تصویر کتاب' }
          }
          return block
        }),
      }))
      return rebuildDocumentTocV2({ ...current, assets, pages })
    })
  }, [commitDocument])

  const jumpToEditorBlock = useCallback((blockId: string) => {
    setSelectedBlockId(blockId)
    window.setTimeout(() => {
      editorSurfaceRef.current?.querySelector<HTMLElement>(`[data-block-id="${blockId.replace(/"/g, '\\"')}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 30)
  }, [])

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

  const scrollToPageBreak = useCallback((direction: 'previous' | 'next') => {
    const pageBreaks = Array.from(editorSurfaceRef.current?.querySelectorAll<HTMLElement>('.editor-v2-flow-page-break') || [])
    if (!pageBreaks.length) {
      window.scrollBy({ left: 0, top: window.innerHeight * (direction === 'next' ? 0.72 : -0.72), behavior: 'smooth' })
      return
    }
    const viewportAnchor = window.scrollY + (window.innerHeight * 0.5)
    const threshold = Math.max(32, window.innerHeight * 0.04)
    const withTop = pageBreaks.map(element => ({ element, top: element.getBoundingClientRect().top + window.scrollY }))
    const target = direction === 'next'
      ? withTop.find(item => item.top > viewportAnchor + threshold)
      : [...withTop].reverse().find(item => item.top < viewportAnchor - threshold)
    const fallback = direction === 'next' ? withTop[withTop.length - 1] : withTop[0]
    ;(target || fallback)?.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
          <Button className={`editor-v2-manual-save ${saveButtonClass}`} onClick={() => void saveDocument({ manual: true })} disabled={saveState === 'saving'} title={saveButtonTitle}>
            <span className="editor-v2-save-button-icon">
              {visualSaveState === 'saving' ? <Loader2 size={17} /> : <Save size={17} />}
              {visualSaveState === 'saved' && <Check size={10} className="editor-v2-save-button-check" />}
            </span>
            {visualSaveState === 'saving' && saveProgress !== null && <span className="editor-v2-save-progress" style={{ '--save-progress': `${saveProgress}%` } as CSSProperties} />}
            ذخیره دستی
            {visualSaveState === 'dirty' && autoSaveCountdownLabel && <span className="editor-v2-save-countdown">{autoSaveCountdownLabel} ثانیه</span>}
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
        <RightPanelV2
          document={document}
          selectedBlock={selectedBlock}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          activeTocId={activeTocId}
          onJumpToToc={jumpToToc}
          onInsertImage={insertImageFromAsset}
          onUploadImage={insertUploadedImage}
          onGenerateImage={generateImageFromPrompt}
          onAutoCaption={applyAutoCaptions}
          mediaMessage={mediaMessage}
          onResolveMediaIssue={resolveMediaIssue}
          onJumpToBlock={jumpToEditorBlock}
          canLinkImageRef={hasTextSelection}
          onLinkImageRef={applyImageReferenceToSelection}
          onApplyTextLink={applyTextLinkToSelection}
          onRemoveTextLink={removeTextLinkFromSelection}
          onInsertInteractive={insertInteractiveBlock}
          onApplyCallout={wrapSelectedCallout}
          onUnwrapCallout={unwrapSelectedCallout}
          canUnwrapCallout={selectedBlock?.type === 'callout'}
          onAiEnhance={requestAiEnhance}
          aiBusy={aiBusy}
          aiMessage={aiMessage}
        />
        <main
          className="editor-v2-canvas"
          ref={canvasRef}
          onClick={event => {
            const target = event.target as HTMLElement
            const unwrapButton = target.closest<HTMLElement>('[data-callout-unwrap="true"]')
            if (unwrapButton) {
              event.preventDefault()
              const callout = unwrapButton.closest<HTMLElement>('section.editor-v2-callout[data-v2-type="callout"]')
              if (callout) unwrapCalloutElement(callout)
              return
            }
            if (target.closest('.editor-v2-paper, .editor-v2-toolbar, [data-block-id]')) return
            setSelectedBlockId(undefined)
          }}
        >
          <TextToolbarV2
            toolbarState={toolbarState}
            rememberEditorSelection={rememberEditorSelection}
            execTextCommand={execTextCommand}
            formatCurrentBlock={formatCurrentBlock}
            applyInlineStyleToSelection={applyInlineStyleToSelection}
            applyRegularToSelection={applyRegularToSelection}
            applyBlockAlignment={applyBlockAlignment}
            setCurrentBlockDirection={setCurrentBlockDirection}
            createLinkForSelection={createLinkForSelection}
            insertSimpleTable={insertSimpleTable}
            onPreview={() => openReaderPreview(book.id, `/edit-v2/${book.id}`)}
          />

          <div className="editor-v2-paper">
            <div
              ref={editorSurfaceRef}
              className="editor-v2-flow-editor"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBeforeInput={handleEditorBeforeInput}
              onKeyDown={handleEditorKeyDown}
              onCopy={handleEditorCopy}
              onCut={handleEditorCut}
              onPaste={handleEditorPaste}
              onDrop={handleEditorDrop}
              onPointerDown={handleImageResizePointerDown}
              onClick={handleEditorSurfaceClick}
              onInput={handleEditorSurfaceInput}
              onChange={handleEditorSurfaceInput}
              onMouseUp={updateSelectedBlockFromDom}
              onKeyUp={updateSelectedBlockFromDom}
              onFocus={updateSelectedBlockFromDom}
            />
          </div>
        </main>
      </div>

      <div className="editor-v2-floating">
        <button type="button" onClick={scrollToTop} aria-label="برگشت به ابتدای ادیتور">↑</button>
        <button type="button" onClick={() => scrollToPageBreak('previous')} aria-label="صفحه قبلی"><ChevronRight size={18} /></button>
        <button type="button" onClick={() => scrollToPageBreak('next')} aria-label="صفحه بعدی"><ChevronLeft size={18} /></button>
        <button
          type="button"
          className={`editor-v2-floating-save ${saveButtonClass}`}
          onClick={() => void saveDocument({ manual: true })}
          disabled={saveState === 'saving'}
          aria-label={saveButtonTitle}
          title={saveButtonTitle}
        >
          <span className="editor-v2-save-icon">
            {visualSaveState === 'saving' ? <Loader2 size={17} /> : <Save size={17} />}
            {visualSaveState === 'saved' && <Check size={11} className="editor-v2-save-check" />}
          </span>
          {visualSaveState === 'saving' && saveProgress !== null && <span className="editor-v2-floating-save-progress" style={{ '--save-progress': `${saveProgress}%` } as CSSProperties} />}
          {visualSaveState === 'dirty' && autoSaveCountdownLabel && <span className="editor-v2-floating-save-countdown">{autoSaveCountdownLabel}</span>}
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



