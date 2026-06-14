/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eye, Heading1, Heading2, Italic, List, ListOrdered, Minus, Plus, Redo2, Save, Sparkles, Strikethrough, Subscript as SubIcon, Superscript as SuperIcon, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findPublisherBook, updatePublisherBook } from '@/lib/publisher-books'
import { findBookById } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'

function pagesToHtml(pages: any[] = []) {
  const escape = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return pages.map((page, pageIndex) => `${pageIndex ? '<hr data-page-break="true">' : ''}${(page.blocks || []).map((block: any) => {
    if (block.type === 'heading') return `<h${Math.min(6, block.level || 2)}>${escape(block.content)}</h${Math.min(6, block.level || 2)}>`
    if (block.type === 'table') return `<table><tbody>${[block.headers || [], ...(block.rows || [])].map((row: string[]) => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    if (block.type === 'image' && block.url) return `<img src="${block.url}" alt="${escape(block.caption || '')}">`
    return `<p>${escape(block.content || block.expression || '')}</p>`
  }).join('')}`).join('')
}

function editorJsonToPages(json: any) {
  const pages: any[] = [{ title: 'صفحه ۱', blocks: [] }]
  for (const node of json?.content || []) {
    if (node.type === 'horizontalRule') {
      pages.push({ title: `صفحه ${pages.length + 1}`, blocks: [] })
      continue
    }
    const text = (node.content || []).map((part: any) => part.text || '').join('')
    if (node.type === 'heading') {
      pages[pages.length - 1].blocks.push({ type: 'heading', level: node.attrs?.level || 2, content: text })
      if (!pages[pages.length - 1].blocks.slice(0, -1).length) pages[pages.length - 1].title = text || pages[pages.length - 1].title
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content || []).map((item: any) => (item.content || []).flatMap((part: any) => part.content || []).map((part: any) => part.text || '').join(''))
      pages[pages.length - 1].blocks.push({ type: 'paragraph', content: items.map((item: string, index: number) => `${node.type === 'orderedList' ? `${index + 1}.` : '•'} ${item}`).join('\n') })
    } else if (node.type === 'paragraph' && text) {
      pages[pages.length - 1].blocks.push({ type: 'paragraph', content: text })
    }
  }
  return pages.filter(page => page.blocks.length)
}

export default function Edit() {
  const { id = '' } = useParams<{ id: string }>()
  const localInitial = useMemo(() => findPublisherBook(id) || findBookById(id), [id])
  const [book, setBook] = useState<any>(localInitial)
  const [title, setTitle] = useState(localInitial?.title || '')
  const [description, setDescription] = useState(localInitial?.description || '')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const loadedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: pagesToHtml(localInitial?.pages || []),
    editorProps: { attributes: { class: 'book-document-prose', dir: 'rtl', spellcheck: 'true' } },
  })

  useEffect(() => {
    if (localInitial || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) return
    ;(supabase as any).from('books').select('*').eq('id', id).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return
      setBook(data)
      setTitle(data.title)
      setDescription(data.description || '')
      editor?.commands.setContent(pagesToHtml(data.pages || []))
      loadedRef.current = true
    })
  }, [editor, id, localInitial])

  const save = async (quiet = false) => {
    if (!editor || !id) return
    setSaving(true)
    const pages = editorJsonToPages(editor.getJSON())
    const patch = { title, description, pages, page_count: pages.length, content_updated_at: new Date().toISOString() }
    updatePublisherBook(id, patch as any)
    if (import.meta.env.VITE_SUPABASE_URL?.startsWith('http') && /^[0-9a-f-]{36}$/i.test(id)) {
      await (supabase as any).from('books').update({ title, description, pages, content_updated_at: patch.content_updated_at }).eq('id', id)
    }
    setBook((current: any) => ({ ...current, ...patch }))
    setSavedAt(new Date())
    setSaving(false)
    if (!quiet) editor.commands.focus()
  }

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      window.clearTimeout((onUpdate as any).timer)
      ;(onUpdate as any).timer = window.setTimeout(() => save(true), 1400)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      window.clearTimeout((onUpdate as any).timer)
    }
  })

  if (!book && !localInitial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">در حال دریافت پیش‌نویس کتاب…</h1></div>

  const command = (action: () => void) => { action(); editor?.commands.focus() }

  return (
    <main className="book-editor-shell" dir="rtl">
      <header className="book-editor-head menu-glass-70">
        <div><p>ادیتور کتاب</p><input value={title} onChange={event => setTitle(event.target.value)} aria-label="عنوان کتاب" /></div>
        <div className="book-save-state"><Save />{saving ? 'در حال ذخیره…' : savedAt ? `ذخیره شد ${savedAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'ذخیره خودکار فعال است'}</div>
        <div><Button variant="outline" onClick={() => save()}><Save />ذخیره</Button><Link to={`/read/${id}`}><Button variant="outline"><Eye />پیش‌نمایش</Button></Link><Link to={`/publish/${id}`}><Button><Sparkles />انتشار</Button></Link></div>
      </header>

      <div className="book-editor-toolbar menu-glass-70">
        <button title="بازگشت" onClick={() => command(() => editor?.chain().focus().undo().run())}><Undo2 /></button>
        <button title="انجام دوباره" onClick={() => command(() => editor?.chain().focus().redo().run())}><Redo2 /></button>
        <i />
        <button title="تیتر اصلی" className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''} onClick={() => command(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 /></button>
        <button title="تیتر فرعی" className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} onClick={() => command(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 /></button>
        <button title="پررنگ" className={editor?.isActive('bold') ? 'active' : ''} onClick={() => command(() => editor?.chain().focus().toggleBold().run())}><Bold /></button>
        <button title="مورب" className={editor?.isActive('italic') ? 'active' : ''} onClick={() => command(() => editor?.chain().focus().toggleItalic().run())}><Italic /></button>
        <button title="زیرخط" className={editor?.isActive('underline') ? 'active' : ''} onClick={() => command(() => editor?.chain().focus().toggleUnderline().run())}><UnderlineIcon /></button>
        <button title="خط‌خورده" onClick={() => command(() => editor?.chain().focus().toggleStrike().run())}><Strikethrough /></button>
        <button title="بالانویس" onClick={() => command(() => editor?.chain().focus().toggleSuperscript().run())}><SuperIcon /></button>
        <button title="زیرنویس" onClick={() => command(() => editor?.chain().focus().toggleSubscript().run())}><SubIcon /></button>
        <i />
        <button title="راست‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('right').run())}><AlignRight /></button>
        <button title="وسط‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('center').run())}><AlignCenter /></button>
        <button title="چپ‌چین" onClick={() => command(() => editor?.chain().focus().setTextAlign('left').run())}><AlignLeft /></button>
        <button title="تراز کامل" onClick={() => command(() => editor?.chain().focus().setTextAlign('justify').run())}><AlignJustify /></button>
        <button title="فهرست نقطه‌ای" onClick={() => command(() => editor?.chain().focus().toggleBulletList().run())}><List /></button>
        <button title="فهرست شماره‌ای" onClick={() => command(() => editor?.chain().focus().toggleOrderedList().run())}><ListOrdered /></button>
        <i />
        <button title="کوچک کردن متن" onClick={() => setFontSize(value => Math.max(14, value - 1))}><Minus /></button>
        <span>{fontSize.toLocaleString('fa-IR')}</span>
        <button title="بزرگ کردن متن" onClick={() => setFontSize(value => Math.min(28, value + 1))}><Plus /></button>
      </div>

      <div className="book-editor-layout">
        <aside className="book-editor-side menu-glass-70">
          <h3>مشخصات کتاب</h3>
          <label>توضیح کوتاه<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
          <div><b>{book?.page_count || book?.pages?.length || 1}</b><span>صفحه در پیش‌نویس</span></div>
          <p>متن مانند Word به‌صورت پیوسته و پاراگراف‌بندی‌شده ویرایش می‌شود. ذخیره خودکار پس از توقف کوتاه در تایپ انجام می‌شود.</p>
        </aside>
        <section className="book-document-stage">
          <div className="book-document-paper" style={{ '--editor-font-size': `${fontSize}px` } as React.CSSProperties}>
            <EditorContent editor={editor} />
          </div>
        </section>
      </div>
    </main>
  )
}
