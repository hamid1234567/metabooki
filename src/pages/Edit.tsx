/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
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
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BookOpen, ChevronDown, ChevronUp, Eye, FileImage, Heading1, Heading2, ImagePlus, Italic, LayoutTemplate, Link2, List, ListOrdered, Minus, PanelTopClose, Pencil, Plus, Redo2, Save, Strikethrough, Subscript as SubIcon, Superscript as SuperIcon, Table2, Trash2, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findPublisherBook, updatePublisherBook } from '@/lib/publisher-books'
import { findBookById } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'
import { useAuthContext } from '@/lib/auth-context'

const escape = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const encodePayload = (value: unknown) => encodeURIComponent(JSON.stringify(value))
const decodePayload = (value = '') => { try { return JSON.parse(decodeURIComponent(value)) } catch { return {} } }
const openBookPreview = (id: string) => window.open(`${window.location.origin}${window.location.pathname}${window.location.search}#/read/${id}`, '_blank', 'noopener,noreferrer')

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
  if (!block.inline?.length) return escape(block.content || block.text || block.expression || '')
  return block.inline.map((span: any) => {
    let value = escape(span.text || '')
    const style = [span.color ? `color:${span.color}` : '', span.fontFamily ? `font-family:${span.fontFamily}` : '', span.fontSize ? `font-size:${span.fontSize}` : ''].filter(Boolean).join(';')
    if (style) value = `<span style="${style}">${value}</span>`
    if (span.bold) value = `<strong>${value}</strong>`
    if (span.italic) value = `<em>${value}</em>`
    if (span.superscript) value = `<sup>${value}</sup>`
    if (span.subscript) value = `<sub>${value}</sub>`
    if (span.footnoteId) value = `<sup title="${escape(span.footnoteText || '')}">${escape(span.footnoteId)}</sup>`
    if (span.referenceText) value = `<span title="${escape(span.referenceText)}">${value}</span>`
    if (span.href) value = `<a href="${escape(span.href)}">${value}</a>`
    return value
  }).join('')
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

