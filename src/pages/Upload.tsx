import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle, FileText, Image, ListTree, Upload as UploadIcon, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPublisherBook } from '@/lib/publisher-books'

export default function Upload() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('ادبیات')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'idle' | 'validating' | 'extracting' | 'mapping' | 'done'>('idle')

  const simulateImport = async () => {
    setStep('validating'); await new Promise(r => setTimeout(r, 350))
    setStep('extracting'); await new Promise(r => setTimeout(r, 450))
    setStep('mapping'); await new Promise(r => setTimeout(r, 450))
    const book = createPublisherBook({ title, author, category, description, fileName: file?.name })
    setStep('done')
    setTimeout(() => navigate(`/edit/${book.id}`), 450)
  }

  const createManual = () => {
    const book = createPublisherBook({ title: title || 'کتاب جدید', author, category, description })
    navigate(`/edit/${book.id}`)
  }

  const progress = ['validating', 'extracting', 'mapping', 'done'].indexOf(step)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="menu-glass-70 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-6"><div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center"><UploadIcon className="w-7 h-7 text-primary" /></div><div><p className="text-sm text-muted-foreground">کارگاه تولید کتاب</p><h1 className="text-3xl font-black font-display">کتاب جدید بسازید</h1></div></div>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">فایل Word را وارد کنید تا ساختار فصل‌ها، تصاویر، جدول‌ها و فهرست اولیه شبیه‌سازی شود؛ سپس وارد ویرایشگر شوید و محتوای تعاملی، جلد، قیمت و انتشار را تکمیل کنید.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <section className="space-y-6">
          <div className="menu-glass-70 rounded-3xl p-6">
            <h2 className="font-bold text-xl mb-5 flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />اطلاعات پایه</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان کتاب" className="rounded-xl border bg-background/70 p-3" />
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="نام نویسنده" className="rounded-xl border bg-background/70 p-3" />
              <select title="دسته‌بندی" value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border bg-background/70 p-3">
                {['ادبیات','علمی','برنامه‌نویسی','تاریخ','آشپزی','سبک زندگی','هنر'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه" className="rounded-xl border bg-background/70 p-3" />
            </div>
          </div>

          <div className="menu-glass-70 rounded-3xl p-6">
            <h2 className="font-bold text-xl mb-5 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />ورود فایل Word / DOCX</h2>
            <label className="block rounded-3xl border-2 border-dashed border-primary/30 bg-background/40 p-10 text-center cursor-pointer hover:border-primary transition-colors">
              <UploadIcon className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="font-bold">فایل DOCX را اینجا رها کنید یا انتخاب کنید</p>
              <p className="text-sm text-muted-foreground mt-1">اعتبارسنجی، استخراج تصویر، تشخیص فهرست و تبدیل به صفحات کتاب</p>
              <input type="file" accept=".doc,.docx" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              {file && <p className="mt-4 text-sm text-primary font-bold">{file.name}</p>}
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={simulateImport} disabled={!file || step !== 'idle'} className="gap-2"><WandSparkles className="w-4 h-4" />شروع تبدیل Word</Button>
              <Button onClick={createManual} variant="outline" className="gap-2"><BookOpen className="w-4 h-4" />ساخت دستی بدون فایل</Button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="menu-glass-70 rounded-3xl p-6">
            <h3 className="font-bold mb-4">مراحل تبدیل</h3>
            {[
              { key:'validating', icon: CheckCircle, title:'اعتبارسنجی فایل' },
              { key:'extracting', icon: Image, title:'استخراج تصویر و جدول' },
              { key:'mapping', icon: ListTree, title:'تشخیص فصل و فهرست' },
              { key:'done', icon: WandSparkles, title:'ساخت کتاب پیش‌نویس' },
            ].map((s, i) => <div key={s.key} className={`flex items-center gap-3 p-3 rounded-xl ${progress >= i ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}><s.icon className="w-5 h-5" /><span className="text-sm font-medium">{s.title}</span></div>)}
          </div>
          <div className="menu-glass-70 rounded-3xl p-6">
            <h3 className="font-bold mb-3">قابلیت‌های بعد از ساخت</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• ویرایش زنده متن و فصل‌ها</li>
              <li>• افزودن آزمون، تایم‌لاین، هات‌اسپات و استوری</li>
              <li>• طراحی جلد و تصویرسازی AI</li>
              <li>• قیمت‌گذاری، سهم‌بندی و انتشار</li>
              <li>• نسخه صوتی و پیش‌نمایش فروشگاه</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
