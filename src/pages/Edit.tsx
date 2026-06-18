/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import { AlertTriangle, AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, BookOpen, Bookmark, ChevronLeft, ChevronUp, Edit3, Eye, FileImage, Heading1, Heading2, ImagePlus, Images, Italic, LayoutTemplate, Link2, List, ListOrdered, Minus, PanelTopClose, Plus, Redo2, Save, Strikethrough, Subscript as SubIcon, Superscript as SuperIcon, Table2, Trash2, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findPublisherBook, updatePublisherBook } from '@/lib/publisher-books'
import { findBookById } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'
import { useAuthContext } from '@/lib/auth-context'
import { bookTextDirection, inlineToHtml as sharedInlineToHtml, normalizeBookText, pageBreakHtml } from '@/lib/book-content'

const escape = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const encodePayload = (value: unknown) => encodeURIComponent(JSON.stringify(value))
const decodePayload = (value = '') => { try { return JSON.parse(decodeURIComponent(value)) } catch { return {} } }
const appPath = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/${path.replace(/^\//, '')}`
const openBookPreview = (id: string) => window.open(appPath(`/read/${id}`), '_blank', 'noopener,noreferrer')

const RichTextStyle = Extension.create({
  name: 'richTextStyle',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: {
      fontFamily: { default: null, parseHTML: element => element.style.fontFamily, renderHTML: attrs => attrs.fontFamily ? { style: `font-family:${attrs.fontFamily}` } : {} },
      fontSize: { default: null, parseHTML: element => element.style.fontSize, renderHTML: attrs => attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {} },
    } }]
  },
})

const BlockFormatting = Extension.create({
  name: 'blockFormatting',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        dir: { default: null, parseHTML: element => element.getAttribute('dir'), renderHTML: attrs => attrs.dir ? { dir: attrs.dir } : {} },
        semantic: { default: null, parseHTML: element => element.getAttribute('data-semantic'), renderHTML: attrs => attrs.semantic ? { 'data-semantic': attrs.semantic, class: `editor-${attrs.semantic}` } : {} },
        fontSizePt: {
          default: null,
          parseHTML: element => element.style.fontSize?.endsWith('pt') ? Number.parseFloat(element.style.fontSize) : null,
          renderHTML: attrs => attrs.fontSizePt ? { style: `font-size:${attrs.fontSizePt}pt` } : {},
        },
        blockColor: { default: null, parseHTML: element => element.style.color || null, renderHTML: attrs => attrs.blockColor ? { style: `color:${attrs.blockColor}` } : {} },
        blockBold: { default: null, parseHTML: element => ['bold', '700', '800', '900'].includes(element.style.fontWeight), renderHTML: attrs => attrs.blockBold ? { style: 'font-weight:800' } : {} },
        blockItalic: { default: null, parseHTML: element => element.style.fontStyle === 'italic', renderHTML: attrs => attrs.blockItalic ? { style: 'font-style:italic' } : {} },
      },
    }]
  },
})

const CitationMark = Mark.create({
  name: 'citationMark',
  inclusive: false,
  addAttributes() {
    return {
      footnoteId: { default: null, parseHTML: element => element.getAttribute('data-footnote-id'), renderHTML: attrs => attrs.footnoteId ? { 'data-footnote-id': attrs.footnoteId } : {} },
      footnoteText: { default: null, parseHTML: element => element.getAttribute('data-footnote-text') || element.getAttribute('title'), renderHTML: attrs => attrs.footnoteText ? { 'data-footnote-text': attrs.footnoteText, 'data-tooltip-dir': bookTextDirection(attrs.footnoteText), dir: bookTextDirection(attrs.footnoteText), title: attrs.footnoteText } : {} },
      referenceText: { default: null, parseHTML: element => element.getAttribute('data-reference-text') || element.getAttribute('title'), renderHTML: attrs => attrs.referenceText ? { 'data-reference-text': attrs.referenceText, 'data-tooltip-dir': bookTextDirection(attrs.referenceText), dir: bookTextDirection(attrs.referenceText), title: attrs.referenceText } : {} },
      referenceAnchor: { default: null, parseHTML: element => element.getAttribute('data-reference-anchor'), renderHTML: attrs => attrs.referenceAnchor ? { 'data-reference-anchor': attrs.referenceAnchor } : {} },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-footnote-id]' }, { tag: 'span[data-reference-text]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const className = HTMLAttributes['data-footnote-id'] ? 'citation-reference footnote-reference' : 'citation-reference'
    return ['span', mergeAttributes(HTMLAttributes, { class: className }), 0]
  },
})

const ProtectedPageBreak = Node.create({
  name: 'horizontalRule',
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML() {
    return [{ tag: 'hr' }]
  },
  addAttributes() {
    return {
      before: { default: null, parseHTML: element => element.getAttribute('data-before'), renderHTML: attrs => attrs.before ? { 'data-before': attrs.before } : {} },
      after: { default: null, parseHTML: element => element.getAttribute('data-after'), renderHTML: attrs => attrs.after ? { 'data-after': attrs.after } : {} },
      pageLabel: { default: null, parseHTML: element => element.getAttribute('data-page-label'), renderHTML: attrs => attrs.pageLabel ? { 'data-page-label': attrs.pageLabel } : {} },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { class: 'book-page-break', 'data-page-break': 'true', contenteditable: 'false' })]
  },
  addCommands() {
    return {
      setHorizontalRule: () => ({ commands }) => commands.insertContent({ type: this.name }),
    }
  },
})

const PreservePageBreaks = Extension.create({
  name: 'preservePageBreaks',
  addProseMirrorPlugins() {
    return [new Plugin({
      filterTransaction: (transaction, state) => {
        if ((window as any).__metabookiAllowPageBreakChange) return true
        if (!transaction.docChanged) return true
        const countBreaks = (doc: typeof state.doc) => {
          let count = 0
          doc.descendants(node => { if (node.type.name === 'horizontalRule') count += 1 })
          return count
        }
        return countBreaks(transaction.doc) >= countBreaks(state.doc)
      },
    })]
  },
})

const InteractiveBlock = Node.create({
  name: 'interactiveBlock',
  group: 'block',
  atom: true,
  addAttributes() { return { kind: { default: 'quiz' }, payload: { default: '{}' } } },
  parseHTML() { return [{ tag: 'section[data-interactive-kind]' }] },
  renderHTML({ HTMLAttributes }) {
    const data = decodePayload(HTMLAttributes.payload)
    return ['section', mergeAttributes(HTMLAttributes, { class: 'editor-interactive-block', 'data-interactive-kind': HTMLAttributes.kind }), ['strong', `بخش تعاملی: ${interactiveLabel(HTMLAttributes.kind)}`], ...interactivePreview(HTMLAttributes.kind, data)]
  },
})

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('width') || element.style.width || '100%',
        renderHTML: attrs => ({ width: attrs.width, style: `width:${attrs.width};max-width:100%;height:auto` }),
      },
      imageId: { default: null, parseHTML: element => element.getAttribute('data-image-id'), renderHTML: attrs => attrs.imageId ? { 'data-image-id': attrs.imageId } : {} },
      printPage: { default: null, parseHTML: element => element.getAttribute('data-print-page'), renderHTML: attrs => attrs.printPage ? { 'data-print-page': attrs.printPage } : {} },
      conversionStatus: { default: null, parseHTML: element => element.getAttribute('data-conversion-status'), renderHTML: attrs => attrs.conversionStatus ? { 'data-conversion-status': attrs.conversionStatus } : {} },
    }
  },
})