function blockHtml(block: any) {
  if (block.type === 'heading') return `<h${Math.min(6, block.level || 2)}${blockAttributes(block)}>${inlineHtml(block)}</h${Math.min(6, block.level || 2)}>`
  if (block.type === 'table') return `<table><thead><tr>${(block.headers || []).map((cell: string) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${(block.rows || []).map((row: string[]) => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  if (block.type === 'image' && block.url) return `<img src="${escape(block.url)}" alt="${escape(block.caption || '')}" width="${block.widthPx ? `${block.widthPx}px` : block.widthPercent ? `${block.widthPercent}%` : '100%'}">${block.caption ? `<p data-semantic="caption">${escape(block.caption)}</p>` : ''}`
  if (['quiz', 'timeline', 'flashcard', 'steps', 'gallery', 'scrollytelling', 'hotspot'].includes(block.type)) return `<section data-interactive-kind="${block.type}" kind="${block.type}" payload="${encodePayload(block)}"></section>`
  return `<p${blockAttributes(block)}>${inlineHtml(block)}</p>`
}

function pagesToHtml(pages: any[] = []) {
  return pages.map((page, index) => `${index ? '<hr>' : ''}${(page.blocks || []).map(blockHtml).join('')}`).join('')
}

function inlineFromNode(node: any) {
  return (node.content || []).flatMap((part: any) => {
    if (part.type === 'hardBreak') return [{ text: '\n' }]
    if (part.type !== 'text') return []
    const span: any = { text: part.text || '' }
    for (const mark of part.marks || []) {
      if (mark.type === 'bold') span.bold = true
      if (mark.type === 'italic') span.italic = true
      if (mark.type === 'superscript') span.superscript = true
      if (mark.type === 'subscript') span.subscript = true
      if (mark.type === 'link') span.href = mark.attrs?.href
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
  return (node.content || []).map((part: any) => part.text || nodeText(part)).join('')
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
      page.blocks.push({ type: 'image', url: node.attrs?.src, caption: node.attrs?.alt || '', ...(width.endsWith('%') ? { widthPercent: Number.parseFloat(width) } : { widthPx: Number.parseFloat(width) }) })
    }
    else if (node.type === 'interactiveBlock') page.blocks.push({ ...decodePayload(node.attrs?.payload), type: node.attrs?.kind })
    else if (node.type === 'table') {
      const rows = (node.content || []).map((row: any) => (row.content || []).map((cell: any) => nodeText(cell)))
      page.blocks.push({ type: 'table', headers: rows[0] || [], rows: rows.slice(1) })
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content || []).map((item: any) => nodeText(item))
      page.blocks.push({ type: 'paragraph', content: items.map((item: string, index: number) => `${node.type === 'orderedList' ? `${index + 1}.` : '•'} ${item}`).join('\n') })
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
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [headings, setHeadings] = useState<Array<{ text: string; level: number; pos: number }>>([])
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [backgroundAlpha, setBackgroundAlpha] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const bookImages = useMemo(() => (book?.pages || []).flatMap((page: any) => page.blocks || []).filter((block: any) => block.type === 'image' && block.url), [book])

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, Subscript, Superscript, ResizableImage.configure({ allowBase64: true }), Link.configure({ openOnClick: false }),
      TextStyle, Color, RichTextStyle, BlockFormatting, InteractiveBlock, TableKit.configure({ table: { resizable: true } }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: pagesToHtml(localInitial?.pages || []),
    editorProps: { attributes: { class: 'book-document-prose', dir: 'rtl', spellcheck: 'true' } },
  })

  const refreshHeadings = () => {
    if (!editor) return
    const result: Array<{ text: string; level: number; pos: number }> = []
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') result.push({ text: node.textContent, level: node.attrs.level, pos }) })
    setHeadings(result)
  }

  useEffect(() => {
    if (localInitial || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) return
    ;(supabase as any).from('books').select('*').eq('id', id).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return
      setBook(data); setTitle(data.title); setSubtitle(data.subtitle || ''); setDescription(data.description || '')
      setBackgroundUrl(data.metadata?.page_background_url || ''); setBackgroundAlpha(Number(data.metadata?.page_background_alpha || 0))
      editor?.commands.setContent(pagesToHtml(data.pages || [])); window.setTimeout(refreshHeadings, 50)
    })
  }, [editor, id, localInitial])

  useEffect(() => { if (editor) window.setTimeout(refreshHeadings, 50) }, [editor])

  const save = async (quiet = false) => {
    if (!editor || !id) return
    setSaving(true)
    const pages = editorJsonToPages(editor.getJSON())
    const metadata = { ...(book?.metadata || {}), page_background_url: backgroundUrl, page_background_alpha: backgroundAlpha }
    const patch = { title, subtitle, description, pages, metadata, page_count: pages.length, content_updated_at: new Date().toISOString() }
    updatePublisherBook(id, patch as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      await (supabase as any).from('books').update({ title, subtitle, description, pages, metadata, content_updated_at: patch.content_updated_at }).eq('id', id)
    }
    setBook((current: any) => ({ ...current, ...patch })); setSavedAt(new Date()); setSaving(false); refreshHeadings()
    if (!quiet) editor.commands.focus()
  }

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      window.clearTimeout((onUpdate as any).timer)
      ;(onUpdate as any).timer = window.setTimeout(() => save(true), 1400)
    }
    editor.on('update', onUpdate)
    return () => { editor.off('update', onUpdate); window.clearTimeout((onUpdate as any).timer) }
  })

  if (!book && !localInitial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">در حال دریافت پیش‌نویس کتاب…</h1></div>

  const command = (action: () => void) => { action(); editor?.commands.focus() }
  const addInteractive = (kind: string) => editor?.chain().focus().insertContent({ type: 'interactiveBlock', attrs: { kind, payload: encodePayload(interactiveTemplate(kind)) } }).run()
  const editInteractive = () => {
    if (!editor?.isActive('interactiveBlock')) return
    const attrs = editor.getAttributes('interactiveBlock')
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
  const addImage = async (file: File) => {
    if (!editor) return
    let src = ''
    if (user && import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
      const path = `${user.id}/${id}/editor/${Date.now()}-${file.name.replace(/[^\p{L}\p{N}._-]+/gu, '-')}`
      const uploaded = await (supabase as any).storage.from('book-imports').upload(path, file, { upsert: true, contentType: file.type })
      if (!uploaded.error) src = (await (supabase as any).storage.from('book-imports').createSignedUrl(path, 60 * 60 * 24 * 365)).data?.signedUrl || ''
    }
    if (!src) src = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file) })
    editor.chain().focus().setImage({ src, alt: file.name, width: '100%' } as any).run()
  }
  const promoteSelection = (level: 1 | 2 | 3 | 4 | 5 | 6) => { editor?.chain().focus().toggleHeading({ level }).run(); window.setTimeout(refreshHeadings, 20) }
  const setDirection = (direction: 'rtl' | 'ltr') => editor?.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', { dir: direction }).run()
  const setLink = () => {
    if (!editor) return
    const current = editor.getAttributes('link').href || ''
    const href = window.prompt('آدرس پیوند', current)
    if (href === null) return
    if (!href.trim()) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }
  const setTypography = (semantic: string) => {
    const nodeType = editor?.isActive('heading') ? 'heading' : 'paragraph'
    editor?.chain().focus().updateAttributes(nodeType, { semantic: semantic === 'normal' ? null : semantic }).run()
  }
  const updateInteractivePayload = (attrs: { kind: string; payload: string }, payload: Record<string, unknown>) => {
    editor?.chain().focus().updateAttributes('interactiveBlock', { kind: attrs.kind, payload: encodePayload(payload) }).run()
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
    await addImage(selected)
    let src = ''
    if (user && import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
      const path = `${user.id}/${id}/editor/${Date.now()}-${selected.name.replace(/[^\p{L}\p{N}._-]+/gu, '-')}`
      const uploaded = await (supabase as any).storage.from('book-imports').upload(path, selected, { upsert: true, contentType: selected.type })
      if (!uploaded.error) src = (await (supabase as any).storage.from('book-imports').createSignedUrl(path, 60 * 60 * 24 * 365)).data?.signedUrl || ''
    }
    if (!src) src = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(selected) })
    applyImageToInteractive(src)
    return src
  }
  const applyImageToInteractive = (url: string) => {
    if (!editor?.isActive('interactiveBlock') || !url) return
    const attrs = editor.getAttributes('interactiveBlock')
    const payload = decodePayload(attrs.payload)
    if (attrs.kind === 'gallery') payload.images = [...(payload.images || []), { url, caption: 'تصویر انتخاب‌شده از کتاب' }]
    else if (attrs.kind === 'scrollytelling') payload.steps = (payload.steps || [{ text: 'روایت تصویری' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else if (attrs.kind === 'steps') payload.steps = (payload.steps || [{ title: 'مرحله ۱' }]).map((step: any, index: number) => index === 0 ? { ...step, image: url } : step)
    else payload.image = url
    editor.chain().focus().updateAttributes('interactiveBlock', { payload: encodePayload(payload) }).run()
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
  const handleInteractiveAction = async (value: string) => {
    if (!value) return
    if (value === 'edit-current') {
      editInteractive()
      return
    }
    addInteractive(value)
  }

  return (
    <main className="book-editor-shell" dir="rtl">
      <header className="book-editor-head menu-glass-70">
        <div><p>ادیتور کتاب · پیش‌نویس منتشرنشده</p><input value={title} onChange={event => setTitle(event.target.value)} aria-label="عنوان کتاب" /></div>
        <div className="book-save-state"><Save />{saving ? 'در حال ذخیره…' : savedAt ? `ذخیره شد ${savedAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'ذخیره خودکار فعال است'}</div>
        <div><Button variant="outline" onClick={() => setMetadataOpen(value => !value)}><PanelTopClose />مشخصات</Button><Button variant="outline" onClick={() => openBookPreview(id)}><Eye />پیش‌نمایش</Button><Button onClick={() => save()}><Save />ذخیره</Button></div>
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
        <button title="بازگشت" onClick={() => command(() => editor?.chain().focus().undo().run())}><Undo2 /></button><button title="انجام دوباره" onClick={() => command(() => editor?.chain().focus().redo().run())}><Redo2 /></button><i />
        <button title="سرفصل اصلی" onClick={() => promoteSelection(1)}><Heading1 /></button><button title="سرفصل فرعی" onClick={() => promoteSelection(2)}><Heading2 /></button>
        <button title="پررنگ" onClick={() => command(() => editor?.chain().focus().toggleBold().run())}><Bold /></button><button title="مورب" onClick={() => command(() => editor?.chain().focus().toggleItalic().run())}><Italic /></button><button title="زیرخط" onClick={() => command(() => editor?.chain().focus().toggleUnderline().run())}><UnderlineIcon /></button><button title="خط‌خورده" onClick={() => command(() => editor?.chain().focus().toggleStrike().run())}><Strikethrough /></button><button title="بالانویس" onClick={() => command(() => editor?.chain().focus().toggleSuperscript().run())}><SuperIcon /></button><button title="زیرنویس" onClick={() => command(() => editor?.chain().focus().toggleSubscript().run())}><SubIcon /></button><button title="افزودن یا ویرایش پیوند" onClick={setLink}><Link2 /></button><i />
        <select title="فونت" onChange={event => editor?.chain().focus().setMark('textStyle', { fontFamily: event.target.value }).run()}><option value="Vazirmatn">وزیرمتن</option><option value="Tahoma">Tahoma</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option></select>
        <select title="اندازه متن انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) editor?.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run(); event.target.value = '' }}><option value="" disabled>اندازه متن</option>{[12,14,16,18,20,24,28,32,40].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
        <select title="تایپوگرافی آماده" defaultValue="" onChange={event => { setTypography(event.target.value); event.target.value = '' }}><option value="" disabled>تایپوگرافی</option><option value="lead">متن آغازین</option><option value="note">نکته</option><option value="quote">نقل‌قول</option><option value="normal">متن عادی</option></select>
        <input title="رنگ متن" type="color" onChange={event => editor?.chain().focus().setColor(event.target.value).run()} /><button title="راست‌به‌چپ کردن پاراگراف" onClick={() => setDirection('rtl')}>RTL</button><button title="چپ‌به‌راست کردن پاراگراف" onClick={() => setDirection('ltr')}>LTR</button><i />
        <button title="راست‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('right').run())}><AlignRight /></button><button title="وسط‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('center').run())}><AlignCenter /></button><button title="چپ‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('left').run())}><AlignLeft /></button><button title="تراز کامل" onClick={() => command(() => editor?.chain().focus().setTextAlign('justify').run())}><AlignJustify /></button><button title="فهرست نقطه‌ای" onClick={() => command(() => editor?.chain().focus().toggleBulletList().run())}><List /></button><button title="فهرست شماره‌ای" onClick={() => command(() => editor?.chain().focus().toggleOrderedList().run())}><ListOrdered /></button><i />
        <button title="افزودن تصویر" onClick={() => imageInputRef.current?.click()}><ImagePlus /></button><input ref={imageInputRef} hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && addImage(event.target.files[0])} /><select title="اندازه تصویر انتخاب‌شده" defaultValue="" onChange={event => { if (event.target.value) editor?.chain().focus().updateAttributes('image', { width: event.target.value }).run(); event.target.value = '' }}><option value="" disabled>اندازه عکس</option><option value="25%">۲۵٪</option><option value="50%">۵۰٪</option><option value="75%">۷۵٪</option><option value="100%">۱۰۰٪</option></select><button title="جدول جدید" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></button><select title="ویرایش جدول انتخاب‌شده" defaultValue="" onChange={event => { tableAction(event.target.value); event.target.value = '' }}><option value="" disabled>ویرایش جدول</option><option value="row-after">افزودن ردیف</option><option value="column-after">افزودن ستون</option><option value="delete-row">حذف ردیف</option><option value="delete-column">حذف ستون</option><option value="delete-table">حذف جدول</option></select><button title="صفحه جدید" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><FileImage /></button>
        <select title="افزودن بخش تعاملی" defaultValue="" onChange={event => { if (event.target.value) addInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>تعاملی +</option>{INTERACTIVE_TYPES.map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select><button title="ویرایش بخش تعاملی انتخاب‌شده" onClick={editInteractive}><LayoutTemplate /></button>{bookImages.length > 0 && <select title="استفاده از تصویر کتاب در بخش تعاملی انتخاب‌شده" defaultValue="" onChange={event => { applyImageToInteractive(event.target.value); event.target.value = '' }}><option value="" disabled>تصویر برای تعاملی</option>{bookImages.slice(0, 100).map((image: any, index: number) => <option key={`${image.url}-${index}`} value={image.url}>{image.caption || `تصویر ${index + 1}`}</option>)}</select>}<i />
        <button title="کوچک کردن متن" onClick={() => setFontSize(value => Math.max(12, value - 1))}><Minus /></button><span>{fontSize.toLocaleString('fa-IR')}</span><button title="بزرگ کردن متن" onClick={() => setFontSize(value => Math.min(34, value + 1))}><Plus /></button>
      </div>

      <div className="book-editor-layout">
        <aside className="book-editor-side menu-glass-70"><h3><BookOpen />فهرست کتاب</h3><p>برای رفتن به هر بخش کلیک کنید. سطح هر عنوان را همین‌جا تغییر دهید؛ انتخاب متن و زدن H1/H2 نیز آن را به فهرست اضافه می‌کند.</p>{headings.map((heading, index) => <div className="book-editor-toc-row" key={`${heading.pos}-${index}`} style={{ paddingInlineStart: `${(heading.level - 1) * 8}px` }}><button onClick={() => editor?.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run()}>{heading.text || 'سرفصل بدون عنوان'}</button><select value={heading.level} onChange={event => changeHeadingLevel(heading.pos, event.target.value)}>{[1,2,3,4,5,6].map(level => <option key={level} value={level}>H{level}</option>)}<option value="body">متن عادی</option></select></div>)}{bookImages.length > 0 && <div className="book-editor-images"><h3><ImagePlus />تصاویر کتاب</h3><div>{bookImages.map((image: any, index: number) => <button key={`${image.url}-${index}`} title="افزودن دوباره این تصویر" onClick={() => editor?.chain().focus().setImage({ src: image.url, alt: image.caption || '', width: image.widthPx ? `${image.widthPx}px` : image.widthPercent ? `${image.widthPercent}%` : '100%' } as any).run()}><img src={image.url} alt={image.caption || ''} /></button>)}</div></div>}</aside>
        <section className="book-document-stage"><div className="book-document-paper" style={{ '--editor-font-size': `${fontSize}px`, '--page-bg': backgroundUrl ? `url("${backgroundUrl}")` : 'none', '--page-bg-alpha': backgroundAlpha } as React.CSSProperties}><EditorContent editor={editor} /></div></section>
      </div>
    </main>
  )
}
