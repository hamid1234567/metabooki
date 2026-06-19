/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
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
import { AlertTriangle, AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, BookOpen, Bookmark, ChevronLeft, ChevronDown, ChevronUp, Edit3, Feather, FileImage, FileText, Heading1, ImagePlus, Images, Info, Italic, LayoutTemplate, Lightbulb, Link2, List, ListOrdered, Minus, Pilcrow, Plus, Quote, Redo2, Sparkles, Strikethrough, Subscript as SubIcon, Superscript as SuperIcon, Table2, Trash2, Type, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { EditorHeader, EditorStatusBar, EditorToolbarFrame } from '@/features/editor/EditorShell'
import { findPublisherBook, updatePublisherBook } from '@/lib/publisher-books'
import { findBookById } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'
import { useAuthContext } from '@/lib/auth-context'
import { bookTextDirection, inlineToHtml as sharedInlineToHtml, normalizeBookText, pageBreakHtml } from '@/lib/book-content'
import { runAiThroughGateway, type AiStructuredContent, type RunAiResult } from '@/lib/ai-gateway'

const escape = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const encodePayload = (value: unknown) => encodeURIComponent(JSON.stringify(value))
const decodePayload = (value = '') => { try { return JSON.parse(decodeURIComponent(value)) } catch { return {} } }
const appPath = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/${path.replace(/^\//, '')}`
const openBookPreview = (id: string) => window.open(appPath(`/read/${id}`), '_blank', 'noopener,noreferrer')

type EditorPanelMode = 'toc' | 'upgrade' | 'media' | 'interactive' | 'ai'
type MediaPanelView = 'home' | 'library'

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

function linesFromItems(items: any[] = [], keys: string[] = ['title', 'description']) {
  return items.map(item => keys.map(key => item?.[key] || '').join(' | ')).join('\n')
}

function itemsFromLines(value: string, keys: string[] = ['title', 'description']) {
  return value.split(/\r?\n/).map(line => line.split('|').map(part => part.trim())).filter(parts => parts[0]).map(parts => {
    const item: Record<string, string> = {}
    keys.forEach((key, index) => { item[key] = parts[index] || '' })
    return item
  })
}

function InteractiveNodeView({ node, updateAttributes }: any) {
  const kind = node.attrs?.kind || 'quiz'
  const data = { ...interactiveTemplate(kind), ...decodePayload(node.attrs?.payload) }
  const updatePayload = (patch: Record<string, unknown>) => updateAttributes({ payload: encodePayload({ ...data, ...patch }) })
  const multiline = (label: string, value: string, onChange: (value: string) => void, hint?: string) => (
    <label>
      <span>{label}</span>
      <textarea value={value} placeholder={hint} onChange={event => onChange(event.target.value)} />
    </label>
  )
  return (
    <NodeViewWrapper as="section" className={`editor-interactive-card interactive-${kind}`} data-interactive-kind={kind} contentEditable={false}>
      <header>
        <strong>{interactiveLabel(kind)}</strong>
        <small>برای ویرایش، همین فیلدها را تغییر بدهید.</small>
      </header>
      {kind === 'quiz' && <>
        <label><span>سؤال</span><input value={data.question || ''} onChange={event => updatePayload({ question: event.target.value })} /></label>
        {multiline('گزینه‌ها', (data.options || []).join('\n'), value => updatePayload({ options: value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) }), 'هر گزینه در یک خط')}
        <label><span>شماره گزینه صحیح</span><input type="number" min="1" value={Number(data.correct ?? data.correctIndex ?? 0) + 1} onChange={event => updatePayload({ correct: Math.max(0, Number(event.target.value || 1) - 1) })} /></label>
      </>}
      {kind === 'truefalse' && <>
        <label><span>گزاره</span><input value={data.statement || ''} onChange={event => updatePayload({ statement: event.target.value })} /></label>
        <label><span>پاسخ درست</span><select value={String(Boolean(data.correct))} onChange={event => updatePayload({ correct: event.target.value === 'true' })}><option value="true">صحیح</option><option value="false">غلط</option></select></label>
        <label><span>توضیح</span><textarea value={data.explanation || ''} onChange={event => updatePayload({ explanation: event.target.value })} /></label>
      </>}
      {kind === 'flashcard' && multiline('کارت‌ها', linesFromItems(data.cards, ['front', 'back']), value => updatePayload({ cards: itemsFromLines(value, ['front', 'back']) }), 'روی کارت | پشت کارت')}
      {kind === 'accordion' && multiline('آیتم‌ها', linesFromItems(data.items, ['title', 'description']), value => updatePayload({ items: itemsFromLines(value, ['title', 'description']) }), 'عنوان | متن بازشونده')}
      {kind === 'tabs' && multiline('تب‌ها', linesFromItems(data.tabs, ['title', 'description']), value => updatePayload({ tabs: itemsFromLines(value, ['title', 'description']) }), 'عنوان تب | محتوای تب')}
      {kind === 'timeline' && multiline('رویدادها', linesFromItems(data.events, ['year', 'title', 'description']), value => updatePayload({ events: itemsFromLines(value, ['year', 'title', 'description']) }), 'زمان | عنوان | توضیح')}
      {(kind === 'steps' || kind === 'algorithm') && multiline('مرحله‌ها', linesFromItems(data.steps, ['title', 'description']), value => updatePayload({ steps: itemsFromLines(value, ['title', 'description']) }), 'عنوان | توضیح')}
      {kind === 'scrollytelling' && multiline('روایت‌ها', linesFromItems(data.steps, ['text', 'description', 'image']), value => updatePayload({ steps: itemsFromLines(value, ['text', 'description', 'image']) }), 'متن | توضیح | آدرس تصویر')}
      {kind === 'gallery' && multiline('تصاویر', linesFromItems(data.images, ['url', 'caption']), value => updatePayload({ images: itemsFromLines(value, ['url', 'caption']) }), 'آدرس تصویر | کپشن')}
      {kind === 'hotspot' && <>
        <label><span>تصویر</span><input value={data.image || ''} onChange={event => updatePayload({ image: event.target.value })} /></label>
        {multiline('نقاط', linesFromItems(data.points, ['title', 'text', 'x', 'y']), value => updatePayload({ points: itemsFromLines(value, ['title', 'text', 'x', 'y']).map(item => ({ ...item, x: Number(item.x || 50), y: Number(item.y || 50) })) }), 'عنوان | توضیح | x | y')}
      </>}
      {kind === 'author' && <>
        <label><span>نام</span><input value={data.name || ''} onChange={event => updatePayload({ name: event.target.value })} /></label>
        <label><span>نقش</span><input value={data.role || ''} onChange={event => updatePayload({ role: event.target.value })} /></label>
        <label><span>معرفی</span><textarea value={data.bio || ''} onChange={event => updatePayload({ bio: event.target.value })} /></label>
        <label><span>تصویر</span><input value={data.image || ''} onChange={event => updatePayload({ image: event.target.value })} /></label>
      </>}
    </NodeViewWrapper>
  )
}

const InteractiveBlock = Node.create({
  name: 'interactiveBlock',
  group: 'block',
  atom: true,
  addAttributes() { return { kind: { default: 'quiz' }, payload: { default: '{}' } } },
  parseHTML() { return [{ tag: 'section[data-interactive-kind]' }] },
  addNodeView() {
    return ReactNodeViewRenderer(InteractiveNodeView)
  },
  renderHTML({ HTMLAttributes }) {
    const data = decodePayload(HTMLAttributes.payload)
    return ['section', mergeAttributes(HTMLAttributes, { class: 'editor-interactive-block', 'data-interactive-kind': HTMLAttributes.kind }), ['strong', `بخش تعاملی: ${interactiveLabel(HTMLAttributes.kind)}`], ...interactivePreview(HTMLAttributes.kind, data)]
  },
})

function CalloutNodeView({ node, updateAttributes, editor, getPos }: any) {
  const variant = node.attrs?.variant || 'key'
  const preset = calloutPreset(variant)
  const title = node.attrs?.title || preset.label
  const icon = node.attrs?.icon || preset.emoji
  const unwrapCallout = () => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos === null || pos === undefined || !editor?.view) return
    editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, node.content))
    editor.commands.focus()
  }
  return (
    <NodeViewWrapper
      as="section"
      className={`book-callout editor-callout has-editable-title callout-${variant}`}
      data-callout-variant={variant}
      data-callout-title={title}
      data-callout-icon={icon}
    >
      <div className="book-callout-head" contentEditable={false}>
        <span className="book-callout-icon">{icon}</span>
        <input
          value={title}
          aria-label="عنوان کال‌اوت"
          onChange={event => updateAttributes({ title: event.target.value })}
          onBlur={event => updateAttributes({ title: event.target.value.trim() || preset.label })}
        />
        <button type="button" className="book-callout-unwrap" title="حذف قاب کال‌اوت و نگه داشتن متن" onClick={unwrapCallout}>×</button>
      </div>
      <NodeViewContent className="book-callout-content" />
    </NodeViewWrapper>
  )
}