const INTERACTIVE_TYPES = [
  ['flashcard', 'فلش‌کارت'], ['steps', 'مرحله‌سازی'], ['gallery', 'گالری عکس'], ['scrollytelling', 'استوری‌تلینگ'],
  ['quiz', 'کوییز ساده'], ['timeline', 'تایم‌لاین'], ['hotspot', 'هات‌اسپات تعاملی'],
] as const
const TYPOGRAPHY_PRESETS = [
  ['lead', 'متن آغازین'],
  ['note', 'نکته'],
  ['quote', 'نقل‌قول'],
  ['definition', 'تعریف'],
  ['example', 'مثال'],
  ['summary', 'جمع‌بندی'],
  ['poetry', 'شعر'],
  ['aside', 'حاشیه'],
  ['normal', 'متن عادی'],
] as const
function interactiveLabel(kind: string) { return INTERACTIVE_TYPES.find(item => item[0] === kind)?.[1] || kind }
function interactiveTemplate(kind: string) {
  if (kind === 'quiz') return { type: kind, question: 'سؤال را اینجا بنویسید', options: ['گزینه صحیح', 'گزینه دوم', 'گزینه سوم'], correct: 0 }
  if (kind === 'timeline') return { type: kind, events: [{ year: 'مرحله ۱', title: 'شروع', description: 'توضیح مرحله نخست' }, { year: 'مرحله ۲', title: 'ادامه', description: 'توضیح مرحله دوم' }] }
  if (kind === 'scrollytelling') return { type: kind, steps: [{ image: '', text: 'بخش نخست روایت' }, { image: '', text: 'بخش دوم روایت' }] }
  if (kind === 'hotspot') return { type: kind, image: '', caption: 'تصویر هات‌اسپات', points: [{ x: 50, y: 50, title: 'نقطه ۱', text: 'توضیح این نقطه' }] }
  if (kind === 'flashcard') return { type: kind, cards: [{ front: 'روی کارت', back: 'پشت کارت' }] }
  if (kind === 'gallery') return { type: kind, images: [{ url: '', caption: 'تصویر گالری' }] }
  return { type: kind, title: 'فرآیند مرحله‌ای', steps: [{ title: 'مرحله ۱', description: 'توضیح مرحله نخست', image: '' }, { title: 'مرحله ۲', description: 'توضیح مرحله دوم', image: '' }] }
}
function interactivePreview(kind: string, data: any): any[] {
  if (kind === 'quiz') return [['h4', data.question || 'سؤال'], ['div', { class: 'editor-interactive-options' }, ...(data.options || []).map((option: string) => ['span', option])]]
  if (kind === 'gallery') return [['div', { class: 'editor-interactive-gallery' }, ...(data.images || []).map((image: any) => image.url ? ['img', { src: image.url, alt: image.caption || '' }] : ['span', image.caption || 'تصویر'])]]
  if (kind === 'hotspot') return [data.image ? ['img', { src: data.image, alt: data.caption || '' }] : ['span', data.caption || 'تصویر هات‌اسپات'], ['small', `${(data.points || []).length} نقطه تعاملی`]]
  const items = data.steps || data.events || data.cards || []
  if (items.length) return [['h4', data.title || data.caption || interactiveLabel(kind)], ['div', { class: 'editor-interactive-steps' }, ...items.map((item: any, index: number) => ['span', `${index + 1}. ${item.title || item.year || item.front || item.text || 'مرحله'}`])]]
  return [['span', data.title || data.question || data.caption || 'برای ویرایش جزئیات، این بخش را انتخاب کنید']]
}

function inlineHtml(block: any) {
  return sharedInlineToHtml(block.inline, block.content || block.text || block.expression || '')
}

function blockStyle(block: any) {
  const style = block.format || {}
  return [
    style.fontSizePt ? `font-size:${style.fontSizePt}pt` : '',
    style.color ? `color:#${style.color}` : '',
    style.bold ? 'font-weight:800' : '',
    style.italic ? 'font-style:italic' : '',
    style.alignment ? `text-align:${style.alignment}` : '',
  ].filter(Boolean).join(';')
}

function blockAttributes(block: any) {
  const attrs = [
    blockStyle(block) ? `style="${blockStyle(block)}"` : '',
    block.format?.direction ? `dir="${block.format.direction}"` : '',
    block.semantic ? `data-semantic="${escape(block.semantic)}"` : '',
  ].filter(Boolean).join(' ')
  return attrs ? ` ${attrs}` : ''
}

function legacyListFromText(text = '') {
  const lines = String(text).split(/\n+/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const ordered = lines.every(line => /^[\d۰-۹٠-٩]+[.)-]\s+/.test(line))
  const bullet = lines.every(line => /^[•●*-]\s+/.test(line))
  if (!ordered && !bullet) return null
  return {
    ordered,
    items: lines.map(line => line.replace(ordered ? /^[\d۰-۹٠-٩]+[.)-]\s+/ : /^[•●*-]\s+/, '')),
  }
}

