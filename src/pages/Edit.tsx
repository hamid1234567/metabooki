/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
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
import { bookTextDirection, calloutPreset as sharedCalloutPreset, CALLOUT_PRESETS as SHARED_CALLOUT_PRESETS, inlineToHtml as sharedInlineToHtml, interactiveLabel as sharedInteractiveLabel, interactivePreview as sharedInteractivePreview, interactiveTemplate as sharedInteractiveTemplate, INTERACTIVE_TYPES as SHARED_INTERACTIVE_TYPES, normalizeBookText, pageBreakHtml } from '@/lib/book-content'
import { estimateAiImageGeneration, estimateAiTextUsage, generateAiImageThroughGateway, runAiThroughGateway, type AiStructuredContent, type RunAiResult } from '@/lib/ai-gateway'
import type { AiImagePurpose } from '@/lib/ai-image-prompts'
import { useCredits } from '@/hooks/useCredits'
import { creditsBus } from '@/lib/credits-bus'
import { openReaderPreview, readerUrl } from '@/lib/app-routes'

const escape = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const encodePayload = (value: unknown) => encodeURIComponent(JSON.stringify(value))
const decodePayload = (value = '') => { try { return JSON.parse(decodeURIComponent(value)) } catch { return {} } }
const openBookPreview = (id: string) => openReaderPreview(id, `/edit/${id}`)

type EditorPanelMode = 'toc' | 'upgrade' | 'media' | 'interactive' | 'ai'
type MediaPanelView = 'home' | 'library'
type InteractiveMediaView = 'home' | 'library' | 'ai'
type AiUpgradeSuggestion = {
  id: string
  kind: 'callout' | 'interactive' | 'quiz' | 'summary'
  title: string
  text?: string
  variant?: string
  interactiveKind?: string
  payload?: Record<string, unknown>
  sourceText: string
  reason: string
}
type AiCostDialog = {
  title: string
  description: string
  usage: RunAiResult['usage']
  model?: string
  resolve: (approved: boolean) => void
}
type AiRunApprovalDialog = {
  title: string
  description: string
  supportsImage: boolean
  textPreview: string
  usage?: RunAiResult['usage']
  imageUsage?: RunAiResult['usage']
  totalWithImages?: RunAiResult['usage']
  imageCount?: number
  model?: string
  imageModel?: string
  imageWarning?: string
  resolve: (choice: 'plain' | 'images' | null) => void
}
type AiProgressState = {
  label: string
  detail?: string
  percent: number
}
type EditorMediaContextValue = {
  bookImages: any[]
  uploadImage: (file: File) => Promise<string>
  generateImage: (prompt: string, purpose?: AiImagePurpose) => Promise<string>
}

const EditorMediaContext = createContext<EditorMediaContextValue>({
  bookImages: [],
  uploadImage: async file => new Promise(resolve => readLocalMedia(file, resolve)),
  generateImage: async prompt => generatedInteractiveImageDataUrl(prompt, 'تصویر آموزشی'),
})

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

function readLocalMedia(file: File | undefined, onReady: (url: string) => void) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => onReady(String(reader.result || ''))
  reader.readAsDataURL(file)
}