const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: { default: 'key', parseHTML: element => element.getAttribute('data-callout-variant') || 'key', renderHTML: attrs => ({ 'data-callout-variant': attrs.variant || 'key' }) },
      title: { default: 'نکته کلیدی', parseHTML: element => element.getAttribute('data-callout-title') || 'نکته کلیدی', renderHTML: attrs => ({ 'data-callout-title': attrs.title || 'نکته کلیدی' }) },
      icon: { default: '💡', parseHTML: element => element.getAttribute('data-callout-icon') || '💡', renderHTML: attrs => ({ 'data-callout-icon': attrs.icon || '💡' }) },
    }
  },
  parseHTML() {
    return [{ tag: 'section[data-callout-variant]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: `book-callout editor-callout callout-${HTMLAttributes.variant || 'key'}` }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
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

const LEGACY_INTERACTIVE_TYPES = [
  ['flashcard', 'فلش‌کارت'], ['steps', 'مرحله‌سازی'], ['gallery', 'گالری عکس'], ['scrollytelling', 'استوری‌تلینگ'],
  ['quiz', 'کوییز ساده'], ['timeline', 'تایم‌لاین'], ['hotspot', 'هات‌اسپات تعاملی'],
] as const
const INTERACTIVE_TYPES = [
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
const interactiveKinds = new Set<string>(INTERACTIVE_TYPES.map(item => item[0]))
void LEGACY_INTERACTIVE_TYPES

const CALLOUT_PRESETS = [
  { value: 'key', label: 'نکته کلیدی', group: 'کال‌اوت آموزشی', icon: Lightbulb, emoji: '💡', className: 'callout-key', description: 'خلاصه مهم‌ترین نکته متن' },
  { value: 'question', label: 'مکث و فکر کن', group: 'کال‌اوت آموزشی', icon: Info, emoji: '❔', className: 'callout-question', description: 'سؤال کوتاه برای درگیر کردن خواننده' },
  { value: 'warning', label: 'اشتباه رایج', group: 'کال‌اوت آموزشی', icon: AlertTriangle, emoji: '⚠️', className: 'callout-warning', description: 'هشدار یا اصلاح برداشت اشتباه' },
  { value: 'quote', label: 'جمله طلایی', group: 'کال‌اوت ادبی و مرجع', icon: Quote, emoji: '❝', className: 'callout-quote', description: 'نقل‌قول یا جمله مهم و ماندگار' },
  { value: 'deep', label: 'عمیق‌تر بخوان', group: 'کال‌اوت ادبی و مرجع', icon: BookOpen, emoji: '🔍', className: 'callout-deep', description: 'محتوای تکمیلی یا توضیح پیشرفته' },
  { value: 'practice', label: 'تمرین سریع', group: 'کال‌اوت کاربردی', icon: Bookmark, emoji: '✅', className: 'callout-practice', description: 'تمرین یا فعالیت کوتاه داخل کتاب' },
  { value: 'glossary', label: 'تعریف واژه', group: 'کال‌اوت کاربردی', icon: FileText, emoji: '📘', className: 'callout-glossary', description: 'تعریف یک اصطلاح یا مفهوم' },
  { value: 'data', label: 'داده و منبع', group: 'کال‌اوت کاربردی', icon: FileText, emoji: '📊', className: 'callout-data', description: 'نمایش آمار، عدد، منبع یا رفرنس' },
  { value: 'margin', label: 'یادداشت حاشیه‌ای', group: 'کال‌اوت کاربردی', icon: Feather, emoji: '📝', className: 'callout-margin', description: 'توضیح کوتاه در حاشیه یا کنار متن' },
  { value: 'normal', label: 'متن عادی', group: 'بازنشانی', icon: Pilcrow, emoji: '', className: 'editor-normal', description: 'بازگشت به متن ساده' },
] as const
const calloutPreset = (variant = 'key') => CALLOUT_PRESETS.find(item => item.value === variant) || CALLOUT_PRESETS[0]
function interactiveLabel(kind: string) { return INTERACTIVE_TYPES.find(item => item[0] === kind)?.[1] || kind }
function compactAiContent(content?: AiStructuredContent | null) {
  if (!content) return ''
  if (content.type === 'quiz') return `${content.question}\n${content.options.map((item: string, index: number) => `${index + 1}. ${item}`).join('\n')}\n${content.explanation}`
  if (content.type === 'timeline') return [content.title, ...content.steps.map((step: { title: string; description: string }, index: number) => `${index + 1}. ${step.title}: ${step.description}`)].join('\n')
  if (content.type === 'mindmap') return [content.title, ...content.branches.flatMap((branch: { title: string; items: string[] }) => [branch.title, ...branch.items.map((item: string) => `- ${item}`)])].join('\n')
  return [content.title, content.lead, ...content.sections.flatMap((section: { heading: string; paragraphs: string[]; bullets?: string[] }) => [section.heading, ...section.paragraphs, ...(section.bullets || []).map((item: string) => `- ${item}`)])].filter(Boolean).join('\n')
}
function interactiveTemplate(kind: string) {
  if (kind === 'quiz') return { type: kind, question: 'سؤال را اینجا بنویسید', options: ['گزینه صحیح', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'], correct: 0 }
  if (kind === 'truefalse') return { type: kind, statement: 'گزاره را اینجا بنویسید', correct: true, explanation: 'توضیح پاسخ' }
  if (kind === 'accordion') return { type: kind, title: 'آکاردئون', items: [{ title: 'عنوان بخش', description: 'متن بازشونده این بخش' }] }
  if (kind === 'tabs') return { type: kind, title: 'تب‌ها', tabs: [{ title: 'تب اول', description: 'محتوای تب اول' }, { title: 'تب دوم', description: 'محتوای تب دوم' }] }
  if (kind === 'algorithm') return { type: kind, title: 'الگوریتم تعاملی', steps: [{ title: 'اگر...', description: 'شرط یا تصمیم اول' }, { title: 'آنگاه...', description: 'نتیجه یا مسیر بعدی' }] }
  if (kind === 'author') return { type: kind, name: 'نام نویسنده', role: 'نقش یا تخصص', bio: 'معرفی کوتاه نویسنده', image: '' }
  if (kind === 'quiz') return { type: kind, question: 'سؤال را اینجا بنویسید', options: ['گزینه صحیح', 'گزینه دوم', 'گزینه سوم'], correct: 0 }
  if (kind === 'timeline') return { type: kind, events: [{ year: 'مرحله ۱', title: 'شروع', description: 'توضیح مرحله نخست' }, { year: 'مرحله ۲', title: 'ادامه', description: 'توضیح مرحله دوم' }] }
  if (kind === 'scrollytelling') return { type: kind, steps: [{ image: '', text: 'بخش نخست روایت' }, { image: '', text: 'بخش دوم روایت' }] }
  if (kind === 'hotspot') return { type: kind, image: '', caption: 'تصویر هات‌اسپات', points: [{ x: 50, y: 50, title: 'نقطه ۱', text: 'توضیح این نقطه' }] }
  if (kind === 'flashcard') return { type: kind, cards: [{ front: 'روی کارت', back: 'پشت کارت' }] }
  if (kind === 'gallery') return { type: kind, images: [{ url: '', caption: 'تصویر گالری' }] }
  return { type: kind, title: 'فرآیند مرحله‌ای', steps: [{ title: 'مرحله ۱', description: 'توضیح مرحله نخست', image: '' }, { title: 'مرحله ۲', description: 'توضیح مرحله دوم', image: '' }] }
}
function interactivePreview(kind: string, data: any): any[] {
  if (kind === 'truefalse') return [['h4', data.statement || 'گزاره صحیح/غلط'], ['div', { class: 'editor-interactive-options' }, ['span', data.correct ? 'پاسخ: صحیح' : 'پاسخ: غلط'], ['span', data.explanation || '']]]
  if (kind === 'accordion') return [['h4', data.title || 'آکاردئون'], ['div', { class: 'editor-interactive-steps' }, ...(data.items || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'بخش'}`])]]
  if (kind === 'tabs') return [['h4', data.title || 'تب‌ها'], ['div', { class: 'editor-interactive-steps' }, ...(data.tabs || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'تب'}`])]]
  if (kind === 'algorithm') return [['h4', data.title || 'الگوریتم تعاملی'], ['div', { class: 'editor-interactive-steps' }, ...(data.steps || []).map((item: any, index: number) => ['span', `${index + 1}. ${item.title || 'تصمیم'}`])]]
  if (kind === 'author') return [['h4', data.name || 'نویسنده مطلب'], ['span', data.role || ''], ['small', data.bio || '']]
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
  if (block.type === 'callout') {
    const preset = calloutPreset(block.variant)
    return `<section class="book-callout editor-callout callout-${escape(block.variant || preset.value)}" data-callout-variant="${escape(block.variant || preset.value)}" data-callout-title="${escape(block.title || preset.label)}" data-callout-icon="${escape(block.icon || preset.emoji)}">${(block.blocks || []).map(blockHtml).join('')}</section>`
  }
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
  if (interactiveKinds.has(block.type)) return `<section data-interactive-kind="${block.type}" kind="${block.type}" payload="${encodePayload(block)}"></section>`
  return `<p${blockAttributes(block)}>${inlineHtml(block)}</p>`
}

function pagesToHtml(pages: any[] = []) {
  return pages.map((page, index) => {
    const separator = index ? pageBreakHtml(pages[index - 1], page) : ''
    return `${separator}${(page.blocks || []).map(blockHtml).join('')}`
  }).join('')
}

type EditorSegment = { key: string; label: string; level?: number; start: number; end: number; startBlock?: number; endBlock?: number; page?: number; tocIndex?: number; isPrelude?: boolean }
type ConfirmedTocEntry = { id?: string; title: string; level: number; page?: number; styleId?: string }

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

function syncPagesAndTocFromHeadings(pages: any[] = [], currentToc: ConfirmedTocEntry[] = []) {
  const existingById = new Map(currentToc.filter(item => item.id).map(item => [item.id, item]))
  const existingByTitle = new Map(currentToc.map(item => [`${item.level}:${String(item.title || '').trim()}`, item]))
  const toc: ConfirmedTocEntry[] = []
  const syncBlocks = (blocks: any[] = [], page: any, pageIndex: number, path = ''): any[] => blocks.map((block, blockIndex) => {
    const nextPath = path ? `${path}-${blockIndex}` : `${blockIndex}`
    if (block.type === 'heading') {
      const title = normalizeBookText(block.content || block.text || '').trim()
      const level = Math.min(6, Math.max(1, Number(block.level || 2)))
      const existing = existingById.get(block.anchor || block.id) || existingByTitle.get(`${level}:${title}`)
      const id = block.anchor || block.id || existing?.id || `heading-${pageIndex + 1}-${nextPath}`
      if (title) toc.push({ id, title, level, page: page.printNumber || page.number || pageIndex + 1, styleId: existing?.styleId })
      return { ...block, anchor: id, id }
    }
    if (Array.isArray(block.blocks)) return { ...block, blocks: syncBlocks(block.blocks, page, pageIndex, nextPath) }
    return block
  })
  return { pages: pages.map((page, pageIndex) => ({ ...page, blocks: syncBlocks(page.blocks || [], page, pageIndex) })), toc }
}

function tocEntryInsideSegment(pages: any[] = [], item: ConfirmedTocEntry, segment?: EditorSegment) {
  if (!segment) return true
  const position = findTocPosition(pages, item)
  if (position.pageIndex < segment.start || position.pageIndex >= segment.end) return false
  if (position.pageIndex === segment.start && position.blockIndex < (segment.startBlock ?? 0)) return false
  if (position.pageIndex === segment.end - 1 && position.blockIndex >= (segment.endBlock ?? (pages[position.pageIndex]?.blocks?.length || 0))) return false
  return true
}

function resolveTocAfterHeadingSync(pages: any[] = [], generatedToc: ConfirmedTocEntry[] = [], currentToc: ConfirmedTocEntry[] = [], segment?: EditorSegment) {
  if (!currentToc.length) return generatedToc
  if (!generatedToc.length && (!segment || (segment.start <= 0 && segment.end >= pages.length))) return currentToc
  if (!segment) return generatedToc.length ? generatedToc : currentToc
  const outsideCurrent = currentToc.filter(item => !tocEntryInsideSegment(pages, item, segment))
  const insideGenerated = generatedToc.filter(item => tocEntryInsideSegment(pages, item, segment))
  if (!insideGenerated.length && generatedToc.length === 0 && outsideCurrent.length === 0) return currentToc
  return [...outsideCurrent, ...insideGenerated].sort((a, b) => {
    const pa = findTocPosition(pages, a)
    const pb = findTocPosition(pages, b)
    return pa.pageIndex - pb.pageIndex || pa.blockIndex - pb.blockIndex
  })
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

function editorNodeToBlock(node: any): any | null {
  const inline = inlineFromNode(node)
  const content = inline.map((span: any) => span.text).join('') || nodeText(node)
  if (node.type === 'heading') {
    return { type: 'heading', level: node.attrs?.level || 2, content, inline, format: { alignment: node.attrs?.textAlign || undefined, direction: node.attrs?.dir || undefined, fontSizePt: node.attrs?.fontSizePt || undefined, color: node.attrs?.blockColor?.replace('#', '') || undefined, bold: node.attrs?.blockBold || undefined, italic: node.attrs?.blockItalic || undefined } }
  }
  if (node.type === 'image') {
    const width = String(node.attrs?.width || '100%')
    return { type: 'image', url: node.attrs?.src, caption: node.attrs?.alt || '', imageId: node.attrs?.imageId || undefined, printPage: node.attrs?.printPage || undefined, conversionStatus: node.attrs?.conversionStatus || undefined, ...(width.endsWith('%') ? { widthPercent: Number.parseFloat(width) } : { widthPx: Number.parseFloat(width) }) }
  }
  if (node.type === 'interactiveBlock') return { ...decodePayload(node.attrs?.payload), type: node.attrs?.kind }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = (node.content || []).map((item: any) => {
      const itemInline = inlineFromListItem(item)
      return { text: itemInline.map((span: any) => span.text).join('') || nodeText(item), inline: itemInline }
    }).filter((item: any) => item.text || item.inline?.length)
    return items.length ? { type: 'list', ordered: node.type === 'orderedList', items, content: items.map((item: any) => item.text).join('\n') } : null
  }
  if (node.type === 'table') {
    const rows = (node.content || []).map((row: any) => (row.content || []).map((cell: any) => nodeText(cell)))
    return { type: 'table', headers: rows[0] || [], rows: rows.slice(1) }
  }
  if (node.type === 'calloutBlock') {
    const preset = calloutPreset(node.attrs?.variant)
    const blocks = (node.content || []).map(editorNodeToBlock).filter(Boolean)
    return blocks.length ? { type: 'callout', variant: node.attrs?.variant || preset.value, title: node.attrs?.title || preset.label, icon: node.attrs?.icon || preset.emoji, blocks } : null
  }
  if (node.type === 'paragraph' && (content || inline.length)) {
    return { type: 'paragraph', content, inline, semantic: node.attrs?.semantic || undefined, format: { alignment: node.attrs?.textAlign || undefined, direction: node.attrs?.dir || undefined, fontSizePt: node.attrs?.fontSizePt || undefined, color: node.attrs?.blockColor?.replace('#', '') || undefined, bold: node.attrs?.blockBold || undefined, italic: node.attrs?.blockItalic || undefined } }
  }
  return null
}

function editorJsonToPages(json: any) {
  const pages: any[] = [{ title: 'صفحه ۱', blocks: [] }]
  for (const node of json?.content || []) {
    if (node.type === 'calloutBlock') {
      const page = pages[pages.length - 1]
      const block = editorNodeToBlock(node)
      if (block) page.blocks.push(block)
      continue
    }
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
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [backgroundAlpha, setBackgroundAlpha] = useState(0)
  const [editingTocIndex, setEditingTocIndex] = useState<number | null>(null)
  const [editingTocTitle, setEditingTocTitle] = useState('')
  const [confirmTocDelete, setConfirmTocDelete] = useState<number | null>(null)
  const [collapsedTocKeys, setCollapsedTocKeys] = useState<Set<string>>(() => new Set())
  const [toolbarMenu, setToolbarMenu] = useState<'heading' | 'typography' | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const [panelMode, setPanelMode] = useState<EditorPanelMode>('toc')
  const [mediaPanelView, setMediaPanelView] = useState<MediaPanelView>('home')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiUsage, setAiUsage] = useState<RunAiResult['usage'] | null>(null)
  const [aiDraft, setAiDraft] = useState<{ type: 'summary' | 'quiz' | 'interactive'; title: string; text?: string; payload?: Record<string, unknown>; kind?: string } | null>(null)
  const [aiCalloutSuggestions, setAiCalloutSuggestions] = useState<Array<{ variant: string; title: string; text: string }>>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentStageRef = useRef<HTMLElement>(null)
  const switchingSegmentRef = useRef(false)
  const liveTocTimerRef = useRef<number | null>(null)
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
  }, [allPages, book])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }), ProtectedPageBreak, PreservePageBreaks, CitationMark, Underline, Subscript, Superscript, ResizableImage.configure({ allowBase64: true }), Link.configure({ openOnClick: false }),
      TextStyle, Color, RichTextStyle, BlockFormatting, CalloutBlock, InteractiveBlock, TableKit.configure({ table: { resizable: true } }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: pagesToHtml((localInitial?.pages || []).slice(0, 1)),
    editorProps: { attributes: { class: 'book-document-prose', dir: 'rtl', spellcheck: 'true' } },
  })

  const getEditor = () => editor && !editor.isDestroyed ? editor : null

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

  const save = async (quiet = false) => {
    const activeEditor = getEditor()
    if (!activeEditor || !id) return
    setSaving(true)
    const mergedPages = mergeCurrentSegment()
    const synced = syncPagesAndTocFromHeadings(mergedPages, tocEntries)
    const pages = synced.pages
    const safeToc = resolveTocAfterHeadingSync(pages, synced.toc, tocEntries, activeSegment)
    const metadata = { ...(book?.metadata || {}), confirmed_toc: safeToc, page_background_url: backgroundUrl, page_background_alpha: backgroundAlpha, prelude_title: preludeTitle }
    const patch = { title, subtitle, description, pages, metadata, page_count: pages.length, content_updated_at: new Date().toISOString() }
    updatePublisherBook(id, patch as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      await (supabase as any).from('books').update({ title, subtitle, description, pages, metadata, content_updated_at: patch.content_updated_at }).eq('id', id)
    }
    setAllPages(pages); setBook((current: any) => ({ ...current, ...patch })); setSavedAt(new Date()); setSaving(false)
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

  const refreshLiveTocFromEditor = () => {
    const activeEditor = getEditor()
    if (!activeEditor || switchingSegmentRef.current) return
    const mergedPages = mergeCurrentSegment()
    const synced = syncPagesAndTocFromHeadings(mergedPages, tocEntries)
    const safeToc = resolveTocAfterHeadingSync(synced.pages, synced.toc, tocEntries, activeSegment)
    const metadata = { ...(book?.metadata || {}), confirmed_toc: safeToc }
    setAllPages(synced.pages)
    setBook((current: any) => ({ ...current, metadata }))
  }

  useEffect(() => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    const onUpdate = () => {
      if (switchingSegmentRef.current) return
      setEditorRevision(revision => revision + 1)
      if (liveTocTimerRef.current) window.clearTimeout(liveTocTimerRef.current)
      liveTocTimerRef.current = window.setTimeout(refreshLiveTocFromEditor, 650)
    }
    activeEditor.on('update', onUpdate)
    return () => {
      activeEditor.off('update', onUpdate)
      if (liveTocTimerRef.current) window.clearTimeout(liveTocTimerRef.current)
    }
  }, [editor])

  useEffect(() => {
    if (!editorRevision) return
    const timer = window.setTimeout(() => save(true), 1400)
    return () => window.clearTimeout(timer)
  }, [editorRevision])

  useEffect(() => {
    if (!toolbarMenu) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest('.book-editor-toolbar')) return
      setToolbarMenu(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [toolbarMenu])

  const wordCount = useMemo(() => editor?.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length || 0, [editor, editorRevision])
  const currentBlockLabel = editor?.isActive('heading')
    ? `H${editor.getAttributes('heading').level || 1}`
    : editor?.isActive('calloutBlock')
      ? calloutPreset(editor.getAttributes('calloutBlock').variant).label
      : editor?.isActive('image')
        ? 'تصویر'
        : editor?.isActive('table')
          ? 'جدول'
          : 'پاراگراف'
  const currentDirection = (editor?.getAttributes('heading').dir || editor?.getAttributes('paragraph').dir || 'rtl') as 'rtl' | 'ltr'
  const currentLanguage = currentDirection === 'ltr' ? 'English' : 'فارسی'

  if (!book && !localInitial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">در حال دریافت پیش‌نویس کتاب…</h1></div>

  const command = (action: (activeEditor: NonNullable<typeof editor>) => void) => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    action(activeEditor)
    activeEditor.commands.focus()
  }
  const addInteractive = (kind: string) => command(activeEditor => activeEditor.chain().focus().insertContent({ type: 'interactiveBlock', attrs: { kind, payload: encodePayload(interactiveTemplate(kind)) } }).run())
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
      if (window.confirm('می‌خواهید یک تصویر جدید هم به گالری اضافه کنید؟')) await insertImageIntoInteractive()
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
        payload.steps = rawSteps.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[], index: number) => ({
          ...(payload.steps?.[index] || {}),
          title: attrs.kind === 'steps' ? parts[0] : undefined,
          text: attrs.kind === 'scrollytelling' ? parts[0] : undefined,
          description: parts[1] || '',
        }))
      }
      if (window.confirm('می‌خواهید برای مرحله نخست تصویر هم اضافه کنید؟')) await insertImageIntoInteractive()
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'hotspot') {
      const caption = window.prompt('عنوان یا کپشن تصویر', payload.caption || payload.title || '') ?? payload.caption
      const rawPoints = window.prompt('نقاط تعاملی؛ هر خط به شکل عنوان | توضیح | x | y', (payload.points || []).map((point: any) => `${point.title || ''} | ${point.text || ''} | ${point.x ?? 50} | ${point.y ?? 50}`).join('\n'))
      payload.caption = caption
      if (rawPoints) payload.points = rawPoints.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ title: parts[0], text: parts[1] || '', x: Number(parts[2] || 50), y: Number(parts[3] || 50) }))
      if (window.confirm('می‌خواهید تصویر اصلی هات‌اسپات را هم تغییر دهید؟')) await insertImageIntoInteractive()
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
  const promoteSelection = (level: 1 | 2 | 3 | 4 | 5 | 6) => command(activeEditor => activeEditor.chain().focus().toggleHeading({ level }).run())
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
    command(activeEditor => {
      if (semantic === 'normal') {
        activeEditor.chain().focus().updateAttributes(activeEditor.isActive('heading') ? 'heading' : 'paragraph', { semantic: null }).run()
        return
      }
      const preset = calloutPreset(semantic)
      const attrs = { variant: preset.value, title: preset.label, icon: preset.emoji }
      if (activeEditor.isActive('calloutBlock')) activeEditor.chain().focus().updateAttributes('calloutBlock', attrs).run()
      else activeEditor.chain().focus().wrapIn('calloutBlock', attrs).run()
    })
  }
  const editCalloutTitle = () => {
    command(activeEditor => {
      if (!activeEditor.isActive('calloutBlock')) {
        window.alert('ابتدا داخل کال‌اوت مورد نظر کلیک کنید، سپس عنوان را ویرایش کنید.')
        return
      }
      const attrs = activeEditor.getAttributes('calloutBlock')
      const nextTitle = window.prompt('عنوان کال‌اوت', attrs.title || calloutPreset(attrs.variant).label)
      if (nextTitle === null) return
      activeEditor.chain().focus().updateAttributes('calloutBlock', { title: nextTitle.trim() || calloutPreset(attrs.variant).label }).run()
    })
  }
  const updateInteractivePayload = (attrs: { kind: string; payload: string }, payload: Record<string, unknown>) => {
    command(activeEditor => activeEditor.chain().focus().updateAttributes('interactiveBlock', { kind: attrs.kind, payload: encodePayload(payload) }).run())
  }
  const insertImageIntoInteractive = async () => {
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
    else if (attrs.kind === 'algorithm') payload.steps = (payload.steps || [{ title: 'گام اول' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else if (attrs.kind === 'author') payload.image = url
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
  const selectedOrCurrentText = () => {
    const activeEditor = getEditor()
    if (!activeEditor) return ''
    const { from, to, empty } = activeEditor.state.selection
    const selected = empty ? '' : activeEditor.state.doc.textBetween(from, to, '\n').trim()
    return selected || activeEditor.state.doc.textContent.trim()
  }
  const insertCalloutWithText = (variant: string, heading: string, text: string) => {
    const preset = calloutPreset(variant)
    command(activeEditor => activeEditor.chain().focus().insertContent({
      type: 'calloutBlock',
      attrs: { variant: preset.value, title: heading || preset.label, icon: preset.emoji },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: text || heading || preset.label }] }],
    }).run())
  }
  const insertInteractivePayload = (kind: string, payload: Record<string, unknown>) => {
    command(activeEditor => activeEditor.chain().focus().insertContent({ type: 'interactiveBlock', attrs: { kind, payload: encodePayload({ ...interactiveTemplate(kind), ...payload, type: kind }) } }).run())
  }
  const recordAiUsage = (usage: RunAiResult['usage']) => {
    setAiUsage(usage)
    setAiMessage(`${usage.chargedCredits.toLocaleString('fa-IR')} کردیت کسر شد · ${usage.chargedToman.toLocaleString('fa-IR')} تومان · $${usage.chargedUsd.toFixed(6)}`)
  }
  const runEditorAi = async (mode: 'summary' | 'quiz' | 'callout' | 'interactive') => {
    const pageText = selectedOrCurrentText()
    if (!pageText) {
      setAiMessage('اول بخشی از متن را انتخاب کنید یا داخل بخش مورد نظر قرار بگیرید.')
      return
    }
    setAiLoading(true)
    setAiDraft(null)
    setAiCalloutSuggestions([])
    setAiMessage('در حال تولید خروجی هوشمند...')
    try {
      const action = mode === 'quiz' ? 'quiz' : mode === 'interactive' ? 'learning_path' : mode === 'summary' ? 'summary' : 'explain'
      const result = await runAiThroughGateway({ action, bookTitle: title || book?.title || 'کتاب', pageTitle: activeSegment?.label, pageText, bookId: id, pageIndex: activeSegmentIndex, user })
      recordAiUsage(result.usage)
      const text = compactAiContent(result.content) || result.text || ''
      if (mode === 'summary') {
        setAiDraft({ type: 'summary', title: 'خلاصه هوشمند', text })
      } else if (mode === 'quiz' && result.content?.type === 'quiz') {
        setAiDraft({ type: 'quiz', title: 'سؤال تولیدشده', kind: 'quiz', payload: { question: result.content.question, options: result.content.options, correct: result.content.correctIndex, explanation: result.content.explanation } })
      } else if (mode === 'callout') {
        const base = text || pageText.slice(0, 420)
        setAiCalloutSuggestions([
          { variant: 'key', title: 'نکته کلیدی پیشنهادی', text: base.split('\n').filter(Boolean)[0] || base },
          { variant: 'question', title: 'مکث و فکر کن', text: 'از این بخش چه نتیجه‌ای می‌توان گرفت؟' },
          { variant: 'deep', title: 'عمیق‌تر بخوان', text: base },
        ])
      } else if (mode === 'interactive') {
        const wantsImage = window.confirm('ساخت تصویر هوش مصنوعی برای این بخش بعداً هزینه جداگانه دارد. فعلاً ساختار تعاملی متنی ساخته شود؟')
        const steps = result.content?.type === 'timeline' ? result.content.steps : [{ title: 'مفهوم اصلی', description: text || pageText.slice(0, 240) }]
        setAiDraft({ type: 'interactive', title: 'بخش تعاملی پیشنهادی', kind: 'algorithm', payload: { title: 'مسیر یادگیری تعاملی', steps, needsAiImage: wantsImage, imagePrompt: wantsImage ? `تصویر آموزشی برای: ${pageText.slice(0, 180)}` : '' } })
      }
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'اجرای هوش مصنوعی ناموفق بود.')
    } finally {
      setAiLoading(false)
    }
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
    <main className="mb-editor-app" dir="rtl">
      <EditorHeader
        title={title}
        subtitle={activeSegment?.label}
        saving={saving}
        savedAt={savedAt}
        onTitleChange={setTitle}
        onMetadata={() => setMetadataOpen(value => !value)}
        onPreview={() => void previewCurrentBook()}
        onSave={() => void save()}
        onBack={<RouterLink to="/publisher/me"><ArrowLeft className="h-4 w-4" />بازگشت به انتشارات</RouterLink>}
      />

      {metadataOpen && <section className="book-editor-meta menu-glass-70">
        <label>عنوان<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>زیرعنوان<input value={subtitle} onChange={event => setSubtitle(event.target.value)} /></label>
        <label>توضیح کوتاه<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label>تصویر پس‌زمینه صفحه<input value={backgroundUrl} onChange={event => setBackgroundUrl(event.target.value)} placeholder="آدرس تصویر" /></label>
        <label>شفافیت پس‌زمینه<input type="range" min="0" max="0.8" step="0.05" value={backgroundAlpha} onChange={event => setBackgroundAlpha(Number(event.target.value))} /></label>
        <button onClick={() => setMetadataOpen(false)}><ChevronUp />بستن مشخصات</button>
      </section>}

      <EditorToolbarFrame>
      <div className="book-editor-toolbar">
        <div className="book-toolbar-group" aria-label="تاریخچه">
          <button title="بازگشت" onClick={() => command(activeEditor => activeEditor.chain().focus().undo().run())}><Undo2 /></button>
          <button title="انجام دوباره" onClick={() => command(activeEditor => activeEditor.chain().focus().redo().run())}><Redo2 /></button>
        </div>

        <div className="book-toolbar-group" aria-label="ساختار">
          <div className="book-toolbar-menu-wrap">
            <button title="سطح سرفصل" className={toolbarMenu === 'heading' ? 'active' : ''} onClick={() => setToolbarMenu(value => value === 'typography' ? null : value === 'heading' ? null : 'heading')}><Heading1 /><ChevronDown /></button>
            {toolbarMenu === 'heading' && <div className="book-toolbar-popover compact frosted-menu-surface">
              <button onClick={() => { command(activeEditor => activeEditor.chain().focus().setParagraph().run()); setToolbarMenu(null) }}><span className="book-heading-sample normal">P</span></button>
              {[1, 2, 3, 4, 5, 6].map(level => <button key={level} onClick={() => { promoteSelection(level as 1 | 2 | 3 | 4 | 5 | 6); setToolbarMenu(null) }}><span className={`book-heading-sample h${level}`}>H{level}</span></button>)}
            </div>}
          </div>
          <button title="صفحه جدید" onClick={() => command(activeEditor => activeEditor.chain().focus().setHorizontalRule().run())}><FileImage /></button>
        </div>

        <div className="book-toolbar-group" aria-label="متن">
          <button title="پررنگ" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleBold().run())}><Bold /></button>
          <button title="مورب" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleItalic().run())}><Italic /></button>
          <button title="زیرخط" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleUnderline().run())}><UnderlineIcon /></button>
          <button title="خط‌خورده" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleStrike().run())}><Strikethrough /></button>
          <button title="بالانویس" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleSuperscript().run())}><SuperIcon /></button>
          <button title="زیرنویس" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleSubscript().run())}><SubIcon /></button>
          <button title="افزودن یا ویرایش پیوند" onClick={setLink}><Link2 /></button>
        </div>

        <div className="book-toolbar-group" aria-label="تایپوگرافی">
          <select title="فونت" onChange={event => command(activeEditor => activeEditor.chain().focus().setMark('textStyle', { fontFamily: event.target.value }).run())}><option value="Vazirmatn">وزیرمتن</option><option value="Tahoma">Tahoma</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option></select>
          <select title="اندازه متن انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) command(activeEditor => activeEditor.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run()); event.target.value = '' }}><option value="" disabled>اندازه</option>{[12,14,16,18,20,24,28,32,40].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
          <div className="book-toolbar-menu-wrap">
            <button title="تایپوگرافی آماده" className={toolbarMenu === 'typography' ? 'active' : ''} onClick={() => setToolbarMenu(value => value === 'typography' ? null : 'typography')}><Type /><ChevronDown /></button>
            {toolbarMenu === 'typography' && <div className="book-toolbar-popover typography frosted-menu-surface">
              <button className="book-callout-title-action" onClick={() => { editCalloutTitle(); setToolbarMenu(null) }}><Edit3 /><span>ویرایش عنوان کال‌اوت انتخاب‌شده</span></button>
              {Array.from(new Set(CALLOUT_PRESETS.map(item => item.group))).map(group => <section key={group}>
                <b>{group}</b>
                {CALLOUT_PRESETS.filter(item => item.group === group).map(item => {
                  const Icon = item.icon
                  return <button key={item.value} onClick={() => { setTypography(item.value); setToolbarMenu(null) }}><Icon /><span className={`book-typography-preview ${item.className}`} data-callout-icon={item.emoji}>{item.label}<small>{item.description}</small></span></button>
                })}
              </section>)}
            </div>}
          </div>
          <input title="رنگ متن" type="color" onChange={event => command(activeEditor => activeEditor.chain().focus().setColor(event.target.value).run())} />
        </div>

        <div className="book-toolbar-group" aria-label="جهت و چینش">
          <button title="جهت راست‌به‌چپ" onClick={() => setDirection('rtl')}><span className="book-dir-icon is-rtl" /></button>
          <button title="جهت چپ‌به‌راست" onClick={() => setDirection('ltr')}><span className="book-dir-icon is-ltr" /></button>
          <button title="راست‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('right').run())}><AlignRight /></button>
          <button title="وسط‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('center').run())}><AlignCenter /></button>
          <button title="چپ‌چین" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('left').run())}><AlignLeft /></button>
          <button title="تراز کامل" onClick={() => command(activeEditor => activeEditor.chain().focus().setTextAlign('justify').run())}><AlignJustify /></button>
        </div>

        <div className="book-toolbar-group" aria-label="لیست">
          <button title="فهرست نقطه‌ای" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleBulletList().run())}><List /></button>
          <button title="فهرست شماره‌ای" onClick={() => command(activeEditor => activeEditor.chain().focus().toggleOrderedList().run())}><ListOrdered /></button>
        </div>

        <div className="book-toolbar-group" aria-label="مدیا و جدول">
          <button title="افزودن تصویر" onClick={() => imageInputRef.current?.click()}><ImagePlus /></button>
          <button title="نمایش تصاویر کتاب" onClick={() => setPanelMode('media')} className={panelMode === 'media' ? 'active' : ''}><Images /></button>
          <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && addImage(event.target.files[0])} />
          <select title="اندازه تصویر انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) command(activeEditor => activeEditor.chain().focus().updateAttributes('image', { width: event.target.value }).run()); event.target.value = '' }}><option value="" disabled>عکس</option><option value="25%">۲۵٪</option><option value="50%">۵۰٪</option><option value="75%">۷۵٪</option><option value="100%">۱۰۰٪</option></select>
          <button title="جدول جدید" onClick={() => command(activeEditor => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table2 /></button>
          <select title="ویرایش جدول انتخاب‌شده" defaultValue="" onChange={event => { tableAction(event.target.value); event.target.value = '' }}><option value="" disabled>جدول</option><option value="row-after">افزودن ردیف</option><option value="column-after">افزودن ستون</option><option value="delete-row">حذف ردیف</option><option value="delete-column">حذف ستون</option><option value="delete-table">حذف جدول</option></select>
        </div>

        <div className="book-toolbar-group" aria-label="تعاملی">
          <select title="بخش تعاملی" defaultValue="" onChange={event => { void handleInteractiveAction(event.target.value); event.target.value = '' }}><option value="" disabled>تعاملی</option><option value="edit-current">ویرایش بخش انتخاب‌شده</option>{INTERACTIVE_TYPES.map(item => <option key={item[0]} value={item[0]}>{`افزودن ${item[1]}`}</option>)}</select>
          {bookImages.length > 0 && <select title="استفاده از تصویر کتاب در بخش تعاملی انتخاب‌شده" defaultValue="" onChange={event => { applyImageToInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>تصویر</option>{bookImages.slice(0, 100).map((image: any, index: number) => <option key={`${image.url}-${index}`} value={image.url}>{image.caption || `تصویر ${index + 1}`}</option>)}</select>}
          <button title="ویرایش جزئیات بخش تعاملی انتخاب‌شده" onClick={() => void openInteractiveEditor()}><LayoutTemplate /></button>
        </div>

        <div className="book-toolbar-group" aria-label="نمایش">
          <button title="کوچک کردن متن" onClick={() => setFontSize(value => Math.max(12, value - 1))}><Minus /></button>
          <span>{fontSize.toLocaleString('fa-IR')}</span>
          <button title="بزرگ کردن متن" onClick={() => setFontSize(value => Math.min(34, value + 1))}><Plus /></button>
        </div>
      </div>
      </EditorToolbarFrame>

      <div className="mb-editor-workspace">
        <aside className="mb-editor-panel">
          <div className="mb-editor-panel-switcher" aria-label="ابزارهای ادیتور">
            {[
              ['toc', 'فهرست', BookOpen],
              ['upgrade', 'ارتقا متن', Type],
              ['media', 'رسانه', Images],
              ['interactive', 'ابزار تعاملی', LayoutTemplate],
              ['ai', 'هوش مصنوعی', Sparkles],
            ].map(([mode, label, Icon]) => {
              const PanelIcon = Icon as typeof BookOpen
              return <button key={String(mode)} className={panelMode === mode ? 'is-active' : ''} onClick={() => setPanelMode(mode as EditorPanelMode)}><PanelIcon />{String(label)}</button>
            })}
          </div>
          {panelMode === 'upgrade' ? <div className="mb-panel-content">
            <section className="book-editor-side-card">
              <h3><Type />ارتقا متن</h3>
              <p>متن انتخاب‌شده را به سرفصل، کال‌اوت، جدول یا صفحه جدید تبدیل کنید.</p>
            </section>
            <div className="mb-command-grid">
              {[1, 2, 3, 4, 5, 6].map(level => <button key={level} onClick={() => promoteSelection(level as 1 | 2 | 3 | 4 | 5 | 6)}><Heading1 />H{level}</button>)}
              <button onClick={() => command(activeEditor => activeEditor.chain().focus().setParagraph().run())}><Pilcrow />متن عادی</button>
              <button onClick={() => command(activeEditor => activeEditor.chain().focus().setHorizontalRule().run())}><FileImage />صفحه جدید</button>
              <button onClick={() => command(activeEditor => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table2 />جدول</button>
            </div>
            <section className="mb-callout-palette compact">
              {CALLOUT_PRESETS.filter(item => item.value !== 'normal').map(item => {
                const Icon = item.icon
                return <button key={item.value} className={`callout-option ${item.className}`} onClick={() => setTypography(item.value)}><Icon /><span>{item.label}</span></button>
              })}
            </section>
          </div> : panelMode === 'media' ? <div className={`book-editor-image-drawer is-embedded media-view-${mediaPanelView}`}>
            <div className="mb-command-grid">
              <button onClick={() => imageInputRef.current?.click()}><ImagePlus />بارگذاری تصویر جدید</button>
              <button onClick={() => setMediaPanelView('library')}><Images />تصاویر خود کتاب</button>
              <button onClick={() => setBackgroundUrl(window.prompt('آدرس تصویر پس‌زمینه صفحه', backgroundUrl) || backgroundUrl)}><FileImage />پس‌زمینه صفحه</button>
              {mediaPanelView === 'library' && <button onClick={() => setMediaPanelView('home')}><ChevronUp />بازگشت به گزینه‌های رسانه</button>}
            </div>
            <header><h3><Images />تصاویر کتاب</h3><button onClick={() => setPanelMode('toc')}>فهرست</button></header>
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
          </div> : panelMode === 'interactive' ? <div className="mb-panel-content">
            <section className="book-editor-side-card">
              <h3><LayoutTemplate />ابزار تعاملی</h3>
              <p>ابزار را انتخاب کنید؛ بعد از درج، همان‌جا داخل متن قابل ویرایش است.</p>
            </section>
            <div className="mb-command-grid">
              {INTERACTIVE_TYPES.map(([kind, label]) => <button key={kind} onClick={() => addInteractive(kind)}><LayoutTemplate />{label}</button>)}
            </div>
            <button className="mb-wide-action" onClick={() => void openInteractiveEditor()}><Edit3 />ویرایش سریع ابزار انتخاب‌شده</button>
            {bookImages.length > 0 && <select className="mb-wide-select" title="افزودن تصویر به ابزار تعاملی انتخاب‌شده" defaultValue="" onChange={event => { applyImageToInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>افزودن تصویر از کتاب</option>{bookImages.slice(0, 100).filter((image: any) => image.url).map((image: any, index: number) => <option key={`${image.url}-${index}`} value={image.url}>{image.caption || `تصویر ${index + 1}`}</option>)}</select>}
          </div> : panelMode === 'ai' ? <div className="mb-panel-content">
            <section className="book-editor-side-card">
              <h3><Sparkles />هوش مصنوعی</h3>
              <p>ابتدا متن را انتخاب کنید. هزینه واقعی بعد از پاسخ از gateway محاسبه و از کردیت کاربر کم می‌شود.</p>
            </section>
            <div className="mb-command-grid">
              <button disabled={aiLoading} onClick={() => void runEditorAi('summary')}><Sparkles />خلاصه انتخاب</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('quiz')}><Sparkles />تولید سؤال</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('callout')}><Lightbulb />پیشنهاد Callout</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('interactive')}><LayoutTemplate />پیشنهاد تعاملی</button>
            </div>
            {aiLoading && <p className="book-editor-empty-state">در حال تولید خروجی هوشمند...</p>}
            {aiMessage && <p className="mb-ai-cost">{aiMessage}</p>}
            {aiUsage && <small className="mb-ai-usage">{aiUsage.inputTokens.toLocaleString('fa-IR')} توکن ورودی · {aiUsage.outputTokens.toLocaleString('fa-IR')} توکن خروجی</small>}
            {aiDraft && <section className="mb-ai-draft">
              <h3>{aiDraft.title}</h3>
              {aiDraft.text && <p>{aiDraft.text}</p>}
              {aiDraft.type === 'summary' && <button onClick={() => aiDraft.text && insertCalloutWithText('key', aiDraft.title, aiDraft.text)}>افزودن خلاصه به کال‌اوت</button>}
              {aiDraft.type === 'quiz' && aiDraft.payload && <button onClick={() => insertInteractivePayload('quiz', aiDraft.payload!)}>افزودن سؤال به کتاب</button>}
              {aiDraft.type === 'interactive' && aiDraft.payload && <button onClick={() => insertInteractivePayload(aiDraft.kind || 'algorithm', aiDraft.payload!)}>افزودن بخش تعاملی</button>}
            </section>}
            {aiCalloutSuggestions.length > 0 && <section className="mb-ai-suggestions">
              <h3>پیشنهادهای Callout</h3>
              {aiCalloutSuggestions.map((item, index) => <button key={`${item.variant}-${index}`} onClick={() => insertCalloutWithText(item.variant, item.title, item.text)}><Lightbulb /><span>{item.title}<small>{item.text}</small></span></button>)}
            </section>}
          </div> : <>
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
          </>}
        </aside>
        <section ref={documentStageRef} className="mb-editor-canvas"><div className="book-document-stage"><div className="book-document-paper" style={{ '--editor-font-size': `${fontSize}px`, '--page-bg': backgroundUrl ? `url("${backgroundUrl}")` : 'none', '--page-bg-alpha': backgroundAlpha } as CSSProperties}><EditorContent editor={editor} /></div></div></section>
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
      <EditorStatusBar wordCount={wordCount} language={currentLanguage} blockLabel={currentBlockLabel} zoom={100} savedAt={savedAt} saving={saving} />
    </main>
  )
}
