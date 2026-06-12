import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Bot, Eye, FileText, Highlighter, Image, Layers, ListTree, MessageSquare, Plus, Save, Sparkles, Table, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findPublisherBook, updatePublisherBook } from '@/lib/publisher-books'
import { findBookById } from '@/lib/mock-data'

const blockTools = [
  { type: 'paragraph', label: 'پاراگراف', icon: FileText },
  { type: 'image', label: 'تصویر', icon: Image },
  { type: 'table', label: 'جدول', icon: Table },
  { type: 'quiz', label: 'آزمون', icon: Highlighter },
  { type: 'timeline', label: 'تایم‌لاین', icon: ListTree },
  { type: 'hotspot', label: 'هات‌اسپات', icon: Layers },
]

export default function Edit() {
  const { id } = useParams<{ id: string }>()
  const initial = useMemo(() => findPublisherBook(id || '') || findBookById(id || ''), [id])
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [chapterTitle, setChapterTitle] = useState(initial?.pages?.[0]?.title || 'فصل ۱')
  const [body, setBody] = useState(initial?.pages?.[0]?.blocks?.find((b:any)=>b.type==='paragraph')?.content || '')
  const [saved, setSaved] = useState(false)

  if (!initial) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">کتاب یافت نشد</h1></div>

  const save = () => {
    if (id) updatePublisherBook(id, {
      title,
      description,
      pages: [{ title: chapterTitle, blocks: [
        { type: 'heading', level: 2, content: chapterTitle },
        { type: 'paragraph', content: body },
        { type: 'timeline', events: [{ year: '۱', title: 'شروع', description: 'مرحله اول کتاب' }, { year: '۲', title: 'تکمیل', description: 'مرحله دوم کتاب' }] },
        { type: 'hotspot', image: `https://picsum.photos/seed/${id}-edit-hotspot/900/520`, caption: 'نمونه هات‌اسپات', points: [{x:25,y:35,title:'نقطه ۱',text:'توضیح نقطه اول'}, {x:65,y:55,title:'نقطه ۲',text:'توضیح نقطه دوم'}] },
      ]}],
      page_count: 1,
    })
    setSaved(true); setTimeout(()=>setSaved(false), 1800)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="menu-glass-70 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Builder / Editor</p>
          <h1 className="text-3xl font-black font-display">ویرایش متن و محتوای کتاب</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} className="gap-2"><Save className="w-4 h-4" />ذخیره</Button>
          <Link to={`/read/${initial.id}`}><Button variant="outline" className="gap-2"><Eye className="w-4 h-4" />پیش‌نمایش</Button></Link>
          <Link to={`/publish/${initial.id}`}><Button variant="outline" className="gap-2"><Sparkles className="w-4 h-4" />قیمت و انتشار</Button></Link>
        </div>
      </div>

      {saved && <div className="rounded-xl bg-success/15 text-success p-3 text-sm">✅ تغییرات ذخیره شد</div>}

      <div className="grid lg:grid-cols-[280px_1fr_340px] gap-6">
        <aside className="space-y-4">
          <div className="menu-glass-70 rounded-2xl p-4">
            <h2 className="font-bold mb-3">ابزارهای محتوا</h2>
            <div className="grid grid-cols-2 gap-2">
              {blockTools.map(tool => <button key={tool.type} className="rounded-xl bg-background/55 p-3 text-xs hover:bg-primary/10 transition-colors"><tool.icon className="w-5 h-5 mx-auto mb-1 text-primary" />{tool.label}</button>)}
            </div>
          </div>
          <div className="menu-glass-70 rounded-2xl p-4 space-y-2 text-sm">
            <h2 className="font-bold mb-2">AI و اتوماسیون</h2>
            <Button variant="outline" className="w-full gap-2"><Bot className="w-4 h-4" />پیشنهاد متن</Button>
            <Button variant="outline" className="w-full gap-2"><WandSparkles className="w-4 h-4" />تشخیص فهرست</Button>
            <Button variant="outline" className="w-full gap-2"><Image className="w-4 h-4" />جایگذاری تصویر</Button>
          </div>
        </aside>

        <section className="menu-glass-70 rounded-3xl p-6 space-y-4">
          <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border bg-background/70 p-3 text-2xl font-black" placeholder="عنوان کتاب" />
          <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full rounded-xl border bg-background/70 p-3" placeholder="توضیح کتاب" />
          <input value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} className="w-full rounded-xl border bg-background/70 p-3 font-bold" placeholder="عنوان فصل" />
          <textarea value={body} onChange={e=>setBody(e.target.value)} className="w-full min-h-[420px] rounded-2xl border bg-background/80 p-5 leading-loose text-lg" placeholder="متن فصل را اینجا ویرایش کنید..." />
        </section>

        <aside className="space-y-4">
          <div className="menu-glass-70 rounded-2xl p-4">
            <h2 className="font-bold mb-3">پیش‌نمایش فصل</h2>
            <div className="rounded-2xl bg-background/70 p-4 max-h-[520px] overflow-y-auto">
              <h3 className="font-black text-xl mb-4">{chapterTitle}</h3>
              <p className="text-sm leading-loose text-muted-foreground whitespace-pre-wrap">{body}</p>
            </div>
          </div>
          <div className="menu-glass-70 rounded-2xl p-4">
            <h2 className="font-bold mb-3">چک‌لیست انتشار</h2>
            {['متن اصلی', 'فهرست فصل‌ها', 'جلد', 'قیمت', 'پیش‌نمایش', 'کامنت و نقد'].map((x,i)=><div key={x} className="flex items-center gap-2 text-sm py-1"><span className={`w-2.5 h-2.5 rounded-full ${i<2?'bg-success':'bg-muted-foreground/30'}`} />{x}</div>)}
          </div>
          <Button variant="outline" className="w-full gap-2"><MessageSquare className="w-4 h-4" />یادداشت ویراستار</Button>
        </aside>
      </div>
    </div>
  )
}