function InlineMediaPicker({ label, value, defaultPrompt = '', onChange, stopEditorSelection }: { label: string; value: string; defaultPrompt?: string; onChange: (url: string) => void; stopEditorSelection: (event: any) => void }) {
  const media = useContext(EditorMediaContext)
  const [mode, setMode] = useState<'closed' | 'library' | 'ai'>('closed')
  const [prompt, setPrompt] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const visibleImages = useMemo(() => {
    const q = search.trim().toLowerCase()
    return media.bookImages
      .filter((image: any) => image.url)
      .filter((image: any) => {
        if (!q) return true
        return `${image.caption || ''} ${image.originalName || ''} ${image.name || ''} ${image.printPage || ''}`.toLowerCase().includes(q)
      })
      .slice(0, 80)
  }, [media.bookImages, search])
  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setNotice('')
    try {
      onChange(await media.uploadImage(file))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'آپلود تصویر ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }
  const generate = async () => {
    const manualPrompt = prompt.trim()
    const cleanPrompt = manualPrompt || defaultPrompt.trim()
    if (!cleanPrompt) {
      setNotice('برای تولید تصویر، پرامپت تصویر را بنویسید یا ابتدا متن همین آیتم را کامل کنید.')
      return
    }
    setBusy(true)
    setNotice('در حال بررسی هزینه و تولید تصویر...')
    try {
      const generatedUrl = await media.generateImage(cleanPrompt, manualPrompt ? 'direct' : 'interactive')
      if (!generatedUrl) throw new Error('هوش مصنوعی تصویری برنگرداند.')
      onChange(generatedUrl)
      setPrompt('')
      setMode('closed')
      setNotice('تصویر تولید شد.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تولید تصویر ناموفق بود. کلید API، کردیت کاربر و Edge Function را بررسی کنید.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`interactive-media-slot inline-media-picker ${value ? 'has-image' : ''}`} onPointerDown={stopEditorSelection} onMouseDown={stopEditorSelection} onClick={stopEditorSelection}>
      <div className="inline-media-quick-actions" aria-label="افزودن تصویر">
        <label title="آپلود تصویر"><ImagePlus /><input type="file" accept="image/*" onChange={event => void upload(event.target.files?.[0])} /></label>
        <button type="button" title="انتخاب از تصاویر کتاب" onClick={() => setMode('library')}><Images /></button>
        <button type="button" title="تولید با هوش مصنوعی" onClick={() => setMode(mode === 'ai' ? 'closed' : 'ai')}><Sparkles /></button>
      </div>
      <div className="inline-media-preview">
        {value ? <img src={value} alt="" /> : <span><ImagePlus />{label}</span>}
        {busy && <div className="inline-media-busy">در حال پردازش...</div>}
      </div>
      {mode === 'library' && <div className="inline-media-modal" role="dialog" aria-modal="true">
        <button type="button" className="inline-media-modal-backdrop" onClick={() => setMode('closed')} aria-label="بستن" />
        <div className="inline-media-library">
          <header className="inline-media-library-head">
            <div>
              <strong>انتخاب از تصاویر کتاب</strong>
              <small>{visibleImages.length.toLocaleString('fa-IR')} تصویر قابل انتخاب</small>
            </div>
            <button type="button" onClick={() => setMode('closed')} aria-label="بستن">×</button>
          </header>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="جستجو در کپشن، نام فایل یا شماره صفحه..." />
          {visibleImages.length === 0 && <p>تصویری از کتاب پیدا نشد.</p>}
          <div className="inline-media-library-list">
            {visibleImages.map((image: any, index: number) => {
              const selected = value && image.url === value
              return (
                <button type="button" key={image.key || `${image.url}-${index}`} className={selected ? 'is-selected' : ''} onClick={() => { onChange(image.url); setMode('closed'); setNotice('تصویر انتخاب شد.') }} title={image.caption || 'انتخاب تصویر'}>
                  <img src={image.url} alt={image.caption || ''} loading="lazy" />
                  <span>
                    <b>{image.caption || image.originalName || image.name || `تصویر ${index + 1}`}</b>
                    <small>{image.sameSegment ? 'اولویت: همین بخش' : `صفحه چاپی: ${String(image.printPage || 'نامشخص')}`}</small>
                  </span>
                  <em>{selected ? 'انتخاب شده' : 'انتخاب'}</em>
                </button>
              )
            })}
          </div>
        </div>
      </div>}
      {mode === 'ai' && <div className="inline-media-ai">
        <textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={defaultPrompt ? `پیش‌فرض: ${defaultPrompt.slice(0, 90)}...` : 'پرامپت تصویر را بنویسید...'} />
        <button type="button" disabled={busy} onClick={() => void generate()}>{busy ? 'در حال تولید...' : 'برآورد هزینه و تولید'}</button>
      </div>}
      {notice && <p className={`inline-media-notice ${notice.includes('ناموفق') || notice.includes('بررسی کنید') || notice.includes('طولانی') ? 'is-error' : ''}`}>{notice}</p>}
      <input className="inline-media-url" value={value || ''} placeholder="یا آدرس تصویر را وارد کنید" onChange={event => onChange(event.target.value)} />
    </div>
  )
}

function InteractiveNodeView({ node, updateAttributes, editor, getPos }: any) {
  const kind = node.attrs?.kind || 'quiz'
  const data = { ...interactiveTemplate(kind), ...decodePayload(node.attrs?.payload) }
  const updatePayload = (patch: Record<string, unknown>) => updateAttributes({ payload: encodePayload({ ...data, ...patch }) })
  const stopEditorSelection = (event: any) => event.stopPropagation()
  const deleteBlock = () => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos === null || pos === undefined || !editor?.view) return
    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize))
    editor.commands.focus()
  }
  const list = (key: string, fallback: any[] = []) => Array.isArray(data[key]) ? data[key] : fallback
  const setList = (key: string, items: any[]) => updatePayload({ [key]: items })
  const updateItem = (key: string, index: number, patch: Record<string, unknown>, fallback: any[] = []) => setList(key, list(key, fallback).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const addItem = (key: string, item: Record<string, unknown>, fallback: any[] = []) => setList(key, [...list(key, fallback), item])
  const removeItem = (key: string, index: number, fallback: any[] = []) => setList(key, list(key, fallback).filter((_, itemIndex) => itemIndex !== index))
  const field = (label: string, value: string, onChange: (value: string) => void, placeholder = '', wide = false) => (
    <label className={`interactive-field ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <input value={value || ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </label>
  )
  const textarea = (label: string, value: string, onChange: (value: string) => void, placeholder = '') => (
    <label className="interactive-field is-wide">
      <span>{label}</span>
      <textarea value={value || ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </label>
  )
  const mediaSlot = (label: string, value: string, onChange: (value: string) => void, defaultPrompt = '') => (
    <InlineMediaPicker label={label} value={value || ''} defaultPrompt={defaultPrompt} onChange={onChange} stopEditorSelection={stopEditorSelection} />
  )
  const itemCard = (title: string, index: number, onDelete: () => void, children: any, media?: any) => (
    <section className="interactive-item-card">
      <button type="button" className="interactive-remove-item" title="حذف" onClick={onDelete}>×</button>
      <div className="interactive-item-grid">
        {media}
        <div className="interactive-item-fields">
          <small>{title} {index + 1}</small>
          {children}
        </div>
      </div>
    </section>
  )
  const addButton = (label: string, onClick: () => void) => <button type="button" className="interactive-add-button" onClick={onClick}><Plus />{label}</button>
  const options = list('options', ['', ''])
  const cards = list('cards', [{ front: '', back: '', image: '' }])
  const items = list('items', [{ title: '', description: '', image: '' }])
  const tabs = list('tabs', [{ title: '', description: '', image: '' }])
  const events = list('events', [{ year: '', title: '', description: '', image: '' }])
  const steps = list('steps', [{ title: '', description: '', image: '' }])
  const algorithmNodes = list('nodes', list('steps', [{ title: '', description: '', image: '' }]).map((step: any, index: number) => ({
    id: step.id || `node-${index + 1}`,
    kind: index === 0 ? 'start' : index === steps.length - 1 ? 'result' : 'action',
    title: step.title || '',
    description: step.description || step.text || '',
    image: step.image || '',
    options: index < steps.length - 1 ? [{ label: 'ادامه', targetId: `node-${index + 2}` }] : [],
  })))
  const images = list('images', [{ url: '', caption: '' }])
  const points = list('points', [{ title: '', text: '', x: 50, y: 50 }])
  const authors = Array.isArray(data.authors) ? data.authors : [{ name: data.name || '', role: data.role || '', bio: data.bio || '', image: data.image || '' }]
  const [activeHotspotIndex, setActiveHotspotIndex] = useState<number | null>(points.length ? 0 : null)
  const addHotspotPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!data.image) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)))
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)))
    const next = [...points, { title: '', text: '', x, y }]
    setList('points', next)
    setActiveHotspotIndex(next.length - 1)
  }
  return (
    <NodeViewWrapper as="section" className={`editor-interactive-card interactive-${kind}`} data-interactive-kind={kind} contentEditable={false} onPointerDown={stopEditorSelection} onMouseDown={stopEditorSelection}>
      <header className="interactive-form-header">
        <strong>{interactiveLabel(kind)}</strong>
        <button type="button" title="حذف بخش تعاملی" onClick={deleteBlock}><Trash2 /></button>
      </header>
      {kind !== 'quiz' && kind !== 'truefalse' && kind !== 'flashcard' && kind !== 'gallery' && kind !== 'author' && field('عنوان', data.title || data.caption || '', value => updatePayload({ title: value, caption: value }), 'عنوان بخش', true)}
      {kind === 'quiz' && <>
        {field('سؤال', data.question || '', value => updatePayload({ question: value }), 'متن سؤال', true)}
        <div className="interactive-option-list">
          {options.map((option: string, index: number) => (
            <label key={index} className="interactive-option-row">
              <input type="radio" checked={Number(data.correct ?? 0) === index} onChange={() => updatePayload({ correct: index })} />
              <input value={option || ''} placeholder={`گزینه ${index + 1}`} onChange={event => setList('options', options.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item))} />
              <button type="button" onClick={() => setList('options', options.filter((_: string, itemIndex: number) => itemIndex !== index))}>×</button>
            </label>
          ))}
        </div>
        {addButton('افزودن گزینه', () => setList('options', [...options, '']))}
        {textarea('بازخورد یا توضیح پاسخ', data.explanation || '', value => updatePayload({ explanation: value }), 'توضیح اختیاری پاسخ')}
      </>}
      {kind === 'truefalse' && <>
        {field('گزاره', data.statement || '', value => updatePayload({ statement: value }), 'متن گزاره', true)}
        <label className="interactive-field"><span>پاسخ درست</span><select value={String(Boolean(data.correct))} onChange={event => updatePayload({ correct: event.target.value === 'true' })}><option value="true">صحیح</option><option value="false">غلط</option></select></label>
        {textarea('توضیح', data.explanation || '', value => updatePayload({ explanation: value }), 'توضیح اختیاری')}
      </>}
      {kind === 'flashcard' && <>
        {cards.map((card: any, index: number) => itemCard('کارت', index, () => removeItem('cards', index, cards), <>
          {textarea('روی کارت', card.front || '', value => updateItem('cards', index, { front: value }, cards), 'متن روی کارت')}
          {textarea('پشت کارت', card.back || '', value => updateItem('cards', index, { back: value }, cards), 'متن پشت کارت')}
        </>, mediaSlot('تصویر', card.image || '', value => updateItem('cards', index, { image: value }, cards), `${card.front || ''} ${card.back || ''}`)))}
        {addButton('افزودن کارت', () => addItem('cards', { front: '', back: '', image: '' }, cards))}
      </>}
      {kind === 'accordion' && <>
        {items.map((item: any, index: number) => itemCard('بخش', index, () => removeItem('items', index, items), <>
          {field('عنوان', item.title || '', value => updateItem('items', index, { title: value }, items), 'عنوان بازشونده', true)}
          {textarea('توضیح', item.description || '', value => updateItem('items', index, { description: value }, items), 'متن بازشونده')}
        </>, mediaSlot('تصویر', item.image || '', value => updateItem('items', index, { image: value }, items), `${item.title || ''} ${item.description || ''}`)))}
        {addButton('افزودن بخش', () => addItem('items', { title: '', description: '', image: '' }, items))}
      </>}
      {kind === 'tabs' && <>
        {tabs.map((tab: any, index: number) => itemCard('تب', index, () => removeItem('tabs', index, tabs), <>
          {field('عنوان تب', tab.title || '', value => updateItem('tabs', index, { title: value }, tabs), 'عنوان تب', true)}
          {textarea('محتوا', tab.description || '', value => updateItem('tabs', index, { description: value }, tabs), 'محتوای تب')}
        </>, mediaSlot('تصویر', tab.image || '', value => updateItem('tabs', index, { image: value }, tabs), `${tab.title || ''} ${tab.description || ''}`)))}
        {addButton('افزودن تب', () => addItem('tabs', { title: '', description: '', image: '' }, tabs))}
      </>}
      {kind === 'timeline' && <>
        {events.map((eventItem: any, index: number) => itemCard('رویداد', index, () => removeItem('events', index, events), <>
          {field('زمان', eventItem.year || '', value => updateItem('events', index, { year: value }, events), 'سال یا مرحله')}
          {field('عنوان', eventItem.title || '', value => updateItem('events', index, { title: value }, events), 'عنوان رویداد')}
          {textarea('توضیح', eventItem.description || '', value => updateItem('events', index, { description: value }, events), 'توضیح رویداد')}
        </>, mediaSlot('تصویر', eventItem.image || '', value => updateItem('events', index, { image: value }, events), `${eventItem.year || ''} ${eventItem.title || ''} ${eventItem.description || ''}`)))}
        {addButton('افزودن رویداد', () => addItem('events', { year: '', title: '', description: '', image: '' }, events))}
      </>}
      {kind === 'algorithm' && <>
        {field('عنوان الگوریتم', data.title || '', value => updatePayload({ title: value }), 'مثلا: انتخاب مسیر درمان یا تصمیم‌گیری آموزشی', true)}
        {algorithmNodes.map((node: any, index: number) => itemCard('گره الگوریتم', index, () => removeItem('nodes', index, algorithmNodes), <>
          <div className="interactive-coordinates">
            {field('شناسه', node.id || '', value => updateItem('nodes', index, { id: value }, algorithmNodes), 'مثلا start یا step-1')}
            <label className="interactive-field"><span>نوع گره</span><select value={node.kind || 'action'} onChange={event => updateItem('nodes', index, { kind: event.target.value }, algorithmNodes)}><option value="start">شروع</option><option value="decision">تصمیم</option><option value="action">اقدام</option><option value="result">نتیجه</option></select></label>
          </div>
          {field('عنوان', node.title || '', value => updateItem('nodes', index, { title: value }, algorithmNodes), 'عنوان گره', true)}
          {textarea('توضیح', node.description || '', value => updateItem('nodes', index, { description: value }, algorithmNodes), 'متن توضیحی این گره')}
          <div className="interactive-option-list">
            {(Array.isArray(node.options) ? node.options : []).map((option: any, optionIndex: number) => (
              <label key={optionIndex} className="interactive-option-row">
                <input value={option.label || ''} placeholder="متن گزینه/شاخه" onChange={event => updateItem('nodes', index, { options: (node.options || []).map((item: any, itemIndex: number) => itemIndex === optionIndex ? { ...item, label: event.target.value } : item) }, algorithmNodes)} />
                <select value={option.targetId || ''} onChange={event => updateItem('nodes', index, { options: (node.options || []).map((item: any, itemIndex: number) => itemIndex === optionIndex ? { ...item, targetId: event.target.value } : item) }, algorithmNodes)}>
                  <option value="">مقصد</option>
                  {algorithmNodes.map((target: any) => <option key={target.id || target.title} value={target.id || ''}>{target.title || target.id || 'گره بدون عنوان'}</option>)}
                </select>
                <button type="button" onClick={() => updateItem('nodes', index, { options: (node.options || []).filter((_: any, itemIndex: number) => itemIndex !== optionIndex) }, algorithmNodes)}>×</button>
              </label>
            ))}
            <button type="button" className="interactive-add-button" onClick={() => updateItem('nodes', index, { options: [...(node.options || []), { label: '', targetId: '' }] }, algorithmNodes)}><Plus />افزودن شاخه</button>
          </div>
        </>, mediaSlot('تصویر', node.image || '', value => updateItem('nodes', index, { image: value }, algorithmNodes), `${node.title || ''} ${node.description || ''}`)))}
        {addButton('افزودن گره الگوریتم', () => addItem('nodes', { id: `node-${algorithmNodes.length + 1}`, kind: 'action', title: '', description: '', image: '', options: [] }, algorithmNodes))}
      </>}
      {(kind === 'steps' || kind === 'scrollytelling') && <>
        {steps.map((step: any, index: number) => itemCard('گام', index, () => removeItem('steps', index, steps), <>
          {field('عنوان', step.title || step.text || '', value => updateItem('steps', index, { title: value, text: value }, steps), 'عنوان گام', true)}
          {textarea('توضیح', step.description || '', value => updateItem('steps', index, { description: value }, steps), 'توضیح گام')}
        </>, mediaSlot('تصویر', step.image || '', value => updateItem('steps', index, { image: value }, steps), `${step.title || step.text || ''} ${step.description || ''}`)))}
        {addButton('افزودن گام', () => addItem('steps', { title: '', description: '', image: '' }, steps))}
      </>}
      {kind === 'gallery' && <>
        {field('عنوان گالری', data.title || '', value => updatePayload({ title: value }), 'عنوان', true)}
        <div className="interactive-gallery-grid">
          {images.map((image: any, index: number) => (
            <section key={index} className="interactive-gallery-item">
              <button type="button" onClick={() => removeItem('images', index, images)}>×</button>
              {mediaSlot('افزودن', image.url || '', value => updateItem('images', index, { url: value }, images), image.caption || data.title || '')}
              {field('کپشن', image.caption || '', value => updateItem('images', index, { caption: value }, images), 'کپشن تصویر', true)}
            </section>
          ))}
        </div>
        {addButton('افزودن تصویر', () => addItem('images', { url: '', caption: '' }, images))}
      </>}
      {kind === 'hotspot' && <>
        {mediaSlot('تصویر اصلی', data.image || '', value => updatePayload({ image: value }), `${data.title || data.caption || ''} ${points.map((point: any) => `${point.title || ''} ${point.text || ''}`).join(' ')}`)}
        <div className={`interactive-hotspot-builder ${data.image ? 'has-image' : ''}`}>
          <p>روی تصویر کلیک کنید تا نقطه جدید ساخته شود. سپس همان‌جا عنوان و توضیح نقطه را بنویسید.</p>
          {data.image ? (
            <div className="interactive-hotspot-stage" onClick={addHotspotPoint}>
              <img src={data.image} alt={data.caption || ''} />
              {points.map((point: any, index: number) => (
                <div
                  key={index}
                  className={`interactive-hotspot-point ${activeHotspotIndex === index ? 'is-active' : ''}`}
                  style={{ left: `${point.x ?? 50}%`, top: `${point.y ?? 50}%` }}
                  onClick={event => { event.stopPropagation(); setActiveHotspotIndex(activeHotspotIndex === index ? null : index) }}
                >
                  <button type="button">{index + 1}</button>
                  {activeHotspotIndex === index && <section className="interactive-hotspot-popover" onClick={event => event.stopPropagation()}>
                    <button type="button" className="interactive-remove-item" title="حذف نقطه" onClick={() => { removeItem('points', index, points); setActiveHotspotIndex(null) }}>×</button>
                    <input value={point.title || ''} placeholder="عنوان نقطه" onChange={event => updateItem('points', index, { title: event.target.value }, points)} />
                    <textarea value={point.text || ''} placeholder="توضیحی که با کلیک روی نقطه دیده می‌شود" onChange={event => updateItem('points', index, { text: event.target.value }, points)} />
                  </section>}
                </div>
              ))}
            </div>
          ) : <div className="interactive-hotspot-empty">ابتدا تصویر اصلی هات‌اسپات را بارگذاری کنید.</div>}
        </div>
      </>}
      {kind === 'author' && <>
        {field('عنوان بخش', data.title || '', value => updatePayload({ title: value }), 'مثلا: نویسندگان این فصل', true)}
        {authors.map((author: any, index: number) => itemCard('نویسنده', index, () => removeItem('authors', index, authors), <>
          {field('نام نویسنده', author.name || '', value => updateItem('authors', index, { name: value }, authors), 'نام نویسنده')}
          {field('سمت / تخصص', author.role || '', value => updateItem('authors', index, { role: value }, authors), 'اختیاری')}
          {textarea('معرفی کوتاه', author.bio || '', value => updateItem('authors', index, { bio: value }, authors), 'معرفی کوتاه اختیاری')}
        </>, mediaSlot('تصویر', author.image || '', value => updateItem('authors', index, { image: value }, authors), `${author.name || ''} ${author.role || ''} ${author.bio || ''}`)))}
        {addButton('افزودن نویسنده', () => addItem('authors', { name: '', role: '', bio: '', image: '' }, authors))}
      </>}
    </NodeViewWrapper>
  )
}
const InteractiveBlock = Node.create({
  name: 'interactiveBlock',
  group: 'block',
  atom: true,
  selectable: false,
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
  const title = node.attrs?.title ?? ''
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
          placeholder={preset.label}
          aria-label="عنوان کال‌اوت"
          onChange={event => updateAttributes({ title: event.target.value })}
          onBlur={event => updateAttributes({ title: event.target.value.trim() })}
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
      title: { default: '', parseHTML: element => element.getAttribute('data-callout-title') || '', renderHTML: attrs => ({ 'data-callout-title': attrs.title || '' }) },
      icon: { default: 'ðŸ’¡', parseHTML: element => element.getAttribute('data-callout-icon') || 'ðŸ’¡', renderHTML: attrs => ({ 'data-callout-icon': attrs.icon || 'ðŸ’¡' }) },
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
  ...SHARED_INTERACTIVE_TYPES,
] as const
const interactiveKinds = new Set<string>(INTERACTIVE_TYPES.map(item => item[0]))
void LEGACY_INTERACTIVE_TYPES

const calloutIconMap = { key: Lightbulb, question: Info, warning: AlertTriangle, quote: Quote, deep: BookOpen, practice: Bookmark, glossary: FileText, data: FileText, margin: Feather, normal: Pilcrow } as const
const CALLOUT_PRESETS = SHARED_CALLOUT_PRESETS.map(item => ({ ...item, icon: calloutIconMap[item.value as keyof typeof calloutIconMap] || Pilcrow }))
const calloutPreset = (variant = 'key') => {
  const preset = sharedCalloutPreset(variant)
  return CALLOUT_PRESETS.find(item => item.value === preset.value) || CALLOUT_PRESETS[0]
}
function interactiveLabel(kind: string) { return sharedInteractiveLabel(kind) }
function compactAiContent(content?: AiStructuredContent | null) {
  if (!content) return ''
  if (content.type === 'quiz') return [content.question, ...(content.options || []).map((item: string, index: number) => `${index + 1}. ${item}`), content.explanation].filter(Boolean).join('\n')
  if (content.type === 'timeline') return [content.title, ...(content.steps || []).map((step: { title: string; description: string }, index: number) => `${index + 1}. ${step.title}: ${step.description}`)].filter(Boolean).join('\n')
  if (content.type === 'mindmap') return [content.title, ...(content.branches || []).flatMap((branch: { title: string; items?: string[] }) => [branch.title, ...(branch.items || []).map((item: string) => `- ${item}`)])].filter(Boolean).join('\n')
  if (content.type === 'callout_suggestions') return (content.suggestions || [])
    .map((item, index) => `${index + 1}. ${item.title || 'پیشنهاد کال‌اوت'}\n${item.text || item.sourceQuote || ''}`)
    .filter(Boolean)
    .join('\n\n')
  const article = content as Extract<AiStructuredContent, { type: 'article' }>
  return [
    article.title,
    article.lead,
    ...(article.sections || []).flatMap((section: { heading: string; paragraphs?: string[]; bullets?: string[] }) => [
      section.heading,
      ...(section.paragraphs || []),
      ...(section.bullets || []).map((item: string) => `- ${item}`),
    ]),
  ].filter(Boolean).join('\n')
}
function generatedInteractiveImageDataUrl(prompt: string, label = 'تصویر آموزشی') {
  const cleanPrompt = normalizeBookText(prompt || label).replace(/\s+/g, ' ').trim().slice(0, 160)
  const cleanLabel = normalizeBookText(label || 'تصویر آموزشی').replace(/\s+/g, ' ').trim().slice(0, 48)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#eef7ff"/>
      <stop offset=".52" stop-color="#fff7ed"/>
      <stop offset="1" stop-color="#eefdf5"/>
    </linearGradient>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#d97706"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="1200" height="760" rx="56" fill="url(#bg)"/>
  <circle cx="1010" cy="130" r="170" fill="#60a5fa" opacity=".18" filter="url(#soft)"/>
  <circle cx="205" cy="610" r="210" fill="#f59e0b" opacity=".14" filter="url(#soft)"/>
  <path d="M150 492 C300 355 420 557 560 418 S820 302 1035 388" fill="none" stroke="url(#line)" stroke-width="22" stroke-linecap="round" opacity=".55"/>
  <g transform="translate(760 176)">
    <rect width="260" height="260" rx="46" fill="#ffffff" opacity=".72"/>
    <path d="M70 173h120M70 128h120M70 83h120" stroke="#2563eb" stroke-width="16" stroke-linecap="round"/>
    <circle cx="55" cy="83" r="12" fill="#d97706"/><circle cx="55" cy="128" r="12" fill="#10b981"/><circle cx="55" cy="173" r="12" fill="#6366f1"/>
  </g>
  <text x="96" y="142" direction="rtl" unicode-bidi="bidi-override" font-family="Vazirmatn, Arial, sans-serif" font-size="42" font-weight="800" fill="#0f172a">${escape(cleanLabel)}</text>
  <foreignObject x="90" y="186" width="610" height="270">
    <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:Vazirmatn,Arial,sans-serif;font-size:34px;line-height:1.85;color:#334155;font-weight:600">${escape(cleanPrompt)}</div>
  </foreignObject>
  <text x="96" y="676" direction="rtl" unicode-bidi="bidi-override" font-family="Vazirmatn, Arial, sans-serif" font-size="24" fill="#64748b">MetaBooki AI visual draft</text>
</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
function interactiveTemplate(kind: string) {
  return sharedInteractiveTemplate(kind)
}
function interactivePreview(kind: string, data: any): any[] {
  return sharedInteractivePreview(kind, data)
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
  const ordered = lines.every(line => /^[\d\u06F0-\u06F9\u0660-\u0669]+[.)-]\s+/.test(line))
  const bullet = lines.every(line => /^[\u2022\u25CF*-]\s+/.test(line))
  if (!ordered && !bullet) return null
  return {
    ordered,
    items: lines.map(line => line.replace(ordered ? /^[\d\u06F0-\u06F9\u0660-\u0669]+[.)-]\s+/ : /^[\u2022\u25CF*-]\s+/, '')),
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

function resolveTocAfterHeadingSync(pages: any[] = [], generatedToc: ConfirmedTocEntry[] = []) {
  return generatedToc.slice().sort((a, b) => {
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

const cleanAiSourceText = (value = '') => normalizeBookText(String(value)).replace(/\s+/g, ' ').trim()
const aiParagraphCandidates = (text: string) => text
  .split(/\n{1,}|\r{1,}/)
  .map(cleanAiSourceText)
  .filter(item => item.length > 36)
  .slice(0, 18)

const isProcessCandidate = (text: string) => /(مرحله|گام|فرایند|فرآیند|روند|ابتدا|سپس|بعد از|در نهایت|اول|دوم|سوم|چهارم|تصمیم|شاخه|اگر|آنگاه)/.test(text)
const isTimelineCandidate = (text: string) => /(تاریخچه|سال|دوره|قرن|دهه|۱۳\d{2}|۱۴\d{2}|19\d{2}|20\d{2})/.test(text)
const isDataCandidate = (text: string) => /(\d|٪|درصد|آمار|منبع|مطالعه|پژوهش|مقاله|جدول|نمودار)/.test(text)

const toStepItems = (text: string) => {
  const parts = text
    .split(/(?:؛|\.|،\s*(?=سپس|بعد|در نهایت|اول|دوم|سوم|چهارم)|\n+)/)
    .map(cleanAiSourceText)
    .filter(item => item.length > 18)
    .slice(0, 6)
  return (parts.length >= 2 ? parts : [text]).map((item, index) => ({
    title: `گام ${(index + 1).toLocaleString('fa-IR')}`,
    description: item,
  }))
}

const buildAiUpgradeSuggestions = (pageText: string, aiText = ''): AiUpgradeSuggestion[] => {
  const paragraphs = aiParagraphCandidates(pageText)
  const suggestions: AiUpgradeSuggestion[] = []
  const first = paragraphs[0] || cleanAiSourceText(pageText).slice(0, 420)
  const data = paragraphs.find(isDataCandidate)
  const process = paragraphs.find(isProcessCandidate)
  const timeline = paragraphs.find(isTimelineCandidate)
  const question = paragraphs.find(item => item.includes('؟') || /(چرا|چگونه|چه چیزی|کدام)/.test(item))
  const aiFirstLine = cleanAiSourceText(aiText).split(/[.!؟]/).find(Boolean) || ''

  if (first) suggestions.push({
    id: `callout-key-${Date.now()}`,
    kind: 'callout',
    variant: 'key',
    title: 'نکته کلیدی',
    text: (aiFirstLine || first).slice(0, 280),
    sourceText: first,
    reason: 'برای برجسته کردن پیام اصلی این بخش مناسب است.',
  })
  if (question || first) suggestions.push({
    id: `callout-question-${Date.now() + 1}`,
    kind: 'callout',
    variant: 'question',
    title: 'مکث و فکر کن',
    text: question ? `از این بخش چه نتیجه‌ای می‌گیرید؟ ${question.slice(0, 180)}` : 'خواننده بعد از این بخش چه تصمیم یا برداشتی باید داشته باشد؟',
    sourceText: question || first,
    reason: 'یک توقف کوتاه برای درگیر کردن خواننده ایجاد می‌کند.',
  })
  if (data) suggestions.push({
    id: `callout-data-${Date.now() + 2}`,
    kind: 'callout',
    variant: 'data',
    title: 'داده و منبع',
    text: data.slice(0, 260),
    sourceText: data,
    reason: 'این جمله عدد، منبع یا داده دارد و بهتر است جدا دیده شود.',
  })
  if (process) suggestions.push({
    id: `interactive-steps-${Date.now() + 3}`,
    kind: 'interactive',
    interactiveKind: 'steps',
    title: 'تبدیل به مراحل تعاملی',
    payload: { title: 'مراحل پیشنهادی', steps: toStepItems(process), imagePrompt: `تصویر آموزشی مرحله‌ای برای: ${process.slice(0, 180)}` },
    sourceText: process,
    reason: 'متن نشانه‌های روند یا چند مرحله دارد.',
  })
  if (timeline && timeline !== process) suggestions.push({
    id: `interactive-timeline-${Date.now() + 4}`,
    kind: 'interactive',
    interactiveKind: 'timeline',
    title: 'تبدیل به تایم‌لاین',
    payload: { title: 'تایم‌لاین پیشنهادی', events: toStepItems(timeline).map((item, index) => ({ title: item.title, description: item.description, year: String(index + 1) })) },
    sourceText: timeline,
    reason: 'متن حالت تاریخی، زمانی یا دوره‌ای دارد.',
  })

  return suggestions.slice(0, 6)
}

const aiCalloutSuggestionsFromContent = (content: AiStructuredContent | undefined, pageText: string, fallbackText = ''): AiUpgradeSuggestion[] => {
  const calloutContent = content as any
  if (calloutContent?.type === 'callout_suggestions' && Array.isArray(calloutContent.suggestions)) {
    return calloutContent.suggestions
      .filter((item: any) => item?.sourceQuote && item?.text)
      .slice(0, 5)
      .map((item: any, index: number) => ({
        id: `callout-ai-${Date.now()}-${index}`,
        kind: 'callout',
        variant: item.variant || 'key',
        title: item.title || 'پیشنهاد کال‌اوت',
        text: item.text,
        sourceText: item.sourceQuote,
        reason: item.reason || 'برای بهتر شدن خوانش این بخش',
      }))
  }
  return buildAiUpgradeSuggestions(pageText, fallbackText).filter(item => item.kind === 'callout')
}

export default function Edit() {
  const { id = '' } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuthContext()
  const { balance: creditBalance } = useCredits(user)
  const localInitial = useMemo(() => findPublisherBook(id) || findBookById(id), [id])
  const [book, setBook] = useState<any>(localInitial)
  const [accessError, setAccessError] = useState('')
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
  const [mediaSearch, setMediaSearch] = useState('')
  const [interactiveMediaView, setInteractiveMediaView] = useState<InteractiveMediaView>('home')
  const [interactiveImagePrompt, setInteractiveImagePrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiProgress, setAiProgress] = useState<AiProgressState | null>(null)
  const [aiUsage, setAiUsage] = useState<RunAiResult['usage'] | null>(null)
  const [aiDraft, setAiDraft] = useState<{ type: 'summary' | 'quiz' | 'interactive'; title: string; text?: string; payload?: Record<string, unknown>; kind?: string } | null>(null)
  const [aiCalloutSuggestions, setAiCalloutSuggestions] = useState<Array<{ variant: string; title: string; text: string; sourceText?: string; reason?: string }>>([])
  const [aiUpgradeSuggestions, setAiUpgradeSuggestions] = useState<AiUpgradeSuggestion[]>([])
  const [activeAiSuggestionId, setActiveAiSuggestionId] = useState<string | null>(null)
  const [aiCostDialog, setAiCostDialog] = useState<AiCostDialog | null>(null)
  const [aiRunDialog, setAiRunDialog] = useState<AiRunApprovalDialog | null>(null)
  const [interactiveImageChoice, setInteractiveImageChoice] = useState<AiUpgradeSuggestion | null>(null)
  const [animatedCreditBalance, setAnimatedCreditBalance] = useState(creditBalance)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentStageRef = useRef<HTMLElement>(null)
  const switchingSegmentRef = useRef(false)
  const loadedSegmentRef = useRef<EditorSegment | undefined>(undefined)
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
  const interactiveImageChoices = useMemo(() => {
    const start = activeSegment?.start ?? 0
    const end = activeSegment?.end ?? start + 1
    return bookImages
      .filter((image: any) => image.url)
      .map((image: any) => ({ ...image, sameSegment: Number(image.pageIndex ?? -1) >= start && Number(image.pageIndex ?? -1) < end }))
      .sort((a: any, b: any) => Number(b.sameSegment) - Number(a.sameSegment) || Number(a.pageIndex ?? 9999) - Number(b.pageIndex ?? 9999))
  }, [bookImages, activeSegment?.start, activeSegment?.end])

  useEffect(() => {
    const current = book || localInitial
    if (current?.status === 'published' && current?.review_status === 'approved') {
      setAccessError('این کتاب منتشر شده است و امکان ویرایش مستقیم ندارد. اگر هنوز خریداری نشده، ابتدا آن را از صفحه انتشارات از نشر خارج کنید.')
      return
    }
    if (!current || authLoading) return
    if (!user) {
      setAccessError('برای ویرایش کتاب باید وارد حساب ناشر شوید.')
      return
    }
    let cancelled = false
    ;(async () => {
      if (UUID_RE.test(String(current.id || id))) {
        const ownPublisher = await (supabase as any).from('publisher_profiles').select('id').eq('user_id', user.id).maybeSingle()
        if (cancelled) return
        if (ownPublisher.error) {
          setAccessError(ownPublisher.error.message)
          return
        }
        setAccessError(!ownPublisher.data?.id || ownPublisher.data.id !== current.publisher_id
          ? 'شما مالک انتشارات این کتاب نیستید و اجازه ویرایش آن را ندارید.'
          : '')
        return
      }
      setAccessError(user.mockData?.id && current.publisher_id !== user.mockData.id
        ? 'شما مالک انتشارات این کتاب نیستید و اجازه ویرایش آن را ندارید.'
        : '')
    })()
    return () => { cancelled = true }
  }, [authLoading, book, id, localInitial, user])
  const filteredBookImages = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase()
    if (!q) return bookImages
    return bookImages.filter((image: any) => `${image.caption || ''} ${image.originalName || ''} ${image.name || ''} ${image.printPage || ''} ${image.issue || ''}`.toLowerCase().includes(q))
  }, [bookImages, mediaSearch])

  useEffect(() => {
    setAnimatedCreditBalance(creditBalance)
  }, [creditBalance])

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
    const loadedSegment = loadedSegmentRef.current || activeSegment
    if (!activeEditor || !loadedSegment) return sourcePages
    const editedPages = editorJsonToPages(activeEditor.getJSON())
    return mergeSegmentPages(sourcePages, loadedSegment, editedPages)
  }

  const loadSegment = (segment: EditorSegment | undefined, pages = allPages) => {
    const activeEditor = getEditor()
    if (!activeEditor || !segment) return
    switchingSegmentRef.current = true
    loadedSegmentRef.current = segment
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
    if (authLoading || localInitial || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) return
    ;(supabase as any).from('books').select('*').eq('id', id).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return
      setBook(data); setTitle(data.title); setSubtitle(data.subtitle || ''); setDescription(data.description || ''); setPreludeTitle(data.metadata?.prelude_title || 'ابتدای کتاب')
      setBackgroundUrl(data.metadata?.page_background_url || ''); setBackgroundAlpha(Number(data.metadata?.page_background_alpha || 0))
      setAllPages(data.pages || [])
      setActiveSegmentIndex(0)
      loadSegment(buildConfirmedTocSegments(data.pages || [], confirmedTocFromBook(data), data.metadata?.prelude_title || 'ابتدای کتاب')[0], data.pages || [])
    })
  }, [authLoading, editor, id, localInitial, user?.id])

  useEffect(() => {
    if (!editor) return
    loadSegment(activeSegment, allPages)
  }, [editor])

  const save = async (quiet = false) => {
    const activeEditor = getEditor()
    if (!activeEditor || !id) return
    setSaving(true)
    try {
      const mergedPages = mergeCurrentSegment()
      const synced = syncPagesAndTocFromHeadings(mergedPages, tocEntries)
      const pages = synced.pages
      const safeToc = resolveTocAfterHeadingSync(pages, synced.toc)
      const metadata = { ...(book?.metadata || {}), confirmed_toc: safeToc, page_background_url: backgroundUrl, page_background_alpha: backgroundAlpha, prelude_title: preludeTitle }
      const patch = { title, subtitle, description, pages, metadata, page_count: pages.length, content_updated_at: new Date().toISOString() }
      updatePublisherBook(id, patch as any)
      setAllPages(pages); setBook((current: any) => ({ ...current, ...patch })); setSavedAt(new Date())
      if (!quiet && import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
        await (supabase as any).from('books').update({ title, subtitle, description, pages, metadata, content_updated_at: patch.content_updated_at }).eq('id', id)
      }
      if (!quiet) activeEditor.commands.focus()
    } finally {
      setSaving(false)
    }
  }

  const previewCurrentBook = async () => {
    if (!id) return
    const previewWindow = window.open('about:blank', '_blank')
    await save(true)
    const previewUrl = readerUrl(id, `/edit/${id}`)
    if (previewWindow) {
      previewWindow.opener = null
      previewWindow.location.replace(previewUrl)
      return
    }
    openBookPreview(id)
  }

  const refreshLiveTocFromEditor = () => {
    const activeEditor = getEditor()
    if (!activeEditor || switchingSegmentRef.current) return
    // Keep the loaded editor segment stable while typing. TOC/page sync runs on save,
    // otherwise a heading edit can move the active segment under the open document.
  }

  useEffect(() => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    const onUpdate = () => {
      if (switchingSegmentRef.current) return
      setEditorRevision(revision => revision + 1)
      if (liveTocTimerRef.current) window.clearTimeout(liveTocTimerRef.current)
      liveTocTimerRef.current = window.setTimeout(refreshLiveTocFromEditor, 1800)
    }
    activeEditor.on('update', onUpdate)
    return () => {
      activeEditor.off('update', onUpdate)
      if (liveTocTimerRef.current) window.clearTimeout(liveTocTimerRef.current)
    }
  }, [editor, allPages, tocEntries, activeSegment, book?.metadata])

  useEffect(() => {
    if (!editorRevision) return
    const timer = window.setTimeout(() => save(true), 8000)
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
  const selectedInteractiveKind = editor?.isActive('interactiveBlock') ? String(editor.getAttributes('interactiveBlock').kind || 'interactive') : ''
  const selectedInteractiveLabel = selectedInteractiveKind ? interactiveLabel(selectedInteractiveKind) : ''

  if (accessError) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">{accessError}</h1><RouterLink to="/publisher/me" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">بازگشت به انتشارات</RouterLink></div>
  if (!book && !localInitial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">در حال دریافت پیش‌نویس کتاب...</h1></div>

  const command = (action: (activeEditor: NonNullable<typeof editor>) => void) => {
    const activeEditor = getEditor()
    if (!activeEditor) return
    action(activeEditor)
    activeEditor.commands.focus()
  }
  const clearNativeSelectionSoon = () => window.setTimeout(() => window.getSelection()?.removeAllRanges(), 0)
  const addInteractive = (kind: string) => {
    command(activeEditor => activeEditor.chain().focus().insertContent({ type: 'interactiveBlock', attrs: { kind, payload: encodePayload(interactiveTemplate(kind)) } }).run())
    clearNativeSelectionSoon()
  }
  const openInteractiveEditor = async () => {
    if (!editor?.isActive('interactiveBlock')) return
    const attrs = editor.getAttributes('interactiveBlock') as { kind: string; payload: string }
    const payload = decodePayload(attrs.payload)
    if (attrs.kind === 'quiz') {
      const question = window.prompt('Ù…ØªÙ† Ø³ÙˆØ§Ù„', payload.question || '') ?? payload.question
      const optionsText = window.prompt('Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§Ø› Ù‡Ø± Ú¯Ø²ÛŒÙ†Ù‡ Ø¯Ø± ÛŒÚ© Ø®Ø·', (payload.options || []).join('\n'))
      payload.question = question
      if (optionsText) payload.options = optionsText.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
      const correct = window.prompt('Ø´Ù…Ø§Ø±Ù‡ Ú¯Ø²ÛŒÙ†Ù‡ ØµØ­ÛŒØ­', String((payload.correct ?? 0) + 1))
      if (correct && !Number.isNaN(Number(correct))) payload.correct = Math.max(0, Number(correct) - 1)
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'timeline') {
      const rawEvents = window.prompt('Ø±ÙˆÛŒØ¯Ø§Ø¯Ù‡Ø§Ø› Ù‡Ø± Ø®Ø· Ø¨Ù‡ Ø´Ú©Ù„ Ø¹Ù†ÙˆØ§Ù† | ØªÙˆØ¶ÛŒØ­ | Ø²Ù…Ø§Ù†', (payload.events || []).map((event: any) => `${event.title || ''} | ${event.description || ''} | ${event.year || ''}`).join('\n'))
      if (rawEvents) payload.events = rawEvents.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ title: parts[0], description: parts[1] || '', year: parts[2] || '' }))
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'gallery') {
      const rawImages = window.prompt('Ú©Ù¾Ø´Ù†â€ŒÙ‡Ø§ÛŒ Ú¯Ø§Ù„Ø±ÛŒØ› Ù‡Ø± Ø®Ø· ÛŒÚ© Ú©Ù¾Ø´Ù†', (payload.images || []).map((image: any) => image.caption || '').join('\n'))
      if (rawImages) payload.images = rawImages.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean).map((caption: string, index: number) => ({ url: payload.images?.[index]?.url || '', caption }))
      if (window.confirm('Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ ÛŒÚ© ØªØµÙˆÛŒØ± Ø¬Ø¯ÛŒØ¯ Ù‡Ù… Ø¨Ù‡ Ú¯Ø§Ù„Ø±ÛŒ Ø§Ø¶Ø§ÙÙ‡ Ú©Ù†ÛŒØ¯ØŸ')) await insertImageIntoInteractive()
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'flashcard') {
      const rawCards = window.prompt('ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øªâ€ŒÙ‡Ø§Ø› Ù‡Ø± Ø®Ø· Ø¨Ù‡ Ø´Ú©Ù„ Ø±ÙˆÛŒ Ú©Ø§Ø±Øª | Ù¾Ø´Øª Ú©Ø§Ø±Øª', (payload.cards || []).map((card: any) => `${card.front || ''} | ${card.back || ''}`).join('\n'))
      if (rawCards) payload.cards = rawCards.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ front: parts[0], back: parts[1] || '' }))
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'scrollytelling' || attrs.kind === 'steps') {
      const rawSteps = window.prompt('Ù…Ø±Ø­Ù„Ù‡â€ŒÙ‡Ø§Ø› Ù‡Ø± Ø®Ø· Ø¨Ù‡ Ø´Ú©Ù„ Ø¹Ù†ÙˆØ§Ù† | ØªÙˆØ¶ÛŒØ­', (payload.steps || []).map((step: any) => `${step.title || step.text || ''} | ${step.description || ''}`).join('\n'))
      if (rawSteps) {
        payload.steps = rawSteps.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[], index: number) => ({
          ...(payload.steps?.[index] || {}),
          title: attrs.kind === 'steps' ? parts[0] : undefined,
          text: attrs.kind === 'scrollytelling' ? parts[0] : undefined,
          description: parts[1] || '',
        }))
      }
      if (window.confirm('Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ Ø¨Ø±Ø§ÛŒ Ù…Ø±Ø­Ù„Ù‡ Ù†Ø®Ø³Øª ØªØµÙˆÛŒØ± Ù‡Ù… Ø§Ø¶Ø§ÙÙ‡ Ú©Ù†ÛŒØ¯ØŸ')) await insertImageIntoInteractive()
      updateInteractivePayload(attrs, payload)
      return
    }
    if (attrs.kind === 'hotspot') {
      const caption = window.prompt('Ø¹Ù†ÙˆØ§Ù† ÛŒØ§ Ú©Ù¾Ø´Ù† ØªØµÙˆÛŒØ±', payload.caption || payload.title || '') ?? payload.caption
      const rawPoints = window.prompt('Ù†Ù‚Ø§Ø· ØªØ¹Ø§Ù…Ù„ÛŒØ› Ù‡Ø± Ø®Ø· Ø¨Ù‡ Ø´Ú©Ù„ Ø¹Ù†ÙˆØ§Ù† | ØªÙˆØ¶ÛŒØ­ | x | y', (payload.points || []).map((point: any) => `${point.title || ''} | ${point.text || ''} | ${point.x ?? 50} | ${point.y ?? 50}`).join('\n'))
      payload.caption = caption
      if (rawPoints) payload.points = rawPoints.split(/\r?\n/).map((line: string) => line.split('|').map(part => part.trim())).filter((parts: string[]) => parts[0]).map((parts: string[]) => ({ title: parts[0], text: parts[1] || '', x: Number(parts[2] || 50), y: Number(parts[3] || 50) }))
      if (window.confirm('Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ ØªØµÙˆÛŒØ± Ø§ØµÙ„ÛŒ Ù‡Ø§Øªâ€ŒØ§Ø³Ù¾Ø§Øª Ø±Ø§ Ù‡Ù… ØªØºÛŒÛŒØ± Ø¯Ù‡ÛŒØ¯ØŸ')) await insertImageIntoInteractive()
      updateInteractivePayload(attrs, payload)
      return
    }
    const title = window.prompt('Ø¹Ù†ÙˆØ§Ù† Ø¨Ø®Ø´ ØªØ¹Ø§Ù…Ù„ÛŒ', payload.title || payload.caption || interactiveLabel(attrs.kind))
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
    const href = window.prompt('Ø¢Ø¯Ø±Ø³ Ù¾ÛŒÙˆÙ†Ø¯', current)
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
      const attrs = { variant: preset.value, title: '', icon: preset.emoji }
      if (activeEditor.isActive('calloutBlock')) activeEditor.chain().focus().updateAttributes('calloutBlock', attrs).run()
      else activeEditor.chain().focus().wrapIn('calloutBlock', attrs).run()
    })
  }
  const editCalloutTitle = () => {
    command(activeEditor => {
      if (!activeEditor.isActive('calloutBlock')) {
        window.alert('Ø§Ø¨ØªØ¯Ø§ Ø¯Ø§Ø®Ù„ Ú©Ø§Ù„â€ŒØ§ÙˆØª Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± Ú©Ù„ÛŒÚ© Ú©Ù†ÛŒØ¯ØŒ Ø³Ù¾Ø³ Ø¹Ù†ÙˆØ§Ù† Ø±Ø§ ÙˆÛŒØ±Ø§ÛŒØ´ Ú©Ù†ÛŒØ¯.')
        return
      }
      const attrs = activeEditor.getAttributes('calloutBlock')
      const nextTitle = window.prompt('Ø¹Ù†ÙˆØ§Ù† Ú©Ø§Ù„â€ŒØ§ÙˆØª', attrs.title || calloutPreset(attrs.variant).label)
      if (nextTitle === null) return
      activeEditor.chain().focus().updateAttributes('calloutBlock', { title: nextTitle.trim() }).run()
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
    if (attrs.kind === 'gallery') payload.images = [...(payload.images || []), { url, caption: 'ØªØµÙˆÛŒØ± Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ Ø§Ø² Ú©ØªØ§Ø¨' }]
    else if (attrs.kind === 'scrollytelling') payload.steps = (payload.steps || [{ text: 'Ø±ÙˆØ§ÛŒØª ØªØµÙˆÛŒØ±ÛŒ' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else if (attrs.kind === 'steps') payload.steps = (payload.steps || [{ title: 'Ù…Ø±Ø­Ù„Ù‡ Û±' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else if (attrs.kind === 'algorithm') {
      const nodes = Array.isArray(payload.nodes) && payload.nodes.length ? payload.nodes : interactiveTemplate('algorithm').nodes
      payload.nodes = nodes.map((node: any, index: number) => index === 0 ? { ...node, image: url } : node)
    }
    else if (attrs.kind === 'author') {
      const authors = Array.isArray(payload.authors) && payload.authors.length ? payload.authors : [{ name: payload.name || 'Ù†ÙˆÛŒØ³Ù†Ø¯Ù‡', role: payload.role || '', bio: payload.bio || '' }]
      payload.authors = authors.map((author: any, index: number) => index === 0 ? { ...author, image: url } : author)
    }
    else payload.image = url
    activeEditor.chain().focus().updateAttributes('interactiveBlock', { payload: encodePayload(payload) }).run()
  }
  const uploadImageToInteractive = async (file?: File) => {
    if (!file) return
    const src = await prepareEditorImage(file)
    applyImageToInteractive(src)
  }
  const activeInteractivePrompt = () => {
    const activeEditor = getEditor()
    if (!activeEditor?.isActive('interactiveBlock')) return ''
    const attrs = activeEditor.getAttributes('interactiveBlock') as { kind: string; payload: string }
    const payload = decodePayload(attrs.payload)
    const chunks: string[] = [payload.title, payload.caption, payload.question, payload.statement, payload.explanation].filter(Boolean)
    ;['steps', 'events', 'nodes', 'items', 'tabs', 'cards', 'images', 'authors'].forEach(key => {
      const listValue = Array.isArray(payload[key]) ? payload[key] : []
      listValue.forEach((item: any) => chunks.push(item.title, item.text, item.description, item.front, item.back, item.caption, item.name, item.role, item.bio, item.year))
    })
    return cleanAiSourceText(chunks.filter(Boolean).join(' ')).slice(0, 1200)
  }
  const generateImageForInteractive = async () => {
    const activeEditor = getEditor()
    if (!activeEditor?.isActive('interactiveBlock')) {
      setAiMessage('اول داخل یک بلوک تعاملی کلیک کنید، بعد تصویر را بسازید.')
      return
    }
    const { from, to, empty } = activeEditor.state.selection
    const selectedText = empty ? '' : activeEditor.state.doc.textBetween(from, to, '\n').trim()
    const manualPrompt = interactiveImagePrompt.trim()
    const visualPrompt = manualPrompt || selectedText || activeInteractivePrompt()
    if (!visualPrompt) {
      setAiMessage('برای تولید تصویر، بخشی از متن را انتخاب کنید، پرامپت را دستی وارد کنید یا اول متن همین بلوک تعاملی را کامل کنید.')
      return
    }
    setAiLoading(true)
    progressAi('برآورد هزینه تصویر', 12, 'در حال برآورد هزینه تولید تصویر...')
    try {
      const prompt = visualPrompt.slice(0, 1400)
      const purpose: AiImagePurpose = manualPrompt ? 'direct' : 'interactive'
      const estimate = await estimateAiImageGeneration({ prompt, purpose, bookId: id, pageIndex: activeSegmentIndex, user })
      progressAi('در انتظار تایید', 28, 'برآورد تصویر آماده است؛ تایید یا لغو کنید.')
      const approved = await requestAiCostApproval('تولید تصویر با هوش مصنوعی', 'پس از تایید، تصویر تولید می‌شود و هزینه از کردیت کاربر کسر خواهد شد.', estimate.usage, estimate.model)
      if (!approved) {
        setAiMessage('تولید تصویر لغو شد و کردیتی کسر نشد.')
        setAiProgress(null)
        return
      }
      progressAi('تولید تصویر', 54, 'در حال تولید تصویر با هوش مصنوعی...')
      const result = await generateAiImageThroughGateway({ prompt, purpose, bookId: id, pageIndex: activeSegmentIndex, user })
      applyImageToInteractive(result.imageUrl)
      recordAiUsage(result.usage)
      setInteractiveImagePrompt('')
      progressAi('تکمیل شد', 100, 'تصویر تولید و در بلوک قرار گرفت.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'تولید تصویر ناموفق بود.')
      setAiProgress({ label: 'خطا در تولید تصویر', detail: error instanceof Error ? error.message : 'تولید تصویر ناموفق بود.', percent: 100 })
    } finally {
      setAiLoading(false)
    }
  }
  const generateInlineBlockImage = async (rawPrompt: string, purpose: AiImagePurpose = 'interactive') => {
    const cleanPrompt = rawPrompt.trim()
    if (!cleanPrompt) throw new Error('پرامپت تصویر خالی است.')
    const prompt = cleanPrompt.slice(0, 1400)
    setAiLoading(true)
    progressAi('برآورد هزینه تصویر', 12, 'در حال برآورد هزینه تولید تصویر...')
    try {
      const estimate = await estimateAiImageGeneration({ prompt, purpose, bookId: id, pageIndex: activeSegmentIndex, user })
      progressAi('در انتظار تایید', 28, 'برآورد تصویر آماده است؛ تایید یا لغو کنید.')
      const approved = await requestAiCostApproval('تولید تصویر داخل بلوک', 'این تصویر داخل همان جایگاه تصویر بلوک تعاملی قرار می‌گیرد.', estimate.usage, estimate.model)
      if (!approved) throw new Error('تولید تصویر لغو شد و کردیتی کسر نشد.')
      progressAi('تولید تصویر', 54, 'در حال تولید تصویر با هوش مصنوعی...')
      const result = await generateAiImageThroughGateway({ prompt, purpose, bookId: id, pageIndex: activeSegmentIndex, user })
      recordAiUsage(result.usage)
      progressAi('تکمیل شد', 100, 'تصویر تولید و در بلوک قرار گرفت.')
      return result.imageUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تولید تصویر ناموفق بود.'
      setAiMessage(message)
      setAiProgress({ label: 'خطا در تولید تصویر', detail: message, percent: 100 })
      throw error
    } finally {
      setAiLoading(false)
    }
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
  const aiTextContext = () => {
    const activeEditor = getEditor()
    if (!activeEditor) return { pageText: '', sourceText: undefined as string | undefined, insertionPos: undefined as number | undefined, hasSelection: false }
    const { from, to, empty } = activeEditor.state.selection
    const selected = empty ? '' : activeEditor.state.doc.textBetween(from, to, '\n').trim()
    return {
      pageText: selected || activeEditor.state.doc.textContent.trim(),
      sourceText: selected || undefined,
      insertionPos: to,
      hasSelection: Boolean(selected),
    }
  }
  const findTextRange = (sourceText = ''): { from: number; to: number } | null => {
    const activeEditor = getEditor()
    const clean = cleanAiSourceText(sourceText)
    if (!activeEditor || !clean) return null
    const probes = [
      clean.slice(0, 110),
      clean.split(/[.؟!؛]/).find(part => part.trim().length > 20)?.trim() || '',
      clean.split(/\s+/).slice(0, 10).join(' '),
    ].filter(Boolean) as string[]
    let found: { from: number; to: number } | null = null
    activeEditor.state.doc.descendants((node, pos) => {
      if (found || !node.isText) return !found
      const nodeTextValue = cleanAiSourceText(node.text || '')
      for (const probe of probes) {
        const index = nodeTextValue.indexOf(probe)
        if (index >= 0) {
          found = { from: pos + index, to: pos + index + probe.length }
          return false
        }
      }
      return true
    })
    return found
  }
  const focusTextSource = (sourceText = '') => {
    const activeEditor = getEditor()
    const range = findTextRange(sourceText)
    if (!activeEditor || !range) return false
    activeEditor.commands.setTextSelection(range)
    const domAtPos = activeEditor.view.domAtPos(range.from).node as globalThis.Node
    const element = domAtPos instanceof HTMLElement ? domAtPos : domAtPos.parentElement
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  const insertContentAfterSource = (sourceText: string | undefined, content: any, insertionPos?: number) => {
    command(activeEditor => {
      const range = sourceText ? findTextRange(sourceText) : null
      const position = range?.to ?? insertionPos ?? activeEditor.state.selection.to
      activeEditor.chain().focus().setTextSelection(position).insertContent(content).run()
    })
    clearNativeSelectionSoon()
  }
  const requestAiCostApproval = (title: string, description: string, usage: RunAiResult['usage'], model?: string) => new Promise<boolean>(resolve => {
    setAiCostDialog({ title, description, usage, model, resolve })
  })
  const closeAiCostDialog = (approved: boolean) => {
    aiCostDialog?.resolve(approved)
    setAiCostDialog(null)
  }
  const requestAiRunApproval = (
    title: string,
    description: string,
    supportsImage: boolean,
    textPreview: string,
    usage?: RunAiResult['usage'],
    model?: string,
    imageEstimate?: { usage: RunAiResult['usage']; total: RunAiResult['usage']; count: number; model?: string; warning?: string },
  ) => new Promise<'plain' | 'images' | null>(resolve => {
    setAiRunDialog({
      title,
      description,
      supportsImage: supportsImage && Boolean(imageEstimate?.count),
      textPreview,
      usage,
      imageUsage: imageEstimate?.usage,
      totalWithImages: imageEstimate?.total,
      imageCount: imageEstimate?.count,
      model,
      imageModel: imageEstimate?.model,
      imageWarning: imageEstimate?.warning,
      resolve,
    })
  })
  const closeAiRunDialog = (choice: 'plain' | 'images' | null) => {
    aiRunDialog?.resolve(choice)
    setAiRunDialog(null)
  }
  const insertCalloutWithText = (variant: string, heading: string, text: string, sourceText?: string, insertionPos?: number) => {
    const preset = calloutPreset(variant)
    insertContentAfterSource(sourceText, {
      type: 'calloutBlock',
      attrs: { variant: preset.value, title: heading || preset.label, icon: preset.emoji },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: text || heading || preset.label }] }],
    }, insertionPos)
  }
  const replaceSourceWithCallout = (variant: string, heading: string, text: string, sourceText?: string, insertionPos?: number) => {
    const preset = calloutPreset(variant)
    const content = {
      type: 'calloutBlock',
      attrs: { variant: preset.value, title: heading || preset.label, icon: preset.emoji },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: text || sourceText || heading || preset.label }] }],
    }
    command(activeEditor => {
      const range = sourceText ? findTextRange(sourceText) : null
      if (range) activeEditor.chain().focus().setTextSelection(range).insertContent(content).run()
      else activeEditor.chain().focus().setTextSelection(insertionPos ?? activeEditor.state.selection.to).insertContent(content).run()
    })
    clearNativeSelectionSoon()
  }
  const insertInteractivePayload = (kind: string, payload: Record<string, unknown>, sourceText?: string, insertionPos?: number) => {
    insertContentAfterSource(sourceText, { type: 'interactiveBlock', attrs: { kind, payload: encodePayload({ ...interactiveTemplate(kind), ...payload, type: kind }) } }, insertionPos)
  }
  const combineAiUsage = (items: Array<RunAiResult['usage']>): RunAiResult['usage'] => items.reduce((acc, usage) => ({
    inputTokens: acc.inputTokens + usage.inputTokens,
    outputTokens: acc.outputTokens + usage.outputTokens,
    rawUsd: acc.rawUsd + usage.rawUsd,
    chargedUsd: acc.chargedUsd + usage.chargedUsd,
    chargedToman: acc.chargedToman + usage.chargedToman,
    chargedCredits: acc.chargedCredits + usage.chargedCredits,
    creditValueToman: usage.creditValueToman || acc.creditValueToman,
  }), { inputTokens: 0, outputTokens: 0, rawUsd: 0, chargedUsd: 0, chargedToman: 0, chargedCredits: 0, creditValueToman: 1000 })
  const multiplyAiUsage = (usage: RunAiResult['usage'], count: number): RunAiResult['usage'] => ({
    ...usage,
    inputTokens: usage.inputTokens * count,
    outputTokens: usage.outputTokens * count,
    rawUsd: usage.rawUsd * count,
    chargedUsd: usage.chargedUsd * count,
    chargedToman: usage.chargedToman * count,
    chargedCredits: usage.chargedCredits * count,
  })
  const progressAi = (label: string, percent: number, detail?: string) => {
    setAiProgress({ label, percent: Math.max(0, Math.min(100, percent)), detail })
    setAiMessage(detail || label)
  }
  const imagePromptsForInteractive = (kind: string, payload: Record<string, any>, sourceText: string) => {
    const basePrompt = (text: string) => `Educational illustration for this learning concept: ${cleanAiSourceText(text).slice(0, 900)}`
    if (kind === 'steps' || kind === 'scrollytelling') {
      const steps = Array.isArray(payload.steps) ? payload.steps : []
      return steps.map((step: any, index: number) => ({
        target: 'steps',
        index,
        prompt: basePrompt(`${step.title || step.text || `مرحله ${index + 1}`}: ${step.description || ''}`),
      })).filter((item: any) => item.prompt.length > 40)
    }
    if (kind === 'timeline') {
      const events = Array.isArray(payload.events) ? payload.events : []
      return events.map((event: any, index: number) => ({
        target: 'events',
        index,
        prompt: basePrompt(`${event.year || ''} ${event.title || `رویداد ${index + 1}`}: ${event.description || ''}`),
      })).filter((item: any) => item.prompt.length > 40)
    }
    if (kind === 'algorithm') {
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : []
      return nodes.map((node: any, index: number) => ({
        target: 'nodes',
        index,
        prompt: basePrompt(`${node.title || `گره ${index + 1}`}: ${node.description || node.text || ''}`),
      })).filter((item: any) => item.prompt.length > 40)
    }
    return [{ target: 'image', index: 0, prompt: basePrompt(payload.title || payload.question || sourceText || 'مفهوم آموزشی این بخش') }]
  }
  const likelyInteractiveImagePlan = (pageText: string) => {
    const process = aiParagraphCandidates(pageText).find(isProcessCandidate) || aiParagraphCandidates(pageText)[0] || pageText
    const kind = isTimelineCandidate(process) ? 'timeline' : 'steps'
    const steps = toStepItems(process)
    const payload: Record<string, unknown> = {
      title: kind === 'timeline' ? 'تایم‌لاین پیشنهادی' : 'مسیر مرحله‌ای پیشنهادی',
      ...(kind === 'timeline' ? { events: steps.map((item, index) => ({ ...item, year: String(index + 1) })) } : { steps }),
    }
    const prompts = imagePromptsForInteractive(kind, payload, process).slice(0, 6)
    return { kind, process, prompts, imageCount: Math.max(1, prompts.length || 1) }
  }
  const enrichInteractivePayloadWithImages = async (kind: string, payload: Record<string, unknown>, sourceText: string, options: { skipApproval?: boolean; maxImages?: number } = {}) => {
    const nextPayload = JSON.parse(JSON.stringify(payload || {}))
    const prompts = imagePromptsForInteractive(kind, nextPayload, sourceText).slice(0, options.maxImages ?? 6)
    if (!prompts.length) return nextPayload
    setAiLoading(true)
    progressAi('برآورد هزینه تصویر', 18, `در حال برآورد هزینه ${prompts.length.toLocaleString('fa-IR')} تصویر...`)
    try {
      const firstEstimate = await estimateAiImageGeneration({ prompt: prompts[0].prompt, purpose: 'interactive', bookId: id, pageIndex: activeSegmentIndex, user })
      const estimatedUsage = multiplyAiUsage(firstEstimate.usage, prompts.length)
      const approved = options.skipApproval || await requestAiCostApproval(
        `تولید ${prompts.length.toLocaleString('fa-IR')} تصویر برای بخش تعاملی`,
        `برای هر آیتم تعاملی، متن همان آیتم به عنوان پرامپت تصویر استفاده می‌شود. ${firstEstimate.warning || ''}`.trim(),
        estimatedUsage,
        firstEstimate.model,
      )
      if (!approved) {
        setAiMessage('افزودن تصویر لغو شد؛ بخش تعاملی بدون تصویر اضافه می‌شود.')
        return nextPayload
      }
      const usages: Array<RunAiResult['usage']> = []
      for (const item of prompts) {
        const currentIndex = prompts.indexOf(item) + 1
        progressAi('تولید تصویر', 48 + Math.round((currentIndex / prompts.length) * 38), `در حال تولید تصویر ${currentIndex.toLocaleString('fa-IR')} از ${prompts.length.toLocaleString('fa-IR')}...`)
        const result = await generateAiImageThroughGateway({ prompt: item.prompt, purpose: 'interactive', bookId: id, pageIndex: activeSegmentIndex, user })
        usages.push(result.usage)
        if (item.target === 'steps' && Array.isArray(nextPayload.steps)) nextPayload.steps[item.index] = { ...nextPayload.steps[item.index], image: result.imageUrl }
        else if (item.target === 'events' && Array.isArray(nextPayload.events)) nextPayload.events[item.index] = { ...nextPayload.events[item.index], image: result.imageUrl }
        else if (item.target === 'nodes' && Array.isArray(nextPayload.nodes)) nextPayload.nodes[item.index] = { ...nextPayload.nodes[item.index], image: result.imageUrl }
        else nextPayload.image = result.imageUrl
      }
      recordAiUsage(combineAiUsage(usages))
      return nextPayload
    } finally {
      setAiLoading(false)
    }
  }
  const recordAiUsage = (usage: RunAiResult['usage']) => {
    setAiUsage(usage)
    const before = Math.max(Number(animatedCreditBalance || 0), Number(usage.chargedCredits || 0))
    const after = Math.max(0, before - Number(usage.chargedCredits || 0))
    setAnimatedCreditBalance(after)
    creditsBus.emit(after)
    setAiMessage(`${usage.chargedCredits.toLocaleString('fa-IR')} کردیت کسر شد · ${usage.chargedToman.toLocaleString('fa-IR')} تومان · $${usage.chargedUsd.toFixed(6)}`)
  }
  const previewAiSuggestion = (item: AiUpgradeSuggestion) => {
    setActiveAiSuggestionId(item.id)
    if (!focusTextSource(item.sourceText)) setAiMessage('محل دقیق متن پیدا نشد، اما پیشنهاد آماده افزودن است.')
  }
  const applyAiUpgradeSuggestion = async (item: AiUpgradeSuggestion, withImages = false) => {
    previewAiSuggestion(item)
    if (item.kind === 'callout') replaceSourceWithCallout(item.variant || 'key', item.title, item.text || item.sourceText, item.sourceText)
    if (item.kind === 'interactive') {
      const kind = item.interactiveKind || 'steps'
      const payload = withImages ? await enrichInteractivePayloadWithImages(kind, item.payload || {}, item.sourceText) : (item.payload || {})
      insertInteractivePayload(kind, payload, item.sourceText)
    }
    if (item.kind === 'quiz' && item.payload) insertInteractivePayload('quiz', item.payload, item.sourceText)
    if (item.kind === 'summary') insertCalloutWithText('key', item.title, item.text || '', item.sourceText)
  }
  const runEditorAi = async (mode: 'summary' | 'quiz' | 'callout' | 'interactive' | 'review') => {
    const context = aiTextContext()
    const pageText = context.pageText
    if (!pageText) {
      setAiMessage('اول بخشی از متن را انتخاب کنید یا داخل بخش مورد نظر قرار بگیرید.')
      return
    }
    const action = mode === 'quiz' ? 'quiz' : mode === 'interactive' ? 'learning_path' : mode === 'summary' ? 'summary' : mode === 'callout' ? 'callout_suggestions' : 'explain'
    setAiLoading(true)
    setAiDraft(null)
    setAiCalloutSuggestions([])
    setAiUpgradeSuggestions([])
    progressAi('برآورد هزینه', 8, 'در حال محاسبه سقف هزینه متن...')
    try {
      const estimate = await estimateAiTextUsage({ action, bookTitle: title || book?.title || 'کتاب', pageTitle: activeSegment?.label, pageText, bookId: id, pageIndex: activeSegmentIndex, user })
      let approvedImageCount = 0
      let imageEstimate: { usage: RunAiResult['usage']; total: RunAiResult['usage']; count: number; model?: string; warning?: string } | undefined
      if (mode === 'interactive') {
        const plan = likelyInteractiveImagePlan(pageText)
        approvedImageCount = plan.imageCount
        progressAi('برآورد هزینه تصویر', 18, `در حال محاسبه هزینه ${approvedImageCount.toLocaleString('fa-IR')} تصویر احتمالی...`)
        try {
          const firstImageEstimate = await estimateAiImageGeneration({ prompt: plan.prompts[0]?.prompt || `Educational illustration for this learning concept: ${plan.process.slice(0, 900)}`, purpose: 'interactive', bookId: id, pageIndex: activeSegmentIndex, user })
          const imageUsage = multiplyAiUsage(firstImageEstimate.usage, approvedImageCount)
          imageEstimate = {
            usage: imageUsage,
            total: combineAiUsage([estimate.usage, imageUsage]),
            count: approvedImageCount,
            model: firstImageEstimate.model,
            warning: firstImageEstimate.warning,
          }
        } catch (error) {
          approvedImageCount = 0
          setAiMessage(error instanceof Error ? `برآورد تصویر ناموفق بود: ${error.message}` : 'برآورد تصویر ناموفق بود.')
        }
      }
      setAiLoading(false)
      progressAi('در انتظار تایید', 28, 'برآورد آماده است؛ تایید یا لغو کنید.')
      const modeTitle = mode === 'summary' ? 'ساخت خلاصه' : mode === 'quiz' ? 'تولید سؤال' : mode === 'callout' ? 'پیشنهاد کال‌اوت‌های درک مطلب' : mode === 'interactive' ? 'ساخت بخش تعاملی' : 'بررسی و پیشنهاد ارتقا'
      const choice = await requestAiRunApproval(
        modeTitle,
        `${context.hasSelection ? 'فقط متن انتخاب‌شده بررسی می‌شود.' : 'چون متنی انتخاب نشده، کل همین بخش/صفحه بررسی می‌شود.'} این برآورد دست‌بالاست و قبل از مصرف واقعی از کاربر تایید گرفته می‌شود.`,
        mode === 'interactive',
        pageText.slice(0, 520),
        estimate.usage,
        estimate.model,
        imageEstimate,
      )
      if (!choice) {
        setAiMessage('درخواست هوش مصنوعی لغو شد و کردیتی کسر نشد.')
        setAiProgress(null)
        return
      }
      setAiLoading(true)
      progressAi('تولید متن', 35, 'در حال تولید خروجی هوشمند...')
      const result = await runAiThroughGateway({ action, bookTitle: title || book?.title || 'کتاب', pageTitle: activeSegment?.label, pageText, bookId: id, pageIndex: activeSegmentIndex, user })
      recordAiUsage(result.usage)
      const text = compactAiContent(result.content) || result.text || ''
      if (mode === 'summary') {
        insertCalloutWithText('key', 'خلاصه هوشمند', text || pageText.slice(0, 420), context.sourceText, context.insertionPos)
        setAiMessage('خلاصه هوشمند در محل انتخاب‌شده اضافه شد.')
        progressAi('تکمیل شد', 100, 'خلاصه هوشمند اضافه شد.')
      } else if (mode === 'quiz' && result.content?.type === 'quiz') {
        insertInteractivePayload('quiz', { question: result.content.question, options: result.content.options, correct: result.content.correctIndex, explanation: result.content.explanation }, context.sourceText, context.insertionPos)
        setAiMessage('سؤال تعاملی در محل انتخاب‌شده اضافه شد.')
        progressAi('تکمیل شد', 100, 'سؤال تعاملی اضافه شد.')
      } else if (mode === 'callout') {
        const suggestions = aiCalloutSuggestionsFromContent(result.content, pageText, text)
        setAiUpgradeSuggestions(suggestions)
        setAiMessage(suggestions.length ? 'پیشنهادهای کال‌اوت آماده‌اند. روی «نمایش محل» بزنید، پیش‌نمایش را بررسی کنید و بعد متن همان بخش را به کال‌اوت تبدیل کنید.' : 'پیشنهاد کال‌اوت مناسبی برای این بخش پیدا نشد.')
        progressAi('پیشنهادها آماده‌اند', 100, suggestions.length ? `${suggestions.length.toLocaleString('fa-IR')} پیشنهاد آماده شد.` : 'پیشنهاد مناسبی پیدا نشد.')
      } else if (mode === 'interactive') {
        const process = aiParagraphCandidates(pageText).find(isProcessCandidate) || aiParagraphCandidates(pageText)[0] || pageText
        const kind = isTimelineCandidate(process) ? 'timeline' : 'steps'
        const steps = result.content?.type === 'timeline' ? result.content.steps : toStepItems(process)
        let payload: Record<string, unknown> = { title: kind === 'timeline' ? 'تایم‌لاین پیشنهادی' : 'مسیر مرحله‌ای پیشنهادی', ...(kind === 'timeline' ? { events: steps } : { steps }), imagePrompt: `تصویر آموزشی برای: ${process.slice(0, 180)}` }
        if (choice === 'images') payload = await enrichInteractivePayloadWithImages(kind, payload, process, { skipApproval: true, maxImages: approvedImageCount || 6 })
        insertInteractivePayload(kind, payload, context.sourceText, context.insertionPos)
        setAiMessage(choice === 'images' ? 'بخش تعاملی همراه تصویر در محل انتخاب‌شده اضافه شد.' : 'بخش تعاملی در محل انتخاب‌شده اضافه شد.')
        progressAi('تکمیل شد', 100, choice === 'images' ? 'بخش تعاملی همراه تصویر اضافه شد.' : 'بخش تعاملی اضافه شد.')
      } else if (mode === 'review') {
        const suggestions = buildAiUpgradeSuggestions(pageText, text)
        setAiUpgradeSuggestions(suggestions)
        setAiMessage(suggestions.length ? 'پیشنهادها آماده‌اند. اول محل هر مورد را ببینید، سپس اگر مناسب بود آن را اضافه کنید.' : 'برای این بخش پیشنهاد روشنی پیدا نشد؛ متن انتخابی را دقیق‌تر کنید.')
        progressAi('پیشنهادها آماده‌اند', 100, suggestions.length ? `${suggestions.length.toLocaleString('fa-IR')} پیشنهاد آماده شد.` : 'پیشنهاد روشنی پیدا نشد.')
      }
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'اجرای هوش مصنوعی ناموفق بود.')
      setAiProgress({ label: 'خطا در اجرای هوش مصنوعی', detail: error instanceof Error ? error.message : 'اجرای هوش مصنوعی ناموفق بود.', percent: 100 })
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

        <div className="book-toolbar-group" aria-label="Ù…Ø¯ÛŒØ§ Ùˆ Ø¬Ø¯ÙˆÙ„">
          <button title="Ø§ÙØ²ÙˆØ¯Ù† ØªØµÙˆÛŒØ±" onClick={() => imageInputRef.current?.click()}><ImagePlus /></button>
          <button title="Ù†Ù…Ø§ÛŒØ´ ØªØµØ§ÙˆÛŒØ± Ú©ØªØ§Ø¨" onClick={() => setPanelMode('media')} className={panelMode === 'media' ? 'active' : ''}><Images /></button>
          <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && addImage(event.target.files[0])} />
          <select title="Ø§Ù†Ø¯Ø§Ø²Ù‡ ØªØµÙˆÛŒØ± Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡" defaultValue="" onChange={event => { if (event.target.value) command(activeEditor => activeEditor.chain().focus().updateAttributes('image', { width: event.target.value }).run()); event.target.value = '' }}><option value="" disabled>Ø¹Ú©Ø³</option><option value="25%">Û²ÛµÙª</option><option value="50%">ÛµÛ°Ùª</option><option value="75%">Û·ÛµÙª</option><option value="100%">Û±Û°Û°Ùª</option></select>
          <button title="Ø¬Ø¯ÙˆÙ„ Ø¬Ø¯ÛŒØ¯" onClick={() => command(activeEditor => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table2 /></button>
          <select title="ÙˆÛŒØ±Ø§ÛŒØ´ Ø¬Ø¯ÙˆÙ„ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡" defaultValue="" onChange={event => { tableAction(event.target.value); event.target.value = '' }}><option value="" disabled>Ø¬Ø¯ÙˆÙ„</option><option value="row-after">Ø§ÙØ²ÙˆØ¯Ù† Ø±Ø¯ÛŒÙ</option><option value="column-after">Ø§ÙØ²ÙˆØ¯Ù† Ø³ØªÙˆÙ†</option><option value="delete-row">Ø­Ø°Ù Ø±Ø¯ÛŒÙ</option><option value="delete-column">Ø­Ø°Ù Ø³ØªÙˆÙ†</option><option value="delete-table">Ø­Ø°Ù Ø¬Ø¯ÙˆÙ„</option></select>
        </div>

        <div className="book-toolbar-group" aria-label="ØªØ¹Ø§Ù…Ù„ÛŒ">
          <select title="Ø¨Ø®Ø´ ØªØ¹Ø§Ù…Ù„ÛŒ" defaultValue="" onChange={event => { void handleInteractiveAction(event.target.value); event.target.value = '' }}><option value="" disabled>ØªØ¹Ø§Ù…Ù„ÛŒ</option><option value="edit-current">ÙˆÛŒØ±Ø§ÛŒØ´ Ø¨Ø®Ø´ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡</option>{INTERACTIVE_TYPES.map(item => <option key={item[0]} value={item[0]}>{`Ø§ÙØ²ÙˆØ¯Ù† ${item[1]}`}</option>)}</select>
          {bookImages.length > 0 && <select title="Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² ØªØµÙˆÛŒØ± Ú©ØªØ§Ø¨ Ø¯Ø± Ø¨Ø®Ø´ ØªØ¹Ø§Ù…Ù„ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡" defaultValue="" onChange={event => { applyImageToInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>ØªØµÙˆÛŒØ±</option>{bookImages.slice(0, 100).map((image: any, index: number) => <option key={`${image.url}-${index}`} value={image.url}>{image.caption || `ØªØµÙˆÛŒØ± ${index + 1}`}</option>)}</select>}
          <button title="ÙˆÛŒØ±Ø§ÛŒØ´ Ø¬Ø²Ø¦ÛŒØ§Øª Ø¨Ø®Ø´ ØªØ¹Ø§Ù…Ù„ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡" onClick={() => void openInteractiveEditor()}><LayoutTemplate /></button>
        </div>

        <div className="book-toolbar-group" aria-label="Ù†Ù…Ø§ÛŒØ´">
          <button title="Ú©ÙˆÚ†Ú© Ú©Ø±Ø¯Ù† Ù…ØªÙ†" onClick={() => setFontSize(value => Math.max(12, value - 1))}><Minus /></button>
          <span>{fontSize.toLocaleString('fa-IR')}</span>
          <button title="Ø¨Ø²Ø±Ú¯ Ú©Ø±Ø¯Ù† Ù…ØªÙ†" onClick={() => setFontSize(value => Math.min(34, value + 1))}><Plus /></button>
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
          {panelMode === 'upgrade' ? <div className="mb-panel-content is-callout-only">
            <section className="book-editor-side-card">
              <h3><Type />ارتقا متن</h3>
              <p>متن انتخاب‌شده را به یک کال‌اوت مناسب تبدیل کنید.</p>
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
            {mediaPanelView === 'library' && (
              <label className="book-editor-media-search">
                <span>جستجو در تصاویر کتاب</span>
                <input value={mediaSearch} onChange={event => setMediaSearch(event.target.value)} placeholder="کپشن، نام فایل یا صفحه چاپی..." />
              </label>
            )}
            {bookImages.length === 0 && <p className="book-editor-empty-state">هنوز تصویری برای این کتاب ثبت نشده است.</p>}
            <div className="book-editor-image-list">
              {filteredBookImages.map((image: any, index: number) => (
                <button key={image.key || `${image.url}-${index}`} className={image.issue ? 'has-issue' : ''} disabled={!image.url} title={image.issue || 'افزودن تصویر در محل نشانگر'} onClick={() => image.url && command(activeEditor => activeEditor.chain().focus().setImage({ src: image.url, alt: image.caption || '', width: image.widthPx ? `${image.widthPx}px` : image.widthPercent ? `${image.widthPercent}%` : '100%', imageId: image.imageId || undefined, printPage: image.printPage || undefined, conversionStatus: image.conversionStatus || undefined } as any).run())}>
                  {image.url ? <img src={image.url} alt={image.caption || ''} /> : <span><AlertTriangle /></span>}
                  <b>{image.caption || image.originalName || image.name || `تصویر ${index + 1}`}</b>
                  <small>صفحه چاپی: {String(image.printPage || 'نامشخص')}</small>
                  {image.issue && <em>{image.issue}</em>}
                </button>
              ))}
              {bookImages.length > 0 && filteredBookImages.length === 0 && <p className="book-editor-empty-state">تصویری با این جستجو پیدا نشد.</p>}
            </div>
          </div> : panelMode === 'interactive' ? <div className="mb-panel-content">
            <section className="book-editor-side-card">
              <h3><LayoutTemplate />ابزار تعاملی</h3>
              <p>ابزار را انتخاب کنید؛ بعد از درج، همان‌جا داخل متن قابل ویرایش است.</p>
            </section>
            <div className="mb-command-grid">
              {INTERACTIVE_TYPES.map(([kind, label]) => <button key={kind} onClick={() => addInteractive(kind)}><LayoutTemplate />{label}</button>)}
            </div>
            <p className="book-editor-empty-state">پس از افزودن هر ابزار، متن، تصویر، گزینه‌ها و تنظیمات همان ابزار را داخل خود همان بلوک ویرایش کنید.</p>
          </div> : panelMode === 'ai' ? <div className="mb-panel-content">
            <section className="book-editor-side-card">
              <h3><Sparkles />هوش مصنوعی</h3>
              <p>ابتدا متن را انتخاب کنید. هزینه واقعی بعد از پاسخ gateway محاسبه و از کردیت کاربر کم می‌شود.</p>
            </section>
            <div className="mb-command-grid">
              <button disabled={aiLoading} onClick={() => void runEditorAi('summary')}><Sparkles />خلاصه انتخاب</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('quiz')}><Sparkles />تولید سؤال</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('callout')}><Lightbulb />پیشنهاد Callout</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('interactive')}><LayoutTemplate />پیشنهاد تعاملی</button>
              <button disabled={aiLoading} onClick={() => void runEditorAi('review')}><Sparkles />بررسی کل بخش</button>
            </div>
            {(aiLoading || aiProgress) && <section className="mb-ai-progress" aria-live="polite">
              <div className="mb-ai-progress-orb"><Sparkles /></div>
              <div>
                <strong>{aiProgress?.label || 'در حال پردازش هوش مصنوعی'}</strong>
                <p>{aiProgress?.detail || 'در حال آماده‌سازی درخواست...'}</p>
                <div className="mb-ai-progress-bar"><span style={{ width: `${aiProgress?.percent ?? 12}%` }} /></div>
              </div>
            </section>}
            {aiMessage && <p className="mb-ai-cost">{aiMessage}</p>}
            {aiUsage && <small className="mb-ai-usage">{aiUsage.inputTokens.toLocaleString('fa-IR')} توکن ورودی · {aiUsage.outputTokens.toLocaleString('fa-IR')} توکن خروجی</small>}
            {aiDraft && <section className="mb-ai-draft">
              <h3>{aiDraft.title}</h3>
              {aiDraft.text && <p>{aiDraft.text}</p>}
              {aiDraft.type === 'summary' && <button onClick={() => aiDraft.text && insertCalloutWithText('key', aiDraft.title, aiDraft.text, selectedOrCurrentText())}>افزودن خلاصه به کال‌اوت</button>}
              {aiDraft.type === 'quiz' && aiDraft.payload && <button onClick={() => insertInteractivePayload('quiz', aiDraft.payload!, selectedOrCurrentText())}>افزودن سؤال به کتاب</button>}
              {aiDraft.type === 'interactive' && aiDraft.payload && <button onClick={() => setInteractiveImageChoice({
                id: `draft-${Date.now()}`,
                kind: 'interactive',
                title: aiDraft.title,
                interactiveKind: aiDraft.kind || 'algorithm',
                payload: aiDraft.payload!,
                sourceText: selectedOrCurrentText(),
                reason: 'ساختار پیشنهادی هوش مصنوعی',
              })}>افزودن بخش تعاملی</button>}
            </section>}
            {aiCalloutSuggestions.length > 0 && <section className="mb-ai-suggestions">
              <h3>پیشنهادهای Callout</h3>
              {aiCalloutSuggestions.map((item, index) => <button key={`${item.variant}-${index}`} onClick={() => insertCalloutWithText(item.variant, item.title, item.text, item.sourceText)}><Lightbulb /><span>{item.title}<small>{item.reason || item.text}</small></span></button>)}
            </section>}
            {aiUpgradeSuggestions.length > 0 && <section className="mb-ai-upgrades">
              <h3>پیشنهادهای ارتقای همین بخش</h3>
              {aiUpgradeSuggestions.map(item => (
                <article key={item.id} className={activeAiSuggestionId === item.id ? 'is-active' : ''}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.reason}</small>
                    <p><b>بخش متن:</b> {item.sourceText.slice(0, 170)}{item.sourceText.length > 170 ? '...' : ''}</p>
                    {item.text && <p><b>پیش‌نمایش:</b> {item.text.slice(0, 190)}{item.text.length > 190 ? '...' : ''}</p>}
                  </div>
                  <footer>
                    <button type="button" onClick={() => previewAiSuggestion(item)}>نمایش محل</button>
                    <button type="button" onClick={() => item.kind === 'interactive' ? setInteractiveImageChoice(item) : void applyAiUpgradeSuggestion(item)}>{item.kind === 'callout' ? 'تبدیل به کال‌اوت' : 'افزودن'}</button>
                  </footer>
                </article>
              ))}
            </section>}
          </div> : <>
          <div className="book-editor-side-card">
            <h3><BookOpen />فهرست کتاب</h3>
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
                    <button title="ÙˆÛŒØ±Ø§ÛŒØ´ Ø¹Ù†ÙˆØ§Ù† Ø§Ø¨ØªØ¯Ø§ÛŒ Ú©ØªØ§Ø¨" onClick={() => startInlineTocEdit(-1, segment.label || preludeTitle)}><Edit3 /></button>
                  </span>
                ) : <span className="book-editor-toc-jump"><ChevronLeft /></span>}
              </div>
            ))}
          </div>
          </>}
        </aside>
        <section ref={documentStageRef} className="mb-editor-canvas"><div className="book-document-stage"><div className="book-document-paper" style={{ '--editor-font-size': `${fontSize}px`, '--page-bg': backgroundUrl ? `url("${backgroundUrl}")` : 'none', '--page-bg-alpha': backgroundAlpha } as CSSProperties}><EditorMediaContext.Provider value={{ bookImages: interactiveImageChoices, uploadImage: prepareEditorImage, generateImage: generateInlineBlockImage }}><EditorContent editor={editor} /></EditorMediaContext.Provider></div></div></section>
      </div>
      {confirmTocDelete !== null && <div className="app-modal-backdrop" role="dialog" aria-modal="true">
        <section className="app-message-modal menu-glass-70">
          <div className="app-message-art"><AlertTriangle /></div>
          <div>
            <h3>Ø­Ø°Ù Ø³Ø±ÙØµÙ„ Ø§Ø² ÙÙ‡Ø±Ø³Øª</h3>
            <p>Â«{tocEntries[confirmTocDelete]?.title}Â» ÙÙ‚Ø· Ø§Ø² ÙÙ‡Ø±Ø³Øª Ú©ØªØ§Ø¨ Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆØ¯ Ùˆ Ù…ØªÙ† Ø§ØµÙ„ÛŒ Ú©ØªØ§Ø¨ Ø¯Ø³Øªâ€ŒÙ†Ø®ÙˆØ±Ø¯Ù‡ Ø¨Ø§Ù‚ÛŒ Ù…ÛŒâ€ŒÙ…Ø§Ù†Ø¯.</p>
          </div>
          <footer>
            <button className="app-modal-secondary" onClick={() => setConfirmTocDelete(null)}>Ø§Ù†ØµØ±Ø§Ù</button>
            <button className="app-modal-danger" onClick={() => removeTocEntry(confirmTocDelete)}>Ø­Ø°Ù Ø§Ø² ÙÙ‡Ø±Ø³Øª</button>
          </footer>
        </section>
      </div>}
      {aiRunDialog && <div className="app-modal-backdrop ai-credit-backdrop" role="dialog" aria-modal="true">
        <section className="app-message-modal ai-credit-modal menu-glass-70">
          <div className="app-message-art"><Sparkles /></div>
          <div>
            <h3>{aiRunDialog.title}</h3>
            <p>{aiRunDialog.description}</p>
            {aiRunDialog.model && <small>مدل: {aiRunDialog.model}</small>}
            {aiRunDialog.usage && <div className={aiRunDialog.supportsImage && aiRunDialog.totalWithImages ? 'ai-credit-choice-grid' : 'ai-credit-flow'}>
              <span className="ai-credit-choice-card">
                <small>بدون تصویر</small>
                <b>{aiRunDialog.usage.chargedCredits.toLocaleString('fa-IR')} کردیت</b>
                <em>{aiRunDialog.usage.chargedToman.toLocaleString('fa-IR')} تومان · ${aiRunDialog.usage.chargedUsd.toFixed(6)}</em>
              </span>
              {aiRunDialog.supportsImage && aiRunDialog.imageUsage && aiRunDialog.totalWithImages ? <>
                <span className="ai-credit-choice-card is-image">
                  <small>فقط تصاویر</small>
                  <b>{aiRunDialog.imageUsage.chargedCredits.toLocaleString('fa-IR')} کردیت</b>
                  <em>{(aiRunDialog.imageCount || 0).toLocaleString('fa-IR')} تصویر · {aiRunDialog.imageUsage.chargedToman.toLocaleString('fa-IR')} تومان</em>
                </span>
                <span className="ai-credit-choice-card is-total">
                  <small>با تصویر، جمع نهایی</small>
                  <b>{aiRunDialog.totalWithImages.chargedCredits.toLocaleString('fa-IR')} کردیت</b>
                  <em>{aiRunDialog.totalWithImages.chargedToman.toLocaleString('fa-IR')} تومان · ${aiRunDialog.totalWithImages.chargedUsd.toFixed(6)}</em>
                </span>
              </> : <>
                <span><b>{aiRunDialog.usage.chargedToman.toLocaleString('fa-IR')}</b><small>تومان</small></span>
                <span><b>${aiRunDialog.usage.chargedUsd.toFixed(6)}</b><small>دلار</small></span>
              </>}
            </div>}
            {aiRunDialog.usage && <small>{aiRunDialog.usage.inputTokens.toLocaleString('fa-IR')} توکن ورودی تخمینی · سقف {aiRunDialog.usage.outputTokens.toLocaleString('fa-IR')} توکن خروجی</small>}
            {aiRunDialog.imageModel && <small>مدل تصویر: {aiRunDialog.imageModel}</small>}
            {aiRunDialog.imageWarning && <small className="ai-credit-warning">{aiRunDialog.imageWarning}</small>}
            <small>{aiRunDialog.textPreview}</small>
          </div>
          <footer>
            <button className="app-modal-secondary" onClick={() => closeAiRunDialog(null)}>انصراف</button>
            {aiRunDialog.supportsImage ? <>
              <button className="app-modal-secondary" onClick={() => closeAiRunDialog('plain')}>تایید بدون تصویر</button>
              <button className="app-modal-primary" onClick={() => closeAiRunDialog('images')}>تایید با تصویر</button>
            </> : <button className="app-modal-primary" onClick={() => closeAiRunDialog('plain')}>تایید و تولید</button>}
          </footer>
        </section>
      </div>}
      {aiCostDialog && <div className="app-modal-backdrop ai-credit-backdrop" role="dialog" aria-modal="true">
        <section className="app-message-modal ai-credit-modal menu-glass-70">
          <div className="app-message-art"><Sparkles /></div>
          <div>
            <h3>{aiCostDialog.title}</h3>
            <p>{aiCostDialog.description}</p>
            {aiCostDialog.model && <small>مدل: {aiCostDialog.model}</small>}
            <div className="ai-credit-flow">
              <span><b>{animatedCreditBalance.toLocaleString('fa-IR')}</b><small>کردیت فعلی</small></span>
              <span><b>{aiCostDialog.usage.chargedCredits.toLocaleString('fa-IR')}</b><small>هزینه</small></span>
              <span><b>{Math.max(0, animatedCreditBalance - aiCostDialog.usage.chargedCredits).toLocaleString('fa-IR')}</b><small>پس از تایید</small></span>
            </div>
            <p className="ai-credit-money">{aiCostDialog.usage.chargedToman.toLocaleString('fa-IR')} تومان · ${aiCostDialog.usage.chargedUsd.toFixed(6)}</p>
          </div>
          <footer>
            <button className="app-modal-secondary" onClick={() => closeAiCostDialog(false)}>انصراف</button>
            <button className="app-modal-primary" onClick={() => closeAiCostDialog(true)}>تایید و ادامه</button>
          </footer>
        </section>
      </div>}
      {interactiveImageChoice && <div className="app-modal-backdrop ai-credit-backdrop" role="dialog" aria-modal="true">
        <section className="app-message-modal ai-credit-modal menu-glass-70">
          <div className="app-message-art"><LayoutTemplate /></div>
          <div>
            <h3>افزودن بخش تعاملی</h3>
            <p>می‌خواهید این آیتم تعاملی با تصویر ساخته شود؟ اگر تصویر را انتخاب کنید، برای هر مرحله یا آیتم از متن همان آیتم پرامپت تصویر ساخته می‌شود و قبل از کسر کردیت هزینه را می‌بینید.</p>
            <small>{interactiveImageChoice.title}</small>
          </div>
          <footer>
            <button className="app-modal-secondary" onClick={() => { const item = interactiveImageChoice; setInteractiveImageChoice(null); void applyAiUpgradeSuggestion(item, false) }}>بدون تصویر</button>
            <button className="app-modal-primary" onClick={() => { const item = interactiveImageChoice; setInteractiveImageChoice(null); void applyAiUpgradeSuggestion(item, true) }}>با تصویر</button>
            <button className="app-modal-secondary" onClick={() => setInteractiveImageChoice(null)}>انصراف</button>
          </footer>
        </section>
      </div>}
      <button className="book-editor-scroll-top" title="Ø¨Ø§Ø²Ú¯Ø´Øª Ø¨Ù‡ Ø§Ø¨ØªØ¯Ø§ÛŒ Ù¾Ù†Ù„ Ù…Ø­ØªÙˆØ§" onClick={() => documentStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ArrowUp /></button>
      <EditorStatusBar wordCount={wordCount} language={currentLanguage} blockLabel={currentBlockLabel} zoom={100} savedAt={savedAt} saving={saving} />
    </main>
  )
}
