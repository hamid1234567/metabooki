import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronLeft, CircleGauge, FileSearch, ListTree, MonitorSmartphone, RefreshCcw, ShieldCheck, UploadCloud, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/lib/auth-context'
import { confirmAndUploadImport, uploadErrorMessage, type UploadProgress } from '@/lib/import-upload'
import { clearExpiredLocalImports, deleteLocalImport, saveLocalImport, updateLocalAnalysis } from '@/lib/local-import-store'
import { applyWordStyleMapping } from '@/lib/word-style-mapping'
import { bookTextDirection, normalizeBookText, pageDividerHtml, printPageLabel } from '@/lib/book-content'
import type { ImportBookMetadata, LocalImportProject, WordImportAnalysis, ImportWorkerMessage } from '@/lib/word-import-types'

type Stage = 'choose' | 'analyzing' | 'review' | 'uploading' | 'complete'
type BookType = ImportBookMetadata['bookTypes'][number]
const BOOK_TYPES: BookType[] = ['تألیف', 'ترجمه', 'گردآوری', 'ویرایش']

function bytes(value: number) {
  return new Intl.NumberFormat('fa-IR', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(value / 1024 / 1024)
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

function parseKeywords(value: string) {
  return value.split(/[،,\n]/).map(item => item.trim()).filter(Boolean)
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [authorsText, setAuthorsText] = useState('')
  const [translatorsText, setTranslatorsText] = useState('')
  const [category, setCategory] = useState('ادبیات')
  const [description, setDescription] = useState('')
  const [bookTypes, setBookTypes] = useState<BookType[]>(['تألیف'])
  const [publisherName, setPublisherName] = useState('')
  const [isbn, setIsbn] = useState('')
  const [publicationYear, setPublicationYear] = useState('')
  const [edition, setEdition] = useState('')
  const [language, setLanguage] = useState('fa')
  const [keywordsText, setKeywordsText] = useState('')
  const metadataRef = useRef<ImportBookMetadata | null>(null)

  const currentMetadata = (): ImportBookMetadata => {
    const authors = parseLines(authorsText)
    return {
      title,
      subtitle,
      author: authors.join('، '),
      authors,
      translators: parseLines(translatorsText),
      category,
      description,
      bookTypes,
      publisherName,
      isbn,
      publicationYear,
      edition,
      language,
      keywords: parseKeywords(keywordsText),
    }
  }
  useEffect(() => {
    clearExpiredLocalImports()
    return () => workerRef.current?.terminate()
  }, [])

  useEffect(() => {
    metadataRef.current = {
      title,
      subtitle,
      author: parseLines(authorsText).join('، '),
      authors: parseLines(authorsText),
      translators: parseLines(translatorsText),
      category,
      description,
      bookTypes,
      publisherName,
      isbn,
      publicationYear,
      edition,
      language,
      keywords: parseKeywords(keywordsText),
    }
  }, [title, subtitle, authorsText, translatorsText, category, description, bookTypes, publisherName, isbn, publicationYear, edition, language, keywordsText])

  const imageUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    analysis?.images.forEach(image => { urls[image.id] = URL.createObjectURL(new Blob([image.data], { type: image.mimeType })) })
    return urls
  }, [analysis])
  const confirmedToc = useMemo(() => (analysis?.toc || []).filter(item => item.included), [analysis])

  useEffect(() => () => Object.values(imageUrls).forEach(URL.revokeObjectURL), [imageUrls])

  const resetBookMetadata = () => {
    setTitle('')
    setSubtitle('')
    setAuthorsText('')
    setTranslatorsText('')
    setCategory('ادبیات')
    setDescription('')
    setBookTypes(['تألیف'])
    setPublisherName('')
    setIsbn('')
    setPublicationYear('')
    setEdition('')
    setLanguage('fa')
    setKeywordsText('')
  }

  const analyze = async (selected: File) => {
    workerRef.current?.terminate()
    if (analysis?.id) await deleteLocalImport(analysis.id)
    resetBookMetadata()
    setFile(selected)
    setAnalysis(null)
    setError('')
    setUploadProgress(null)
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
        const suggestedTitle = result.suggestedTitle || selected.name.replace(/\.docx$/i, '')
        setAnalysis(result)
        setTitle(suggestedTitle)
        setStage('review')
        const project: LocalImportProject = {
          id: result.id, sourceFile: selected, analysis: result,
          title: suggestedTitle, subtitle: '', author: '', authors: [], translators: [], category: 'ادبیات', description: '',
          bookTypes: ['تألیف'], publisherName: '', isbn: '', publicationYear: '', edition: '', language: 'fa', keywords: [],
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
    if (!analysis || stage !== 'review') return
    const updated = { ...analysis, toc: analysis.toc.map(item => item.id === id ? { ...item, included: !item.included } : item) }
    setAnalysis(updated)
    await updateLocalAnalysis(updated.id, updated)
  }

  const mapStyle = async (styleId: string, mapping: string) => {
    if (!analysis || stage !== 'review') return
    const updated = applyWordStyleMapping(analysis, styleId, mapping)
    setAnalysis(updated)
    await updateLocalAnalysis(updated.id, updated)
  }

  const scrollToPreviewBlock = (id: string) => {
    document.getElementById(`preview-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const blockStyle = (block: WordImportAnalysis['previewPages'][number]['blocks'][number]): React.CSSProperties => ({
    color: block.format?.color ? `#${block.format.color}` : undefined,
    fontSize: block.format?.fontSizePt ? `${Math.min(30, Math.max(11, block.format.fontSizePt))}pt` : undefined,
    fontWeight: block.format?.bold ? 800 : undefined,
    fontStyle: block.format?.italic ? 'italic' : undefined,
    textAlign: block.format?.alignment,
  })

  const renderInline = (block: WordImportAnalysis['previewPages'][number]['blocks'][number]) => {
    if (!block.inline?.length) return normalizeBookText(block.text || '')
    return block.inline.map((span, index) => {
      const footnoteText = span.footnoteText || (span.footnoteId ? analysis?.footnotes?.find(note => note.id === span.footnoteId)?.text : undefined)
      const spanText = normalizeBookText(span.text || '')
      const content = span.footnoteId ? <sup className="word-footnote-reference">{span.footnoteId}</sup> : span.superscript ? <sup>{spanText}</sup> : span.subscript ? <sub>{spanText}</sub> : spanText
      const formatted = <span key={index} style={{ fontWeight: span.bold ? 800 : undefined, fontStyle: span.italic ? 'italic' : undefined }}>{content}</span>
      if (span.footnoteId && footnoteText) return <span key={index} className="citation-reference footnote-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(footnoteText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(footnoteText)}>{normalizeBookText(footnoteText)}</span></span>
      if (span.referenceText) return <span key={index} className="citation-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(span.referenceText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(span.referenceText)}>{normalizeBookText(span.referenceText)}</span></span>
      return span.href ? <a key={index} href={span.href} target={span.href.startsWith('#') ? undefined : '_blank'} rel="noreferrer">{formatted}</a> : formatted
    })
  }

  const replaceFailedImage = async (imageId: string, replacement: File) => {
    if (!analysis || !replacement.type.startsWith('image/')) return
    const data = await replacement.arrayBuffer()
    const updated: WordImportAnalysis = {
      ...analysis,
      images: analysis.images.map(image => image.id === imageId ? {
        ...image,
        name: replacement.name,
        mimeType: replacement.type,
        data,
        conversionStatus: 'original-web',
        conversionError: undefined,
      } : image),
      issues: analysis.issues.filter(issue => issue.imageId !== imageId),
    }
    setAnalysis(updated)
    await updateLocalAnalysis(updated.id, updated)
  }

  const confirmUpload = async () => {
    if (!analysis || !file || !user) return
    if (analysis.images.some(image => image.isReferenced !== false && image.conversionStatus === 'conversion-failed')) {
      setError('پیش از تأیید و آپلود، تصاویر ناموفق را با فایل مناسب وب جایگزین کنید.')
      return
    }
    setError('')
    setStage('uploading')
    const metadata = currentMetadata()
    const project: LocalImportProject = {
      id: analysis.id, sourceFile: file, analysis,
      ...metadata,
      title: metadata.title || file.name.replace(/\.docx$/i, ''),
      updatedAt: new Date().toISOString(),
    }
    await saveLocalImport(project)
    try {
      const book = await confirmAndUploadImport(project, user.id, setUploadProgress, () => {
        const latest = metadataRef.current || metadata
        return { ...latest, title: latest.title || file.name.replace(/\.docx$/i, '') }
      })
      setStage('complete')
      await deleteLocalImport(project.id)
      navigate(`/edit/${book.id}`, { replace: true })
    } catch (uploadError) {
      setError(`آپلود متوقف شد: ${uploadErrorMessage(uploadError)}. با تلاش مجدد، ارسال از بخش‌های ثبت‌شده ادامه پیدا می‌کند.`)
      setStage('review')
    }
  }

  const toggleBookType = (value: BookType) => {
    setBookTypes(current => current.includes(value) ? (current.length === 1 ? current : current.filter(item => item !== value)) : [...current, value])
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
                {[['صفحه', analysis.totalPages], ['پاراگراف', analysis.stats.paragraphs], ['تیتر', analysis.stats.headings], ['تصویر', analysis.stats.images], ['جدول', analysis.stats.tables], ['پاورقی', analysis.stats.footnotes || 0]].map(([label, value]) => <div key={label}><b>{Number(value).toLocaleString('fa-IR')}</b><span>{label}</span></div>)}
              </div>
              <div className="word-image-conversion-summary">
                <span><Check />{analysis.images.filter(image => image.conversionStatus === 'converted-local').length.toLocaleString('fa-IR')} تصویر محلی تبدیل‌شده</span>
                <span>{analysis.images.filter(image => image.conversionStatus === 'original-web').length.toLocaleString('fa-IR')} تصویر مناسب وب</span>
                {analysis.images.some(image => image.isReferenced !== false && image.conversionStatus === 'conversion-failed') && <span className="has-error"><AlertTriangle />{analysis.images.filter(image => image.isReferenced !== false && image.conversionStatus === 'conversion-failed').length.toLocaleString('fa-IR')} تبدیل ناموفق</span>}
              </div>
              <div className="word-issues">
                <h3>موارد نیازمند توجه</h3>
                {analysis.issues.length ? analysis.issues.map(issue => <button key={issue.id} onClick={() => document.getElementById(`preview-page-${issue.page}`)?.scrollIntoView({ behavior: 'smooth' })}><AlertTriangle /><span>{issue.message}</span><ChevronLeft /></button>) : <p className="word-ok"><Check />مشکل مهمی در پیش‌نمایش پیدا نشد.</p>}
              </div>
              {analysis.images.some(image => image.isReferenced !== false && image.conversionStatus === 'conversion-failed') && <div className="word-failed-images">
                <h3>تصاویر نیازمند جایگزینی</h3>
                {analysis.images.filter(image => image.isReferenced !== false && image.conversionStatus === 'conversion-failed').map(image => <div key={image.id}>
                  <span>
                    <b>{image.caption || image.originalName || image.name}</b>
                    <small>صفحه چاپی Word: {image.wordPages?.map(page => printPageLabel(page, 'نامشخص')).join('، ') || 'نامشخص'} · {image.conversionError}</small>
                    {image.contextBefore && <small><strong>متن قبل:</strong> {image.contextBefore}</small>}
                    {image.contextAfter && <small><strong>متن بعد:</strong> {image.contextAfter}</small>}
                    {image.previewBlockId && <button type="button" className="word-image-locate" onClick={() => scrollToPreviewBlock(image.previewBlockId!)}>نمایش محل در پیش‌نمایش</button>}
                  </span>
                  <label>بارگذاری جایگزین<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={event => event.target.files?.[0] && replaceFailedImage(image.id, event.target.files[0])} /></label>
                </div>)}
              </div>}
            </div>
            <div className="word-book-meta menu-glass-70">
              <h3>مشخصات کتاب‌شناسی</h3>
              {stage === 'uploading' && <p className="word-meta-upload-note"><UploadCloud />ارسال فایل در حال انجام است؛ می‌توانید هم‌زمان این اطلاعات را تکمیل کنید.</p>}
              <label>عنوان کتاب<input value={title} onChange={event => setTitle(event.target.value)} /></label>
              <label>زیرعنوان<input value={subtitle} onChange={event => setSubtitle(event.target.value)} /></label>
              <label>نویسندگان؛ نام هر نویسنده در یک خط<textarea value={authorsText} onChange={event => setAuthorsText(event.target.value)} placeholder={'نام نویسنده اول\nنام نویسنده دوم'} /></label>
              {parseLines(authorsText).length > 0 && <div className="word-meta-chips">{parseLines(authorsText).map(authorName => <span key={authorName}>{authorName}</span>)}</div>}
              <label>مترجمان؛ نام هر مترجم در یک خط<textarea value={translatorsText} onChange={event => setTranslatorsText(event.target.value)} placeholder="برای کتاب ترجمه‌شده" /></label>
              <fieldset className="word-book-types"><legend>نوع کتاب؛ امکان انتخاب چند مورد</legend>{BOOK_TYPES.map(item => <label key={item}><input type="checkbox" checked={bookTypes.includes(item)} onChange={() => toggleBookType(item)} /><span>{item}</span></label>)}</fieldset>
              <label>انتشارات<input value={publisherName} onChange={event => setPublisherName(event.target.value)} /></label>
              <label>زبان<select value={language} onChange={event => setLanguage(event.target.value)}><option value="fa">فارسی</option><option value="en">انگلیسی</option><option value="ar">عربی</option></select></label>
              <label>شابک (ISBN)<input value={isbn} onChange={event => setIsbn(event.target.value)} inputMode="numeric" /></label>
              <div className="word-meta-pair">
                <label>سال انتشار<input value={publicationYear} onChange={event => setPublicationYear(event.target.value)} inputMode="numeric" /></label>
                <label>نوبت ویرایش / چاپ<input value={edition} onChange={event => setEdition(event.target.value)} /></label>
              </div>
              <label>دسته‌بندی<select value={category} onChange={event => setCategory(event.target.value)}>{['ادبیات', 'علمی', 'برنامه‌نویسی', 'تاریخ', 'هنر', 'مدیریت'].map(item => <option key={item}>{item}</option>)}</select></label>
              <label>کلیدواژه‌ها؛ با ویرگول یا خط جدید جدا کنید<textarea value={keywordsText} onChange={event => setKeywordsText(event.target.value)} /></label>
              <label>توضیح کوتاه<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
            </div>
          </section>

          {stage === 'uploading' && <section className="word-upload-stage menu-glass-70" aria-live="polite">
            <div className="word-upload-stage-head"><div className="word-upload-pulse"><UploadCloud /></div><span><small>ارسال امن و ادامه‌پذیر</small><b>{uploadProgress?.label || 'آماده‌سازی بسته کتاب'}</b><em>{bytes(uploadProgress?.uploaded || 0)} از {bytes(uploadProgress?.total || file?.size || 0)}</em></span><strong>{(uploadProgress?.percent || 0).toLocaleString('fa-IR')}٪</strong></div>
            <div className="word-upload-stage-track"><span style={{ width: `${uploadProgress?.percent || 0}%` }} /></div>
            <p>در صورت قطع اینترنت، بخش‌های ارسال‌شده دوباره آپلود نمی‌شوند. می‌توانید هم‌زمان مشخصات کتاب‌شناسی را تکمیل کنید.</p>
          </section>}

          <section className="word-style-mapper menu-glass-70">
            <header><div><h3>نگاشت Styleهای Word به ساختار کتاب</h3><p>همه Styleهای استفاده‌شده در فایل را بررسی کنید. هر Style را می‌توانید به متن عادی یا یکی از سطوح H1 تا H6 تبدیل کنید؛ فهرست و پیش‌نمایش بلافاصله به‌روز می‌شوند.</p></div><span>{analysis.styles.filter(style => style.usedCount > 0).length.toLocaleString('fa-IR')} Style استفاده‌شده</span></header>
            <div className="word-style-list">
              {analysis.styles.map(style => (
                <div key={style.id} className={style.usedCount ? 'is-used' : 'is-available'}>
                  <span className="word-style-sample" style={{ fontSize: style.fontSizePt ? `${Math.min(22, style.fontSizePt)}px` : undefined, color: style.color ? `#${style.color}` : undefined, fontWeight: style.bold ? 800 : undefined }}>{style.name}</span>
                  <span className="word-style-id">{style.id}</span>
                  <span className="word-style-count">{style.usedCount ? `${style.usedCount.toLocaleString('fa-IR')} بار استفاده` : 'تعریف‌شده در Word'}</span>
                  <span className="word-style-example">{style.sampleText || 'نمونه‌ای در متن استفاده نشده است'}</span>
                  {style.titleCandidate && <span className="word-style-title-badge">پیشنهاد عنوان کتاب</span>}
                  <select value={style.selectedRole === 'heading' ? `h${style.selectedLevel}` : style.selectedRole} onChange={event => mapStyle(style.id, event.target.value)} disabled={stage !== 'review'} aria-label={`نگاشت ${style.name}`}>
                    <option value="ignore">عدم استفاده در فهرست</option>
                    <option value="body">متن عادی</option>
                    {[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={`h${level}`}>H{level}</option>)}
                    <option value="caption">کپشن تصویر</option>
                    <option value="table-title">عنوان جدول</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="word-preview-workspace">
            <aside className="word-toc menu-glass-70">
              <div><h3><ListTree />فهرست پیشنهادی</h3><span>{confirmedToc.length.toLocaleString('fa-IR')} عنوان تاییدشده</span></div>
              {analysis.toc.length ? analysis.toc.map(item => <label key={item.id} className={`${item.previewAvailable === false ? 'is-outside-preview' : ''} ${stage !== 'review' ? 'is-locked' : ''}`} style={{ paddingInlineStart: `${Math.min(4, item.level - 1) * 12 + 8}px` }}><input type="checkbox" checked={item.included} disabled={stage !== 'review'} onChange={() => toggleToc(item.id)} /><button disabled={item.previewAvailable === false} title={item.previewAvailable === false ? 'این عنوان بعد از محدوده ۵۰ صفحه‌ای پیش‌نمایش است و در کتاب نهایی حفظ می‌شود.' : undefined} onClick={() => scrollToPreviewBlock(item.id)}>{item.title}</button><span className={`word-toc-level level-${item.level}`}>H{item.level.toLocaleString('fa-IR')}</span><small>{item.page.toLocaleString('fa-IR')}{item.previewAvailable === false ? ' · خارج پیش‌نمایش' : ''}</small></label>) : <p>یکی از Styleهای فصل را در بخش بالا به H1 تا H6 متصل کنید.</p>}
            </aside>

            <section className="word-preview-panel menu-glass-70">
              <header>
                <div><h3>پیش‌نمایش وب کتاب</h3><span>تا ۵۰ صفحه نخست، پیوسته و اسکرولی · بدون آپلود</span></div>
              </header>
              <article className="word-web-preview">
                {analysis.previewPages.map((page, pageIndex) => {
                  return <section key={page.number} id={`preview-page-${page.number}`} className="word-preview-page-section">
                  {pageIndex > 0 && <div dangerouslySetInnerHTML={{ __html: pageDividerHtml(page) }} />}
                  {page.blocks.map(block => {
                    if (block.type === 'heading') {
                      const Tag = `h${Math.min(6, block.level || 2)}` as keyof React.JSX.IntrinsicElements
                      return <Tag key={block.id} id={`preview-${block.id}`} className={`web-heading web-heading-${block.level || 2}`} style={{ textAlign: block.format?.alignment }}>{block.anchors?.map(anchor => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}{renderInline(block)}</Tag>
                    }
                    if (block.type === 'image') {
                      const image = analysis.images.find(item => item.id === block.imageId)
                      return image?.conversionStatus === 'conversion-failed'
                        ? <figure key={block.id} id={`preview-${block.id}`} className="word-failed-image-placeholder"><AlertTriangle /><b>تصویر نیازمند جایگزینی است</b><span>{image.caption || image.originalName || image.name}</span></figure>
                        : imageUrls[block.imageId || ''] ? <figure key={block.id} id={`preview-${block.id}`} style={{ width: block.imageWidthPx ? `${block.imageWidthPx}px` : `${block.imageWidthPercent || 80}%`, maxWidth: '100%' }}><img src={imageUrls[block.imageId || '']} alt="تصویر استخراج‌شده از کتاب" /></figure> : null
                    }
                    if (block.type === 'table') return <div className="word-table-wrap final-table" key={block.id} id={`preview-${block.id}`}><table><tbody>{block.rows?.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
                    if (block.type === 'list') {
                      const Tag = block.ordered ? 'ol' : 'ul'
                      return <Tag key={block.id} id={`preview-${block.id}`} className="reader-list" style={blockStyle(block)}>{(block.items || []).map((item, itemIndex) => <li key={itemIndex}>{item.inline?.length ? item.inline.map((span, index) => {
                        const spanText = normalizeBookText(span.text || '')
                        const content = span.footnoteId ? <sup className="word-footnote-reference">{span.footnoteId}</sup> : span.superscript ? <sup>{spanText}</sup> : span.subscript ? <sub>{spanText}</sub> : spanText
                        return <span key={index} style={{ fontWeight: span.bold ? 800 : undefined, fontStyle: span.italic ? 'italic' : undefined }}>{content}</span>
                      }) : normalizeBookText(item.text)}</li>)}</Tag>
                    }
                    return <p key={block.id} id={`preview-${block.id}`} className={block.type === 'math' ? 'word-math' : block.type === 'caption' ? 'word-figure-caption' : block.type === 'table-title' ? 'word-table-title' : ''} style={blockStyle(block)}>{block.anchors?.map(anchor => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}{renderInline(block)}</p>
                  })}
                </section>})}
              </article>
            </section>
          </section>

          <section className="word-confirm-bar menu-glass-70">
            <div><ShieldCheck /><span><b>{stage === 'uploading' ? uploadProgress?.label : stage === 'complete' ? 'پیش‌نویس آماده شد' : 'آماده تأیید شما'}</b><small>{stage === 'review' ? 'با تأیید، فایل و بسته تبدیل فقط یک‌بار و به‌صورت ادامه‌پذیر ارسال می‌شوند.' : `${uploadProgress?.percent || 100}٪`}</small></span></div>
            {stage === 'review' && <div className="word-confirm-actions">
              <label className="replace-word"><RefreshCcw />بررسی فایل جدید<input type="file" accept=".docx" onChange={event => event.target.files?.[0] && analyze(event.target.files[0])} /></label>
              <Button onClick={confirmUpload} className="gap-2"><UploadCloud />تأیید و ارسال یک‌مرحله‌ای</Button>
            </div>}
            {stage === 'uploading' && <div className="word-upload-progress"><span style={{ width: `${uploadProgress?.percent || 0}%` }} /></div>}
            {stage === 'complete' && <Check className="word-complete-check" />}
          </section>
        </>
      )}
    </main>
  )
}