function blockHtml(block: any) {
  if (block.type === 'heading') return `<h${Math.min(6, block.level || 2)}${blockAttributes(block)}>${inlineHtml(block)}</h${Math.min(6, block.level || 2)}>`
  if (block.type === 'table') return `<table><thead><tr>${(block.headers || []).map((cell: string) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${(block.rows || []).map((row: string[]) => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  if (block.type === 'image' && block.url) return `<img src="${escape(block.url)}" alt="${escape(block.caption || '')}" width="${block.widthPx ? `${block.widthPx}px` : block.widthPercent ? `${block.widthPercent}%` : '100%'}"${block.imageId ? ` data-image-id="${escape(block.imageId)}"` : ''}${block.printPage ? ` data-print-page="${escape(block.printPage)}"` : ''}${block.conversionStatus ? ` data-conversion-status="${escape(block.conversionStatus)}"` : ''}>${block.caption ? `<p data-semantic="caption">${escape(block.caption)}</p>` : ''}`
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul'
    return `<${tag}${blockAttributes(block)}>${(block.items || []).map((item: any) => `<li>${inlineHtml({ content: item.text, inline: item.inline })}</li>`).join('')}</${tag}>`
  }
  const legacyList = block.type === 'paragraph' ? legacyListFromText(block.content || block.text || '') : null
  if (legacyList) {
    const tag = legacyList.ordered ? 'ol' : 'ul'
    return `<${tag}${blockAttributes(block)}>${legacyList.items.map(item => `<li>${escape(item)}</li>`).join('')}</${tag}>`
  }
  if (['quiz', 'timeline', 'flashcard', 'steps', 'gallery', 'scrollytelling', 'hotspot'].includes(block.type)) return `<section data-interactive-kind="${block.type}" kind="${block.type}" payload="${encodePayload(block)}"></section>`
  return `<p${blockAttributes(block)}>${inlineHtml(block)}</p>`
}

function pagesToHtml(pages: any[] = []) {
  return pages.map((page, index) => {
    const separator = index ? pageBreakHtml(pages[index - 1], page) : ''
    return `${separator}${(page.blocks || []).map(blockHtml).join('')}`
  }).join('')
}

type EditorSegmentMode = 'chapter' | 'page'
type EditorSegment = { key: string; label: string; level?: number; start: number; end: number; startBlock?: number; endBlock?: number; page?: number; tocIndex?: number; isPrelude?: boolean }
type ConfirmedTocEntry = { id?: string; title: string; level: number; page?: number; styleId?: string }

function pageTitle(page: any, index: number) {
  return page?.title || page?.blocks?.find((block: any) => block.type === 'heading')?.content || `صفحه ${index + 1}`
}

function pageIndexForPrintPage(pages: any[] = [], printPage?: number) {
  if (!printPage) return 0
  const exact = pages.findIndex((page, index) => Number(page.printNumber || page.number || index + 1) === Number(printPage))
  return exact >= 0 ? exact : Math.max(0, Math.min(pages.length - 1, Number(printPage) - 1))
}

function findTocPosition(pages: any[] = [], item: ConfirmedTocEntry) {
  if (item.id) {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const blockIndex = (pages[pageIndex].blocks || []).findIndex((block: any) => block.anchor === item.id || block.id === item.id || block.anchors?.includes?.(item.id))
      if (blockIndex >= 0) return { pageIndex, blockIndex }
    }
  }
  const title = String(item.title || '').trim()
  if (title) {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const blockIndex = (pages[pageIndex].blocks || []).findIndex((block: any) => block.type === 'heading' && String(block.content || block.text || '').trim() === title)
      if (blockIndex >= 0) return { pageIndex, blockIndex }
    }
  }
  return { pageIndex: pageIndexForPrintPage(pages, item.page), blockIndex: 0 }
}

function confirmedTocFromBook(book: any): ConfirmedTocEntry[] {
  const toc = book?.metadata?.confirmed_toc
  if (!Array.isArray(toc)) return []
  return toc
    .filter((item: any) => item?.title)
    .map((item: any) => ({ id: item.id, title: item.title, level: Math.min(6, Math.max(1, Number(item.level || 1))), page: item.page, styleId: item.styleId }))
}

function buildConfirmedTocSegments(pages: any[] = [], toc: ConfirmedTocEntry[] = [], preludeTitle = 'ابتدای کتاب'): EditorSegment[] {
  if (!pages.length) return [{ key: 'empty', label: 'سند خالی', level: 1, start: 0, end: 0, startBlock: 0, endBlock: 0 }]
  if (!toc.length) return [{ key: 'all', label: 'کل متن کتاب', level: 1, start: 0, end: pages.length, startBlock: 0, endBlock: pages[pages.length - 1]?.blocks?.length || 0 }]
  const positions = toc.map(item => findTocPosition(pages, item))
  const segments: EditorSegment[] = []
  const first = positions[0]
  if (first && (first.pageIndex > 0 || first.blockIndex > 0)) {
    segments.push({
      key: 'prelude',
      label: preludeTitle || 'ابتدای کتاب',
      level: 1,
      start: 0,
      end: first.pageIndex + 1,
      startBlock: 0,
      endBlock: first.blockIndex,
      page: pages[0]?.printNumber || pages[0]?.number || 1,
      isPrelude: true,
    })
  }
  toc.forEach((item, index) => {
    const position = positions[index] || { pageIndex: 0, blockIndex: 0 }
    const nextIndex = toc.findIndex((nextItem, nextPosition) => nextPosition > index && Number(nextItem.level || 1) <= Number(item.level || 1))
    const nextPosition = nextIndex >= 0 ? positions[nextIndex] : null
    const endPageIndex = nextPosition ? nextPosition.pageIndex : pages.length - 1
    const endBlock = nextPosition ? nextPosition.blockIndex : (pages[endPageIndex]?.blocks?.length || 0)
    segments.push({
      key: item.id || `${index}-${item.title}`,
      label: item.title,
      level: item.level || 1,
      start: position.pageIndex,
      end: endPageIndex + 1,
      startBlock: position.blockIndex,
      endBlock,
      page: item.page || pages[position.pageIndex]?.printNumber || pages[position.pageIndex]?.number || position.pageIndex + 1,
      tocIndex: index,
    })
  })
  return segments
}

function segmentHasChildren(segments: EditorSegment[], index: number) {
  const level = Number(segments[index]?.level || 1)
  for (let cursor = index + 1; cursor < segments.length; cursor++) {
    const nextLevel = Number(segments[cursor]?.level || 1)
    if (nextLevel <= level) return false
    if (nextLevel > level) return true
  }
  return false
}

function buildTocTreeRows(segments: EditorSegment[], collapsedKeys: Set<string>) {
  let h1Counter = 0
  const hiddenByLevels: number[] = []
  return segments.map((segment, index) => {
    const level = Math.min(6, Math.max(1, Number(segment.level || 1)))
    while (hiddenByLevels.length && hiddenByLevels[hiddenByLevels.length - 1] >= level) hiddenByLevels.pop()
    const hidden = hiddenByLevels.length > 0
    const hasChildren = segmentHasChildren(segments, index)
    const collapsed = collapsedKeys.has(segment.key)
    if (!hidden && hasChildren && collapsed) hiddenByLevels.push(level)
    if (level === 1) h1Counter += 1
    return { segment, index, level, hidden, hasChildren, collapsed, h1Counter }
  })
}

function extractSegmentPages(pages: any[] = [], segment?: EditorSegment) {
  if (!segment) return []
  return pages.slice(segment.start, segment.end).map((page, index, selectedPages) => {
    const isFirst = index === 0
    const isLast = index === selectedPages.length - 1
    const from = isFirst ? (segment.startBlock ?? 0) : 0
    const to = isLast ? (segment.endBlock ?? (page.blocks || []).length) : (page.blocks || []).length
    return { ...page, blocks: (page.blocks || []).slice(from, to) }
  }).filter(page => (page.blocks || []).length)
}

function mergeSegmentPages(sourcePages: any[] = [], segment: EditorSegment | undefined, editedPages: any[]) {
  if (!segment) return sourcePages
  const before = sourcePages.slice(0, segment.start)
  const after = sourcePages.slice(segment.end)
  const selectedSource = sourcePages.slice(segment.start, segment.end)
  const preservePageMeta = (page: any, index: number) => {
    const source = selectedSource[index] || selectedSource[selectedSource.length - 1] || {}
    return {
      ...source,
      ...page,
      title: page.title || source.title,
      number: source.number ?? page.number ?? segment.start + index + 1,
      printNumber: source.printNumber ?? page.printNumber ?? source.number ?? page.number ?? segment.start + index + 1,
    }
  }
  const normalizedEditedPages = editedPages.map(preservePageMeta)
  const firstSource = sourcePages[segment.start] || { blocks: [] }
  const lastSource = sourcePages[Math.max(segment.start, segment.end - 1)] || firstSource
  const prefix = (firstSource.blocks || []).slice(0, segment.startBlock ?? 0)
  const suffix = (lastSource.blocks || []).slice(segment.endBlock ?? (lastSource.blocks || []).length)
  if (!normalizedEditedPages.length) return [...before, { ...firstSource, blocks: [...prefix, ...suffix] }, ...after]
  if (normalizedEditedPages.length === 1) {
    return [...before, { ...firstSource, ...normalizedEditedPages[0], blocks: [...prefix, ...(normalizedEditedPages[0].blocks || []), ...suffix] }, ...after]
  }
  const firstEdited = { ...firstSource, ...normalizedEditedPages[0], blocks: [...prefix, ...(normalizedEditedPages[0].blocks || [])] }
  const middleEdited = normalizedEditedPages.slice(1, -1)
  const lastEditedPage = normalizedEditedPages[normalizedEditedPages.length - 1]
  const lastEdited = { ...lastSource, ...lastEditedPage, blocks: [...(lastEditedPage.blocks || []), ...suffix] }
  return [...before, firstEdited, ...middleEdited, lastEdited, ...after]
}

function buildEditorSegments(pages: any[] = [], mode: EditorSegmentMode): EditorSegment[] {
  if (!pages.length) return [{ key: 'empty', label: 'سند خالی', start: 0, end: 0 }]
  if (mode === 'page') {
    return pages.map((page, index) => ({ key: `page-${index}`, label: pageTitle(page, index), start: index, end: index + 1 }))
  }
  const starts = pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => (page.blocks || []).some((block: any) => block.type === 'heading' && Number(block.level || 2) === 1))
    .map(({ index }) => index)
  const uniqueStarts = [...new Set(starts)]
  const boundaries = uniqueStarts[0] === 0 ? uniqueStarts : [0, ...uniqueStarts]
  if (!boundaries.length) boundaries.push(0)
  return boundaries.map((start, index) => {
    const end = boundaries[index + 1] ?? pages.length
    return { key: `chapter-${start}-${end}`, label: pageTitle(pages[start], start), start, end }
  })
}

function inlineFromNode(node: any) {
  return (node.content || []).flatMap((part: any) => {
    if (part.type === 'hardBreak') return [{ text: '\n' }]
    if (part.type !== 'text') return []
    const span: any = { text: normalizeBookText(part.text || '') }
    for (const mark of part.marks || []) {
      if (mark.type === 'bold') span.bold = true
      if (mark.type === 'italic') span.italic = true
      if (mark.type === 'superscript') span.superscript = true
      if (mark.type === 'subscript') span.subscript = true
      if (mark.type === 'link') span.href = mark.attrs?.href
      if (mark.type === 'citationMark') {
        if (mark.attrs?.footnoteId) span.footnoteId = mark.attrs.footnoteId
        if (mark.attrs?.footnoteText) span.footnoteText = mark.attrs.footnoteText
        if (mark.attrs?.referenceText) span.referenceText = mark.attrs.referenceText
        if (mark.attrs?.referenceAnchor) span.referenceAnchor = mark.attrs.referenceAnchor
      }
      if (mark.type === 'textStyle') {
        if (mark.attrs?.color) span.color = mark.attrs.color
        if (mark.attrs?.fontFamily) span.fontFamily = mark.attrs.fontFamily
        if (mark.attrs?.fontSize) span.fontSize = mark.attrs.fontSize
      }
    }
    return [span]
  })
}

function nodeText(node: any): string {
  return normalizeBookText((node.content || []).map((part: any) => part.text || nodeText(part)).join(''))
}

function inlineFromListItem(item: any) {
  return (item.content || []).flatMap((child: any) => child.type === 'paragraph' ? inlineFromNode(child) : [])
}

function editorJsonToPages(json: any) {
  const pages: any[] = [{ title: 'صفحه ۱', blocks: [] }]
  for (const node of json?.content || []) {
    if (node.type === 'horizontalRule') { pages.push({ title: `صفحه ${pages.length + 1}`, blocks: [] }); continue }
    const page = pages[pages.length - 1]
    const inline = inlineFromNode(node)
    const content = inline.map((span: any) => span.text).join('') || nodeText(node)
    if (node.type === 'heading') {
      page.blocks.push({ type: 'heading', level: node.attrs?.level || 2, content, inline, format: { alignment: node.attrs?.textAlign || undefined, direction: node.attrs?.dir || undefined, fontSizePt: node.attrs?.fontSizePt || undefined, color: node.attrs?.blockColor?.replace('#', '') || undefined, bold: node.attrs?.blockBold || undefined, italic: node.attrs?.blockItalic || undefined } })
      if (page.blocks.length === 1) page.title = content || page.title
    } else if (node.type === 'image') {
      const width = String(node.attrs?.width || '100%')
      page.blocks.push({ type: 'image', url: node.attrs?.src, caption: node.attrs?.alt || '', imageId: node.attrs?.imageId || undefined, printPage: node.attrs?.printPage || undefined, conversionStatus: node.attrs?.conversionStatus || undefined, ...(width.endsWith('%') ? { widthPercent: Number.parseFloat(width) } : { widthPx: Number.parseFloat(width) }) })
    }
    else if (node.type === 'interactiveBlock') page.blocks.push({ ...decodePayload(node.attrs?.payload), type: node.attrs?.kind })
    else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content || []).map((item: any) => {
        const itemInline = inlineFromListItem(item)
        return { text: itemInline.map((span: any) => span.text).join('') || nodeText(item), inline: itemInline }
      }).filter((item: any) => item.text || item.inline?.length)
      if (items.length) page.blocks.push({ type: 'list', ordered: node.type === 'orderedList', items, content: items.map((item: any) => item.text).join('\n') })
    }
    else if (node.type === 'table') {
      const rows = (node.content || []).map((row: any) => (row.content || []).map((cell: any) => nodeText(cell)))
      page.blocks.push({ type: 'table', headers: rows[0] || [], rows: rows.slice(1) })
    } else if (node.type === 'paragraph' && (content || inline.length)) page.blocks.push({ type: 'paragraph', content, inline, semantic: node.attrs?.semantic || undefined, format: { alignment: node.attrs?.textAlign || undefined, direction: node.attrs?.dir || undefined, fontSizePt: node.attrs?.fontSizePt || undefined, color: node.attrs?.blockColor?.replace('#', '') || undefined, bold: node.attrs?.blockBold || undefined, italic: node.attrs?.blockItalic || undefined } })
  }
  return pages.filter(page => page.blocks.length)
}

export default function Edit() {
  const { id = '' } = useParams<{ id: string }>()
  const { user } = useAuthContext()
  const localInitial = useMemo(() => findPublisherBook(id) || findBookById(id), [id])
  const [book, setBook] = useState<any>(localInitial)
  const [title, setTitle] = useState(localInitial?.title || '')
  const [subtitle, setSubtitle] = useState(localInitial?.subtitle || '')
  const [description, setDescription] = useState(localInitial?.description || '')
  const [preludeTitle, setPreludeTitle] = useState<string>(String(localInitial?.metadata?.prelude_title || 'ابتدای کتاب'))
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [allPages, setAllPages] = useState<any[]>(localInitial?.pages || [])
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
  const [headings, setHeadings] = useState<Array<{ text: string; level: number; pos: number }>>([])
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [backgroundAlpha, setBackgroundAlpha] = useState(0)
  const [imagePanelOpen, setImagePanelOpen] = useState(false)
  const [editingTocIndex, setEditingTocIndex] = useState<number | null>(null)
  const [editingTocTitle, setEditingTocTitle] = useState('')
  const [confirmTocDelete, setConfirmTocDelete] = useState<number | null>(null)
  const [collapsedTocKeys, setCollapsedTocKeys] = useState<Set<string>>(() => new Set())
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentStageRef = useRef<HTMLElement>(null)
  const switchingSegmentRef = useRef(false)
  const tocEntries = useMemo(() => confirmedTocFromBook(book), [book])
  const segments = useMemo(() => buildConfirmedTocSegments(allPages, tocEntries, preludeTitle), [allPages, tocEntries, preludeTitle])
  const tocTreeRows = useMemo(() => buildTocTreeRows(segments, collapsedTocKeys), [segments, collapsedTocKeys])
  const activeSegment = segments[Math.min(activeSegmentIndex, Math.max(0, segments.length - 1))] || segments[0]
  const bookImages = useMemo(() => {
    const pageImages = allPages.flatMap((page: any, pageIndex: number) => (page.blocks || [])
      .filter((block: any) => block.type === 'image')
      .map((block: any, blockIndex: number) => ({
        ...block,
        key: block.imageId || `${pageIndex}-${blockIndex}-${block.url || 'missing'}`,
        pageIndex,
        printPage: block.printPage || page.printNumber || page.number || pageIndex + 1,
        issue: !block.url ? 'تصویر در متن کتاب آدرس ندارد' : !block.caption ? 'کپشن برای این تصویر شناخته نشده' : block.conversionStatus === 'conversion-failed' ? 'تبدیل تصویر ناموفق بوده' : '',
      })))
    const knownIds = new Set(pageImages.map((image: any) => image.imageId).filter(Boolean))
    const metadataImages = Array.isArray(book?.metadata?.import_images) ? book.metadata.import_images : []
    const missingImages = metadataImages
      .filter((image: any) => image.conversionStatus === 'conversion-failed' && !knownIds.has(image.id))
      .map((image: any, index: number) => ({
        key: `failed-${image.id || index}`,
        imageId: image.id,
        url: '',
        caption: image.caption || image.originalName || image.name || 'تصویر تبدیل‌نشده',
        printPage: image.wordPages?.[0] || 'نامشخص',
        conversionStatus: image.conversionStatus,
        issue: image.conversionError || 'تصویر در تبدیل محلی/سروری آماده نشده است',
      }))
    return [...pageImages, ...missingImages]
  }, [allPages, book?.metadata])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }), ProtectedPageBreak, PreservePageBreaks, CitationMark, Underline, Subscript, Superscript, ResizableImage.configure({ allowBase64: true }), Link.configure({ openOnClick: false }),
      TextStyle, Color, RichTextStyle, BlockFormatting, InteractiveBlock, TableKit.configure({ table: { resizable: true } }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: pagesToHtml((localInitial?.pages || []).slice(0, 1)),
    editorProps: { attributes: { class: 'book-document-prose', dir: 'rtl', spellcheck: 'true' } },
  })

  const getEditor = () => editor && !editor.isDestroyed ? editor : null

  const refreshHeadings = () => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    const result: Array<{ text: string; level: number; pos: number }> = []
    activeEditor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') result.push({ text: node.textContent, level: node.attrs.level, pos }) })
    setHeadings(result)
  }

  const mergeCurrentSegment = (sourcePages = allPages) => {
    const activeEditor = getEditor()
    if (!activeEditor || !activeSegment) return sourcePages
    const editedPages = editorJsonToPages(activeEditor.getJSON())
    return mergeSegmentPages(sourcePages, activeSegment, editedPages)
  }

  const loadSegment = (segment: EditorSegment | undefined, pages = allPages) => {
    const activeEditor = getEditor()
    if (!activeEditor || !segment) return
    switchingSegmentRef.current = true
    ;(window as any).__metabookiAllowPageBreakChange = true
    activeEditor.commands.setContent(pagesToHtml(extractSegmentPages(pages, segment)))
    window.setTimeout(() => {
      refreshHeadings()
      switchingSegmentRef.current = false
      ;(window as any).__metabookiAllowPageBreakChange = false
      documentStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const changeActiveSegment = (index: number) => {
    const merged = mergeCurrentSegment()
    const nextSegments = buildConfirmedTocSegments(merged, tocEntries, preludeTitle)
    const nextIndex = Math.max(0, Math.min(nextSegments.length - 1, index))
    setAllPages(merged)
    setActiveSegmentIndex(nextIndex)
    window.setTimeout(() => loadSegment(nextSegments[nextIndex], merged), 0)
  }

  useEffect(() => {
    if (localInitial || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) return
    ;(supabase as any).from('books').select('*').eq('id', id).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return
      setBook(data); setTitle(data.title); setSubtitle(data.subtitle || ''); setDescription(data.description || ''); setPreludeTitle(data.metadata?.prelude_title || 'ابتدای کتاب')
      setBackgroundUrl(data.metadata?.page_background_url || ''); setBackgroundAlpha(Number(data.metadata?.page_background_alpha || 0))
      setAllPages(data.pages || [])
      setActiveSegmentIndex(0)
      loadSegment(buildConfirmedTocSegments(data.pages || [], confirmedTocFromBook(data), data.metadata?.prelude_title || 'ابتدای کتاب')[0], data.pages || [])
    })
  }, [editor, id, localInitial])

  useEffect(() => {
    if (!editor) return
    loadSegment(activeSegment, allPages)
  }, [editor])

  useEffect(() => {
    if (activeSegmentIndex <= segments.length - 1) return
    setActiveSegmentIndex(Math.max(0, segments.length - 1))
  }, [activeSegmentIndex, segments.length])

  const save = async (quiet = false) => {
    const activeEditor = getEditor()
    if (!activeEditor || !id) return
    setSaving(true)
    const pages = mergeCurrentSegment()
    const metadata = { ...(book?.metadata || {}), page_background_url: backgroundUrl, page_background_alpha: backgroundAlpha, prelude_title: preludeTitle }
    const patch = { title, subtitle, description, pages, metadata, page_count: pages.length, content_updated_at: new Date().toISOString() }
    updatePublisherBook(id, patch as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      await (supabase as any).from('books').update({ title, subtitle, description, pages, metadata, content_updated_at: patch.content_updated_at }).eq('id', id)
    }
    setAllPages(pages); setBook((current: any) => ({ ...current, ...patch })); setSavedAt(new Date()); setSaving(false); refreshHeadings()
    if (!quiet) activeEditor.commands.focus()
  }

  const previewCurrentBook = async () => {
    const previewUrl = appPath(`/read/${id}`)
    const previewWindow = window.open('about:blank', '_blank')
    await save(true)
    if (previewWindow) {
      previewWindow.opener = null
      previewWindow.location.href = previewUrl
      return
    }
    openBookPreview(id)
  }

  useEffect(() => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    const onUpdate = () => {
      if (switchingSegmentRef.current) return
      window.clearTimeout((onUpdate as any).timer)
      ;(onUpdate as any).timer = window.setTimeout(() => save(true), 1400)
    }
    activeEditor.on('update', onUpdate)
    return () => { activeEditor.off('update', onUpdate); window.clearTimeout((onUpdate as any).timer) }
  })

  if (!book && !localInitial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">در حال دریافت پیش‌نویس کتاب…</h1></div>

  const command = (action: (activeEditor: NonNullable<typeof editor>) => void) => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    action(activeEditor)
    activeEditor.commands.focus()
  }
  const addInteractive = (kind: string) => command(activeEditor => activeEditor.chain().focus().insertContent({ type: 'interactiveBlock', attrs: { kind, payload: encodePayload(interactiveTemplate(kind)) } }).run())
  const editInteractive = () => {
    if (!editor?.isActive('interactiveBlock')) return
    const attrs = editor.getAttributes('interactiveBlock') as { kind: string; payload: string }
    const payload = decodePayload(attrs.payload)
    if (attrs.kind === 'quiz') {
      const question = window.prompt('متن سؤال', payload.question || '') ?? payload.question
      const optionsText = window.prompt('گزینه‌ها؛ هر گزینه در یک خط', (payload.options || []).join('\n'))
      payload.question = question
      if (optionsText) payload.options = optionsText.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
      const correct = window.prompt('شماره گزینه صحیح', String((payload.correct ?? 0) + 1))
      if (correct && !Number.isNaN(Number(correct))) payload.correct = Math.max(0, Number(correct) - 1)
    } else {
      const title = window.prompt('عنوان بخش تعاملی', payload.title || payload.caption || interactiveLabel(attrs.kind))
      if (title !== null) payload.title = title
    }
    editor.chain().focus().updateAttributes('interactiveBlock', { payload: encodePayload(payload) }).run()
  }
  const openInteractiveEditor = async () => {
    if (!editor?.isActive('interactiveBlock')) return
    const attrs = editor.getAttributes('interactiveBlock') as { kind: string; payload: string }
    const payload = decodePayload(attrs.payload)
    if (attrs.kind === 'quiz') {
      const question = window.prompt('متن سوال', payload.question || '') ?? payload.question
      const optionsText = window.prompt('گزینه‌ها؛ هر گزینه در یک خط', (payload.options || []).join('\n'))
      payload.question = question
      if (optionsText) payload.options = optionsText.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
      const correct = window.prompt('شماره گزینه صحیح', String((payload.correct ?? 0) + 1))
      if (correct && !Number.isNaN(Number(correct))) payload.correct = Math.max(0, Number(correct) - 1)
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'timeline') {
      const rawEvents = window.prompt('رویدادها؛ هر خط به شکل عنوان | توضیح | زمان', (payload.events || []).map((event: any) => `${event.title || ''} | ${event.description || ''} | ${event.year || ''}`).join('\n'))
      if (rawEvents) payload.events = rawEvents.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ title: parts[0], description: parts[1] || '', year: parts[2] || '' }))
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'gallery') {
      const rawImages = window.prompt('کپشن‌های گالری؛ هر خط یک کپشن', (payload.images || []).map((image: any) => image.caption || '').join('\n'))
      if (rawImages) payload.images = rawImages.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean).map((caption: string, index: number) => ({ url: payload.images?.[index]?.url || '', caption }))
      if (window.confirm('می‌خواهید یک تصویر جدید هم به گالری اضافه کنید؟')) await insertImageIntoInteractive(attrs)
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'flashcard') {
      const rawCards = window.prompt('فلش‌کارت‌ها؛ هر خط به شکل روی کارت | پشت کارت', (payload.cards || []).map((card: any) => `${card.front || ''} | ${card.back || ''}`).join('\n'))
      if (rawCards) payload.cards = rawCards.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ front: parts[0], back: parts[1] || '' }))
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'scrollytelling' || attrs.kind === 'steps') {
      const rawSteps = window.prompt('مرحله‌ها؛ هر خط به شکل عنوان | توضیح', (payload.steps || []).map((step: any) => `${step.title || step.text || ''} | ${step.description || ''}`).join('\n'))
      if (rawSteps) {
        payload.steps = rawSteps.split(/\r?\n/).map((line: string, index: number) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[], index: number) => ({
          ...(payload.steps?.[index] || {}),
          title: attrs.kind === 'steps' ? parts[0] : undefined,
          text: attrs.kind === 'scrollytelling' ? parts[0] : undefined,
          description: parts[1] || '',
        }))
      }
      if (window.confirm('می‌خواهید برای مرحله نخست تصویر هم اضافه کنید؟')) await insertImageIntoInteractive(attrs)
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'hotspot') {
      const caption = window.prompt('عنوان یا کپشن تصویر', payload.caption || payload.title || '') ?? payload.caption
      const rawPoints = window.prompt('نقاط تعاملی؛ هر خط به شکل عنوان | توضیح | x | y', (payload.points || []).map((point: any) => `${point.title || ''} | ${point.text || ''} | ${point.x ?? 50} | ${point.y ?? 50}`).join('\n'))
      payload.caption = caption
      if (rawPoints) payload.points = rawPoints.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ title: parts[0], text: parts[1] || '', x: Number(parts[2] || 50), y: Number(parts[3] || 50) }))
      if (window.confirm('می‌خواهید تصویر اصلی هات‌اسپات را هم تغییر دهید؟')) await insertImageIntoInteractive(attrs)
      updateInteractivePayload(attrs, payload)
      return
    }
    const title = window.prompt('عنوان بخش تعاملی', payload.title || payload.caption || interactiveLabel(attrs.kind))
    if (title !== null) payload.title = title
    updateInteractivePayload(attrs, payload)
  }
  const prepareEditorImage = async (file: File) => {
    let src = ''
    if (user && import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
      const path = `${user.id}/${id}/editor/${Date.now()}-${file.name.replace(/[^\p{L}\p{N}._-]+/gu, '-')}`
      const uploaded = await (supabase as any).storage.from('book-imports').upload(path, file, { upsert: true, contentType: file.type })
      if (!uploaded.error) src = (await (supabase as any).storage.from('book-imports').createSignedUrl(path, 60 * 60 * 24 * 365)).data?.signedUrl || ''
    }
    if (!src) src = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file) })
    return src
  }
  const addImage = async (file: File) => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    const src = await prepareEditorImage(file)
    activeEditor.chain().focus().setImage({ src, alt: file.name, width: '100%' } as any).run()
  }
  const promoteSelection = (level: 1 | 2 | 3 | 4 | 5 | 6) => { command(activeEditor => activeEditor.chain().focus().toggleHeading({ level }).run()); window.setTimeout(refreshHeadings, 20) }
  const setDirection = (direction: 'rtl' | 'ltr') => command(activeEditor => activeEditor.chain().focus().updateAttributes(activeEditor.isActive('heading') ? 'heading' : 'paragraph', { dir: direction }).run())
  const setLink = () => {
    if (!editor) return
    const current = editor.getAttributes('link').href || ''
    const href = window.prompt('آدرس پیوند', current)
    if (href === null) return
    if (!href.trim()) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }
  const setTypography = (semantic: string) => {
    command(activeEditor => activeEditor.chain().focus().updateAttributes(activeEditor.isActive('heading') ? 'heading' : 'paragraph', { semantic: semantic === 'normal' ? null : semantic }).run())
  }
  const updateInteractivePayload = (attrs: { kind: string; payload: string }, payload: Record<string, unknown>) => {
    command(activeEditor => activeEditor.chain().focus().updateAttributes('interactiveBlock', { kind: attrs.kind, payload: encodePayload(payload) }).run())
  }
  const insertImageIntoInteractive = async (attrs: { kind: string; payload: string }) => {
    const selected = await new Promise<File | null>(resolve => {
      const picker = document.createElement('input')
      picker.type = 'file'
      picker.accept = 'image/*'
      picker.onchange = () => resolve(picker.files?.[0] || null)
      picker.click()
    })
    if (!selected) return null
    const src = await prepareEditorImage(selected)
    applyImageToInteractive(src)
    return src
  }
  const applyImageToInteractive = (url: string) => {
    const activeEditor = getEditor()
    if (!activeEditor?.isActive('interactiveBlock') || !url) return
    const attrs = activeEditor.getAttributes('interactiveBlock') as { kind: string; payload: string }
    const payload = decodePayload(attrs.payload)
    if (attrs.kind === 'gallery') payload.images = [...(payload.images || []), { url, caption: 'تصویر انتخاب‌شده از کتاب' }]
    else if (attrs.kind === 'scrollytelling') payload.steps = (payload.steps || [{ text: 'روایت تصویری' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else if (attrs.kind === 'steps') payload.steps = (payload.steps || [{ title: 'مرحله ۱' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else payload.image = url
    activeEditor.chain().focus().updateAttributes('interactiveBlock', { payload: encodePayload(payload) }).run()
  }
  const tableAction = (action: string) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (action === 'row-after') chain.addRowAfter().run()
    if (action === 'column-after') chain.addColumnAfter().run()
    if (action === 'delete-row') chain.deleteRow().run()
    if (action === 'delete-column') chain.deleteColumn().run()
    if (action === 'delete-table') chain.deleteTable().run()
  }
  const changeHeadingLevel = (pos: number, value: string) => {
    if (!editor) return
    const chain = editor.chain().focus().setTextSelection(pos + 1)
    if (value === 'body') chain.setParagraph().run()
    else chain.setHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
    window.setTimeout(refreshHeadings, 20)
  }
  const shiftHeadingLevel = (pos: number, delta: -1 | 1) => {
    const heading = headings.find(item => item.pos === pos)
    if (!heading) return
    changeHeadingLevel(pos, String(Math.min(6, Math.max(1, heading.level + delta))))
  }
  const removeHeadingFromToc = (pos: number) => changeHeadingLevel(pos, 'body')
  const renameHeading = (pos: number, currentText: string) => {
    if (!editor) return
    const nextText = window.prompt('عنوان جدید این سرفصل', currentText)
    if (nextText === null || nextText.trim() === currentText.trim()) return
    const heading = headings.find(item => item.pos === pos)
    if (!heading) return
    editor.chain().focus().setTextSelection({ from: pos + 1, to: pos + 1 + heading.text.length }).insertContent(nextText.trim()).run()
    window.setTimeout(refreshHeadings, 20)
  }
  const persistTocEntries = (nextToc: ConfirmedTocEntry[]) => {
    const metadata = { ...(book?.metadata || {}), confirmed_toc: nextToc }
    setBook((current: any) => ({ ...current, metadata }))
    updatePublisherBook(id, { metadata } as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      void (supabase as any).from('books').update({ metadata }).eq('id', id)
    }
  }
  const persistPreludeTitle = (nextTitle: string) => {
    const cleanTitle = nextTitle.trim() || 'ابتدای کتاب'
    setPreludeTitle(cleanTitle)
    const metadata = { ...(book?.metadata || {}), prelude_title: cleanTitle }
    setBook((current: any) => ({ ...current, metadata }))
    updatePublisherBook(id, { metadata } as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      void (supabase as any).from('books').update({ metadata }).eq('id', id)
    }
  }
  const updateTocEntry = (tocIndex: number, patch: Partial<ConfirmedTocEntry>) => {
    if (tocIndex < 0) return
    persistTocEntries(tocEntries.map((item, index) => index === tocIndex ? { ...item, ...patch } : item))
  }
  const shiftTocEntryLevel = (tocIndex: number, delta: -1 | 1) => {
    const item = tocEntries[tocIndex]
    if (!item) return
    updateTocEntry(tocIndex, { level: Math.min(6, Math.max(1, Number(item.level || 1) + delta)) })
  }
  const startInlineTocEdit = (tocIndex: number, currentTitle: string) => {
    setEditingTocIndex(tocIndex)
    setEditingTocTitle(currentTitle)
  }
  const submitInlineTocEdit = () => {
    if (editingTocIndex === null) return
    const title = editingTocTitle.trim()
    if (editingTocIndex === -1) {
      if (title) persistPreludeTitle(title)
      setEditingTocIndex(null)
      setEditingTocTitle('')
      return
    }
    if (title) updateTocEntry(editingTocIndex, { title })
    setEditingTocIndex(null)
    setEditingTocTitle('')
  }
  const removeTocEntry = (tocIndex: number) => {
    const item = tocEntries[tocIndex]
    if (!item) return
    persistTocEntries(tocEntries.filter((_, index) => index !== tocIndex))
    setActiveSegmentIndex(index => Math.max(0, Math.min(index, tocEntries.length - 2)))
    setConfirmTocDelete(null)
  }
  const toggleTocBranch = (key: string) => {
    setCollapsedTocKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const collapseTocByLevel = (maxLevel: number) => {
    setCollapsedTocKeys(new Set(segments
      .filter((segment, index) => Number(segment.level || 1) <= maxLevel && segmentHasChildren(segments, index))
      .map(segment => segment.key)))
  }
  const collapseAllToc = () => {
    setCollapsedTocKeys(new Set(segments
      .filter((_, index) => segmentHasChildren(segments, index))
      .map(segment => segment.key)))
  }
  const expandAllToc = () => setCollapsedTocKeys(new Set())
  const handleInteractiveAction = async (value: string) => {
    if (!value) return
    if (value === 'edit-current') {
      await openInteractiveEditor()
      return
    }
    addInteractive(value)
  }

  return (
    <main className="book-editor-shell" dir="rtl">
      <header className="book-editor-head menu-glass-70">
        <div>
          <RouterLink to="/publisher/me" className="mb-1 inline-flex w-max items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            بازگشت به انتشارات
          </RouterLink>
          <p>ادیتور کتاب · پیش‌نویس منتشرنشده</p>
          <input value={title} onChange={event => setTitle(event.target.value)} aria-label="عنوان کتاب" />
        </div>
        <div className="book-save-state"><Save />{saving ? 'در حال ذخیره…' : savedAt ? `ذخیره شد ${savedAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'ذخیره خودکار فعال است'}</div>
        <div>
          <Button variant="outline" onClick={() => setMetadataOpen(value => !value)}><PanelTopClose />مشخصات</Button><Button variant="outline" onClick={() => void previewCurrentBook()}><Eye />پیش‌نمایش</Button><Button onClick={() => save()}><Save />ذخیره</Button>
        </div>
      </header>

      {metadataOpen && <section className="book-editor-meta menu-glass-70">
        <label>عنوان<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>زیرعنوان<input value={subtitle} onChange={event => setSubtitle(event.target.value)} /></label>
        <label>توضیح کوتاه<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label>تصویر پس‌زمینه صفحه<input value={backgroundUrl} onChange={event => setBackgroundUrl(event.target.value)} placeholder="آدرس تصویر" /></label>
        <label>شفافیت پس‌زمینه<input type="range" min="0" max="0.8" step="0.05" value={backgroundAlpha} onChange={event => setBackgroundAlpha(Number(event.target.value))} /></label>
        <button onClick={() => setMetadataOpen(false)}><ChevronUp />بستن مشخصات</button>
      </section>}

      <div className="book-editor-toolbar menu-glass-70">
        <button title="بازگشت" onClick={() => command(activeEditor => activeEditor.chain().focus().undo().run())}><Undo2 /></button><button title="انجام دوباره" onClick={() => command(activeEditor => activeEditor.chain().focus().redo().run())}><Redo2 /></button><i />
        <button title="سرفصل اصلی" onClick={() => promoteSelection(1)}><Heading1 /></button><button title="سرفصل فرعی" onClick={() => promoteSelection(2)}><Heading2 /></button>
        <button title="پررنگ" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleBold().run())}><Bold /></button><button title="مورب" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleItalic().run())}><Italic /></button><button title="زیرخط" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleUnderline().run())}><UnderlineIcon /></button><button title="خط‌خورده" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleStrike().run())}><Strikethrough /></button><button title="بالانویس" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleSuperscript().run())}><SuperIcon /></button><button title="زیرنویس" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleSubscript().run())}><SubIcon /></button><button title="افزودن یا ویرایش پیوند" onClick={setLink}><Link2 /></button><i />
        <select title="فونت" onChange={event => command(activeEditor => activeEditor.chain().focus().setMark('textStyle', { fontFamily: event.target.value }).run())}><option value="Vazirmatn">وزیرمتن</option><option value="Tahoma">Tahoma</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option></select>
        <select title="اندازه متن انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) command(activeEditor => activeEditor.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run()); event.target.value = '' }}><option value="" disabled>اندازه متن</option>{[12,14,16,18,20,24,28,32,40].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
        <select title="تایپوگرافی آماده" defaultValue="" onChange={event => { setTypography(event.target.value); event.target.value = '' }}><option value="" disabled>تایپوگرافی</option>{TYPOGRAPHY_PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input title="رنگ متن" type="color" onChange={event => command(activeEditor => activeEditor.chain().focus().setColor(event.target.value).run())} /><button title="راست‌به‌چپ کردن پاراگراف" onClick={() => setDirection('rtl')}>RTL</button><button title="چپ‌به‌راست کردن پاراگراف" onClick={() => setDirection('ltr')}>LTR</button><i />
        <button title="راست‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('right').run())}><AlignRight /></button><button title="وسط‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('center').run())}><AlignCenter /></button><button title="چپ‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('left').run())}><AlignLeft /></button><button title="تراز کامل" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('justify').run())}><AlignJustify /></button><button title="فهرست نقطه‌ای" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleBulletList().run())}><List /></button><button title="فهرست شماره‌ای" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleOrderedList().run())}><ListOrdered /></button><i />
        <button title="افزودن تصویر" onClick={() => imageInputRef.current?.click()}><ImagePlus /></button><button title="نمایش تصاویر کتاب" onClick={() => setImagePanelOpen(value => !value)} className={imagePanelOpen ? 'active' : ''}><Images /></button><input ref={imageInputRef} hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && addImage(event.target.files[0])} /><select title="اندازه تصویر انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) command(activeEditor => activeEditor.chain().focus().updateAttributes('image', { width: event.target.value }).run()); event.target.value = '' }}><option value="" disabled>اندازه عکس</option><option value="25%">۲۵٪</option><option value="50%">۵۰٪</option><option value="75%">۷۵٪</option><option value="100%">۱۰۰٪</option></select><button title="جدول جدید" onClick={() => command(activeEditor => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table2 /></button><select title="ویرایش جدول انتخاب‌شده" defaultValue="" onChange={event => { tableAction(event.target.value); event.target.value = '' }}><option value="" disabled>ویرایش جدول</option><option value="row-after">افزودن ردیف</option><option value="column-after">افزودن ستون</option><option value="delete-row">حذف ردیف</option><option value="delete-column">حذف ستون</option><option value="delete-table">حذف جدول</option></select><button title="صفحه جدید" onClick={() => command(activeEditor => activeEditor.chain().focus().setHorizontalRule().run())}><FileImage /></button>
        <select title="بخش تعاملی" defaultValue="" onChange={event => { void handleInteractiveAction(event.target.value); event.target.value = '' }}><option value="" disabled>تعاملی</option><option value="edit-current">ویرایش بخش انتخاب‌شده</option>{INTERACTIVE_TYPES.map(item => <option key={item[0]} value={item[0]}>{`افزودن ${item[1]}`}</option>)}</select>{bookImages.length > 0 && <select title="استفاده از تصویر کتاب در بخش تعاملی انتخاب‌شده" defaultValue="" onChange={event => { applyImageToInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>تصویر برای تعاملی</option>{bookImages.slice(0, 100).map((image: any, index: number) => <option key={`${image.url}-${index}`} value={image.url}>{image.caption || `تصویر ${index + 1}`}</option>)}</select>}<button title="ویرایش جزئیات بخش تعاملی انتخاب‌شده" onClick={() => void openInteractiveEditor()}><LayoutTemplate /></button><i />
        <button title="کوچک کردن متن" onClick={() => setFontSize(value => Math.max(12, value - 1))}><Minus /></button><span>{fontSize.toLocaleString('fa-IR')}</span><button title="بزرگ کردن متن" onClick={() => setFontSize(value => Math.min(34, value + 1))}><Plus /></button>
      </div>

      <div className="book-editor-layout">
        <aside className="book-editor-side menu-glass-70">
          <div className="book-editor-side-card">
            <h3><BookOpen />فهرست کتاب</h3>
            <p>این همان فهرستی است که در زمان تبدیل Word تایید شده است.</p>
            <span className="book-editor-segment-note">در حال ویرایش: {activeSegment?.label || 'سند'} · صفحه {activeSegment?.page || (activeSegment?.start ?? 0) + 1}</span>
          </div>
          <div className="book-editor-toc-tools" aria-label="ابزارهای فهرست">
            <button title="باز کردن همه شاخه‌ها" onClick={expandAllToc}><ChevronUp /></button>
            <button title="جمع کردن همه شاخه‌ها" onClick={collapseAllToc}><ChevronLeft /></button>
            <button title="جمع کردن فصل‌های اصلی" onClick={() => collapseTocByLevel(1)}>H1</button>
            <button title="جمع کردن تا سطح دوم" onClick={() => collapseTocByLevel(2)}>H2</button>
          </div>
          <div className="book-editor-toc-list">
            {tocEntries.length === 0 && <p className="book-editor-empty-state">برای این کتاب فهرست تاییدشده‌ای ثبت نشده است.</p>}
            {tocTreeRows.filter(row => !row.hidden).map(({ segment, index, level, hasChildren, collapsed, h1Counter }) => (
              <div
                className={`book-editor-toc-row level-${level} ${index === activeSegmentIndex ? 'is-active' : ''} ${hasChildren ? 'has-children' : ''}`}
                key={segment.key}
                title={segment.label || 'سرفصل بدون عنوان'}
                style={{ '--toc-level': level } as CSSProperties}
              >
                {editingTocIndex === segment.tocIndex ? (
                  <form className="book-editor-toc-inline-edit" onSubmit={event => { event.preventDefault(); submitInlineTocEdit() }}>
                    <input value={editingTocTitle} autoFocus onChange={event => setEditingTocTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditingTocIndex(null); setEditingTocTitle('') } }} />
                    <button type="submit">ثبت</button>
                  </form>
                ) : (
                  <button className="book-editor-toc-link" onClick={() => changeActiveSegment(index)}>
                    <span className="book-editor-toc-number">{level === 1 ? h1Counter.toLocaleString('fa-IR') : (index + 1).toLocaleString('fa-IR')}</span>
                    <span className="book-editor-toc-title">{segment.label || 'سرفصل بدون عنوان'}</span>
                  </button>
                )}
                {typeof segment.tocIndex === 'number' ? (
                  <span className="book-editor-toc-actions">
                    {hasChildren && <button title={collapsed ? 'باز کردن شاخه' : 'جمع کردن شاخه'} onClick={() => toggleTocBranch(segment.key)}>{collapsed ? <ChevronLeft /> : <ChevronUp />}</button>}
                    <button title="کاهش سطح" onClick={() => shiftTocEntryLevel(segment.tocIndex!, -1)}><ArrowUp /></button>
                    <button title="افزایش سطح" onClick={() => shiftTocEntryLevel(segment.tocIndex!, 1)}><ArrowDown /></button>
                    <button title="ویرایش عنوان" onClick={() => startInlineTocEdit(segment.tocIndex!, segment.label || '')}><Edit3 /></button>
                    <button title="حذف از فهرست" onClick={() => setConfirmTocDelete(segment.tocIndex!)}><Trash2 /></button>
                  </span>
                ) : segment.isPrelude ? (
                  <span className="book-editor-toc-actions">
                    <button title="ویرایش عنوان ابتدای کتاب" onClick={() => startInlineTocEdit(-1, segment.label || preludeTitle)}><Edit3 /></button>
                  </span>
                ) : <span className="book-editor-toc-jump"><ChevronLeft /></span>}
              </div>
            ))}
          </div>
        </aside>
        {imagePanelOpen && <aside className="book-editor-image-drawer menu-glass-70">
          <header><h3><Images />تصاویر کتاب</h3><button onClick={() => setImagePanelOpen(false)}>بستن</button></header>
          {bookImages.length === 0 && <p className="book-editor-empty-state">هنوز تصویری برای این کتاب ثبت نشده است.</p>}
          <div>
            {bookImages.map((image: any, index: number) => (
              <button key={image.key || `${image.url}-${index}`} className={image.issue ? 'has-issue' : ''} disabled={!image.url} title={image.issue || 'افزودن تصویر در محل نشانگر'} onClick={() => image.url && command(activeEditor => activeEditor.chain().focus().setImage({ src: image.url, alt: image.caption || '', width: image.widthPx ? `${image.widthPx}px` : image.widthPercent ? `${image.widthPercent}%` : '100%', imageId: image.imageId || undefined, printPage: image.printPage || undefined, conversionStatus: image.conversionStatus || undefined } as any).run())}>
                {image.url ? <img src={image.url} alt={image.caption || ''} /> : <span><AlertTriangle /></span>}
                <b>{image.caption || image.originalName || image.name || `تصویر ${index + 1}`}</b>
                <small>صفحه چاپی: {String(image.printPage || 'نامشخص')}</small>
                {image.issue && <em>{image.issue}</em>}
              </button>
            ))}
          </div>
        </aside>}
        <section ref={documentStageRef} className="book-document-stage"><div className="book-document-paper" style={{ '--editor-font-size': `${fontSize}px`, '--page-bg': backgroundUrl ? `url("${backgroundUrl}")` : 'none', '--page-bg-alpha': backgroundAlpha } as CSSProperties}><EditorContent editor={editor} /></div></section>
      </div>
      {confirmTocDelete !== null && <div className="app-modal-backdrop" role="dialog" aria-modal="true">
        <section className="app-message-modal menu-glass-70">
          <div className="app-message-art"><AlertTriangle /></div>
          <div>
            <h3>حذف سرفصل از فهرست</h3>
            <p>«{tocEntries[confirmTocDelete]?.title}» فقط از فهرست کتاب حذف می‌شود و متن اصلی کتاب دست‌نخورده باقی می‌ماند.</p>
          </div>
          <footer>
            <button className="app-modal-secondary" onClick={() => setConfirmTocDelete(null)}>انصراف</button>
            <button className="app-modal-danger" onClick={() => removeTocEntry(confirmTocDelete)}>حذف از فهرست</button>
          </footer>
        </section>
      </div>}
      <button className="book-editor-scroll-top" title="بازگشت به ابتدای پنل محتوا" onClick={() => documentStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ArrowUp /></button>
    </main>
  )
}
