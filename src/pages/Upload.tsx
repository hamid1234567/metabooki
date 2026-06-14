import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronLeft, CircleGauge, FileSearch, ListTree, MonitorSmartphone, RefreshCcw, ShieldCheck, UploadCloud, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/lib/auth-context'
import { confirmAndUploadImport, type UploadProgress } from '@/lib/import-upload'
import { clearExpiredLocalImports, deleteLocalImport, saveLocalImport, updateLocalAnalysis } from '@/lib/local-import-store'
import { pageText } from '@/lib/import-document'
import type { LocalImportProject, WordImportAnalysis, ImportWorkerMessage } from '@/lib/word-import-types'

type Stage = 'choose' | 'analyzing' | 'review' | 'uploading' | 'complete'

function bytes(value: number) {
  return new Intl.NumberFormat('fa-IR', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(value / 1024 / 1024)
}

export default function Upload() {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const workerRef = useRef<Worker | null>(null)
  const [stage, setStage] = useState<Stage>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<WordImportAnalysis | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<'print' | 'fluid'>('print')
  const [activePage, setActivePage] = useState(1)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('ادبیات')
  const [description, setDescription] = useState('')

  useEffect(() => {
    clearExpiredLocalImports()
    return () => workerRef.current?.terminate()
  }, [])

  const imageUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    analysis?.images.forEach(image => { urls[image.id] = URL.createObjectURL(new Blob([image.data], { type: image.mimeType })) })
    return urls
  }, [analysis])

  useEffect(() => () => Object.values(imageUrls).forEach(URL.revokeObjectURL), [imageUrls])

  const currentPage = analysis?.previewPages.find(page => page.number === activePage) || analysis?.previewPages[0]

  const analyze = (selected: File) => {
    workerRef.current?.terminate()
    setFile(selected)
    setAnalysis(null)
    setError('')
    setProgress(0)
    setStage('analyzing')
    const worker = new Worker(new URL('../workers/docx-import.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = async (event: MessageEvent<ImportWorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        setProgress(message.progress)
        setProgressLabel(message.label)
      } else if (message.type === 'error') {
        setError(message.message)
        setStage('choose')
      } else {
        const result = message.analysis
        setAnalysis(result)
        setTitle(current => current || selected.name.replace(/\.docx$/i, ''))
        setActivePage(1)
        setStage('review')
        const project: LocalImportProject = {
          id: result.id, sourceFile: selected, analysis: result,
          title: title || selected.name.replace(/\.docx$/i, ''), author, category, description,
          updatedAt: new Date().toISOString(),
        }
        await saveLocalImport(project)
        worker.terminate()
      }
    }
    worker.onerror = () => {
      setError('پردازشگر محلی فایل متوقف شد. فایل را دوباره انتخاب کنید.')
      setStage('choose')
    }
    worker.postMessage({ file: selected })
  }

  const toggleToc = async (id: string) => {
    if (!analysis) return
    const updated = { ...analysis, toc: analysis.toc.map(item => item.id === id ? { ...item, included: !item.included } : item) }
    setAnalysis(updated)
    await updateLocalAnalysis(updated.id, updated)
  }

  const confirmUpload = async () => {
    if (!analysis || !file || !user) return
    setError('')
    setStage('uploading')
    const project: LocalImportProject = {
      id: analysis.id, sourceFile: file, analysis, title: title || file.name.replace(/\.docx$/i, ''),
      author, category, description, updatedAt: new Date().toISOString(),
    }
    await saveLocalImport(project)
    try {
      const book = await confirmAndUploadImport(project, user.id, setUploadProgress)
      setStage('complete')
      await deleteLocalImport(project.id)
      setTimeout(() => navigate(`/edit/${book.id}`), 900)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'آپلود بسته ناموفق بود. با تلاش مجدد از ادامه مسیر ارسال می‌شود.')
      setStage('review')
    }
  }

  return (
    <main className="word-import-shell" dir="rtl">
      <header className="word-import-header menu-glass-70">
        <div>
          <p className="word-import-kicker">کارگاه خصوصی تبدیل کتاب</p>
          <h1>تبدیل Word، پیش از هر آپلود</h1>
          <p>فایل ابتدا فقط روی دستگاه شما تحلیل می‌شود. پس از بررسی فهرست و ۵۰ صفحه نخست، خودتان ارسال آن را تأیید می‌کنید.</p>
        </div>
        <div className="word-local-trust"><ShieldCheck /><span><b>پردازش محلی</b>تا قبل از تأیید، چیزی ارسال نمی‌شود</span></div>
      </header>

      <nav className="word-import-steps" aria-label="مراحل تبدیل">
        {[
          ['choose', 'انتخاب فایل'], ['analyzing', 'تحلیل محلی'], ['review', 'بازبینی و پیش‌نمایش'], ['uploading', 'تأیید و ارسال'],
        ].map(([key, label], index) => {
          const stages: Stage[] = ['choose', 'analyzing', 'review', 'uploading', 'complete']
          const active = stages.indexOf(stage) >= stages.indexOf(key as Stage)
          return <div key={key} className={active ? 'is-active' : ''}><span>{active ? <Check /> : index + 1}</span>{label}</div>
        })}
      </nav>

      {error && <div className="word-import-error"><AlertTriangle />{error}</div>}

      {stage === 'choose' && (
        <section className="word-drop-stage menu-glass-70">
          <label className="word-drop-zone">
            <UploadCloud />
            <h2>فایل DOCX را انتخاب یا اینجا رها کنید</h2>
            <p>حداکثر ۲۰۰ مگابایت و ۲۰۰۰ صفحه. فایل در این مرحله از دستگاه شما خارج نمی‌شود.</p>
            <span>انتخاب فایل Word</span>
            <input type="file" accept=".docx" onChange={event => event.target.files?.[0] && analyze(event.target.files[0])} />
          </label>
          <div className="word-local-benefits">
            <div><FileSearch /><b>تحلیل واقعی ساختار</b><span>تیتر، پاراگراف، جدول، تصویر و فرمول</span></div>
            <div><MonitorSmartphone /><b>دو پیش‌نمایش</b><span>نمای چاپی و خوانش روان موبایل</span></div>
            <div><RefreshCcw /><b>اصلاح بدون آپلود</b><span>فایل Word را اصلاح و دوباره بررسی کنید</span></div>
          </div>
        </section>
      )}

      {stage === 'analyzing' && (
        <section className="word-analysis-stage menu-glass-70">
          <div className="word-analysis-orbit"><WandSparkles /><i style={{ '--analysis-progress': `${progress * 3.6}deg` } as React.CSSProperties} /></div>
          <h2>{progressLabel}</h2>
          <p>{file?.name} · {file ? bytes(file.size) : ''}</p>
          <div className="word-progress"><span style={{ width: `${progress}%` }} /></div>
          <strong>{progress.toLocaleString('fa-IR')}٪</strong>
        </section>
      )}

      {(stage === 'review' || stage === 'uploading' || stage === 'complete') && analysis && (
        <>
          <section className="word-report-grid">
            <div className="word-report-main menu-glass-70">
              <div className="word-report-title">
                <div><p>گزارش تحلیل محلی</p><h2>{analysis.fileName}</h2><span>Checksum: {analysis.checksum.slice(0, 16)}…</span></div>
                <div className={`complexity-grade grade-${analysis.complexity.grade.replace(' ', '-')}`}><CircleGauge /><span>درجه سختی</span><b>{analysis.complexity.grade}</b><small>{analysis.complexity.estimatedCredits.toLocaleString('fa-IR')} کردیت تخمینی</small></div>
              </div>
              <div className="word-stat-grid">
                {[['صفحه', analysis.totalPages], ['پاراگراف', analysis.stats.paragraphs], ['تیتر', analysis.stats.headings], ['تصویر', analysis.stats.images], ['جدول', analysis.stats.tables], ['فرمول', analysis.stats.formulas]].map(([label, value]) => <div key={label}><b>{Number(value).toLocaleString('fa-IR')}</b><span>{label}</span></div>)}
              </div>
              <div className="word-issues">
                <h3>موارد نیازمند توجه</h3>
                {analysis.issues.length ? analysis.issues.map(issue => <button key={issue.id} onClick={() => setActivePage(issue.page)}><AlertTriangle /><span>{issue.message}</span><ChevronLeft /></button>) : <p className="word-ok"><Check />مشکل مهمی در پیش‌نمایش پیدا نشد.</p>}
              </div>
            </div>
            <div className="word-book-meta menu-glass-70">
              <h3>اطلاعات پیش‌نویس</h3>
              <label>عنوان کتاب<input value={title} onChange={event => setTitle(event.target.value)} /></label>
              <label>نویسنده<input value={author} onChange={event => setAuthor(event.target.value)} /></label>
              <label>دسته‌بندی<select value={category} onChange={event => setCategory(event.target.value)}>{['ادبیات', 'علمی', 'برنامه‌نویسی', 'تاریخ', 'هنر', 'مدیریت'].map(item => <option key={item}>{item}</option>)}</select></label>
              <label>توضیح کوتاه<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
            </div>
          </section>

          <section className="word-preview-workspace">
            <aside className="word-toc menu-glass-70">
              <div><h3><ListTree />فهرست پیشنهادی</h3><span>{analysis.toc.length.toLocaleString('fa-IR')} عنوان</span></div>
              {analysis.toc.length ? analysis.toc.map(item => <label key={item.id} style={{ paddingInlineStart: `${Math.min(4, item.level - 1) * 12 + 8}px` }}><input type="checkbox" checked={item.included} onChange={() => toggleToc(item.id)} /><button onClick={() => setActivePage(item.page)}>{item.title}</button><small>{item.page.toLocaleString('fa-IR')}</small></label>) : <p>برای ساخت فهرست بهتر، در Word از Heading استفاده کنید.</p>}
            </aside>

            <section className="word-preview-panel menu-glass-70">
              <header>
                <div><h3>پیش‌نمایش محلی</h3><span>تا ۵۰ صفحه نخست · بدون آپلود</span></div>
                <div className="word-view-toggle"><button className={view === 'print' ? 'active' : ''} onClick={() => setView('print')}>چاپی</button><button className={view === 'fluid' ? 'active' : ''} onClick={() => setView('fluid')}>خوانش روان</button></div>
              </header>
              <article className={`word-page-preview ${view}`}>
                <span className="word-page-number">{currentPage?.number.toLocaleString('fa-IR')}</span>
                {currentPage?.blocks.map(block => {
                  if (block.type === 'heading') {
                    const Tag = `h${Math.min(6, block.level || 2)}` as keyof React.JSX.IntrinsicElements
                    return <Tag key={block.id} id={block.id}>{block.text}</Tag>
                  }
                  if (block.type === 'image') return imageUrls[block.imageId || ''] ? <img key={block.id} src={imageUrls[block.imageId || '']} alt="تصویر استخراج‌شده از کتاب" /> : null
                  if (block.type === 'table') return <div className="word-table-wrap" key={block.id}><table><tbody>{block.rows?.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
                  return <p key={block.id} className={block.type === 'math' ? 'word-math' : ''}>{block.text}</p>
                })}
                {!currentPage?.blocks.length && <p>{pageText(currentPage!) || 'این صفحه محتوای قابل نمایش ندارد.'}</p>}
              </article>
              <footer>
                <Button variant="outline" disabled={activePage <= 1} onClick={() => setActivePage(value => value - 1)}>صفحه قبل</Button>
                <select value={activePage} onChange={event => setActivePage(Number(event.target.value))}>{analysis.previewPages.map(page => <option key={page.number} value={page.number}>صفحه {page.number.toLocaleString('fa-IR')}</option>)}</select>
                <Button variant="outline" disabled={activePage >= analysis.previewPages.length} onClick={() => setActivePage(value => value + 1)}>صفحه بعد</Button>
              </footer>
            </section>
          </section>

          <section className="word-confirm-bar menu-glass-70">
            <div><ShieldCheck /><span><b>{stage === 'uploading' ? uploadProgress?.label : stage === 'complete' ? 'پیش‌نویس آماده شد' : 'آماده تأیید شما'}</b><small>{stage === 'review' ? 'با تأیید، فایل و بسته تبدیل فقط یک‌بار و به‌صورت ادامه‌پذیر ارسال می‌شوند.' : `${uploadProgress?.percent || 100}٪`}</small></span></div>
            {stage === 'review' && <div className="word-confirm-actions"><label className="replace-word"><RefreshCcw />اصلاح کردم؛ فایل جدید را بررسی کن<input type="file" accept=".docx" onChange={event => event.target.files?.[0] && analyze(event.target.files[0])} /></label><Button onClick={confirmUpload} className="gap-2"><UploadCloud />تأیید و ارسال یک‌مرحله‌ای</Button></div>}
            {stage === 'uploading' && <div className="word-upload-progress"><span style={{ width: `${uploadProgress?.percent || 0}%` }} /></div>}
            {stage === 'complete' && <Check className="word-complete-check" />}
          </section>
        </>
      )}
    </main>
  )
}
