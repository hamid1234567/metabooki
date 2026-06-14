/// <reference lib="webworker" />
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import type { ImportImage, ImportIssue, ImportPage, ImportParagraph, TocEntry, WordImportAnalysis } from '@/lib/word-import-types'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const orderedParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true })
const regularParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

function progress(value: number, label: string) {
  ctx.postMessage({ type: 'progress', progress: value, label })
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function collectText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectText).join('')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record['#text'] === 'string') return record['#text']
  return Object.entries(record).filter(([key]) => key === 'w:t' || key === 'w:tab' || key === 'w:br').map(([, item]) => collectText(item)).join('')
}

function deepFind(value: unknown, key: string): unknown[] {
  const found: unknown[] = []
  if (Array.isArray(value)) value.forEach(item => found.push(...deepFind(item, key)))
  else if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([entryKey, item]) => {
      if (entryKey === key) found.push(item)
      found.push(...deepFind(item, key))
    })
  }
  return found
}

function getStyle(node: unknown) {
  const styles = deepFind(node, 'w:pStyle')
  const first = styles[0] as Record<string, unknown> | undefined
  return String(first?.['@_w:val'] || first?.['@_val'] || '')
}

function headingLevel(style: string) {
  const match = style.match(/(?:heading|عنوان|تیتر)\s*([1-6])/i)
  return match ? Number(match[1]) : 0
}

function hasPageBreak(node: unknown) {
  return deepFind(node, 'w:br').some(item => {
    const value = item as Record<string, unknown>
    return value?.['@_w:type'] === 'page' || value?.['@_type'] === 'page'
  }) || deepFind(node, 'w:lastRenderedPageBreak').length > 0
}

function relationIds(node: unknown) {
  const ids = new Set<string>()
  for (const item of [...deepFind(node, 'a:blip'), ...deepFind(node, 'v:imagedata')]) {
    const record = item as Record<string, unknown>
    const id = record?.['@_r:embed'] || record?.['@_r:id']
    if (id) ids.add(String(id))
  }
  return [...ids]
}

function normalizeParagraph(node: unknown, number: number, imageRelations: Map<string, string>): ImportParagraph[] {
  const style = getStyle(node)
  const level = headingLevel(style)
  const text = collectText(node).replace(/\s+\n/g, '\n').trim()
  const blocks: ImportParagraph[] = []
  if (text) blocks.push({ id: `p-${number}`, type: level ? 'heading' : 'paragraph', text, level: level || undefined, style: style || undefined })
  relationIds(node).forEach((relationId, index) => {
    const imageId = imageRelations.get(relationId)
    if (imageId) blocks.push({ id: `p-${number}-image-${index}`, type: 'image', imageId })
  })
  if (deepFind(node, 'm:oMath').length || deepFind(node, 'm:oMathPara').length) {
    blocks.push({ id: `p-${number}-math`, type: 'math', text: text || 'فرمول استخراج‌شده از Word' })
  }
  return blocks
}

function tableBlock(node: unknown, number: number): ImportParagraph {
  const rows = deepFind(node, 'w:tr').map(row => deepFind(row, 'w:tc').map(cell => collectText(cell).trim()))
  return { id: `table-${number}`, type: 'table', rows }
}

function calculateComplexity(stats: WordImportAnalysis['stats'], issues: ImportIssue[]) {
  const factors = [
    { label: 'تعداد صفحات', value: Math.ceil(stats.paragraphs / 14), weight: 1 },
    { label: 'تصاویر', value: stats.images, weight: 2 },
    { label: 'جدول‌ها', value: stats.tables, weight: 3 },
    { label: 'فرمول‌ها', value: stats.formulas, weight: 4 },
    { label: 'موارد نیازمند بررسی', value: issues.length, weight: 2 },
  ]
  const raw = factors.reduce((sum, item) => sum + item.value * item.weight, 0)
  const score = Math.min(100, Math.max(1, Math.round(raw / 5)))
  const grade: WordImportAnalysis['complexity']['grade'] = score < 20 ? 'ساده' : score < 45 ? 'متوسط' : score < 75 ? 'پیچیده' : 'بسیار پیچیده'
  return { score, grade, estimatedCredits: Math.max(10, Math.ceil(score * 1.5)), factors }
}

async function analyze(file: File): Promise<WordImportAnalysis> {
  progress(5, 'بررسی فایل در دستگاه شما')
  if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('در این مرحله فقط فایل DOCX پشتیبانی می‌شود.')
  if (file.size > 200 * 1024 * 1024) throw new Error('حجم فایل باید کمتر از ۲۰۰ مگابایت باشد.')

  const zip = await JSZip.loadAsync(file)
  const documentEntry = zip.file('word/document.xml')
  if (!documentEntry) throw new Error('ساختار استاندارد Word در فایل پیدا نشد.')

  progress(20, 'استخراج ساختار و ارتباط تصاویر')
  const relationships = new Map<string, string>()
  const relsEntry = zip.file('word/_rels/document.xml.rels')
  if (relsEntry) {
    const rels = regularParser.parse(await relsEntry.async('text'))
    const entries = rels?.Relationships?.Relationship || []
    for (const rel of Array.isArray(entries) ? entries : [entries]) {
      if (rel?.['@_Id'] && rel?.['@_Target']) relationships.set(rel['@_Id'], String(rel['@_Target']).replace('../', ''))
    }
  }

  const images: ImportImage[] = []
  const imageByPath = new Map<string, string>()
  const imageEntries = Object.values(zip.files).filter(entry => !entry.dir && entry.name.startsWith('word/media/'))
  for (const [index, entry] of imageEntries.entries()) {
    const extension = entry.name.split('.').pop()?.toLowerCase() || 'bin'
    const mimeType = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : extension === 'svg' ? 'image/svg+xml' : extension === 'tif' || extension === 'tiff' ? 'image/tiff' : 'image/jpeg'
    const id = `image-${index + 1}`
    images.push({ id, name: entry.name.split('/').pop() || id, mimeType, data: await entry.async('arraybuffer') })
    imageByPath.set(entry.name.replace('word/', ''), id)
  }
  const imageRelations = new Map([...relationships].map(([id, path]) => [id, imageByPath.get(path)]).filter((item): item is [string, string] => Boolean(item[1])))

  progress(45, 'ساخت پیش‌نمایش محلی')
  const parsed = orderedParser.parse(await documentEntry.async('text'))
  const body = deepFind(parsed, 'w:body')[0] || parsed
  const bodyItems = Array.isArray(body) ? body : [body]
  const pages: ImportPage[] = [{ number: 1, blocks: [] }]
  const toc: TocEntry[] = []
  const issues: ImportIssue[] = []
  let paragraphNumber = 0
  let tableNumber = 0

  const append = (block: ImportParagraph) => {
    pages[pages.length - 1].blocks.push(block)
    if (block.type === 'heading' && block.text) toc.push({ id: block.id, title: block.text, level: block.level || 1, page: pages.length, included: true })
  }

  for (const item of bodyItems.flatMap(value => Array.isArray(value) ? value : [value])) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if ('w:p' in record) {
      paragraphNumber += 1
      const node = record['w:p']
      normalizeParagraph(node, paragraphNumber, imageRelations).forEach(append)
      if (hasPageBreak(node) && pages.length < 2000) pages.push({ number: pages.length + 1, blocks: [] })
    } else if ('w:tbl' in record) {
      tableNumber += 1
      append(tableBlock(record['w:tbl'], tableNumber))
    }
  }

  const nonEmptyPages = pages.filter(page => page.blocks.length)
  const contentPages = nonEmptyPages.length > 1
    ? nonEmptyPages
    : Array.from({ length: Math.max(1, Math.ceil((nonEmptyPages[0]?.blocks.length || 0) / 14)) }, (_, index) => ({
        number: index + 1,
        blocks: (nonEmptyPages[0]?.blocks || []).slice(index * 14, (index + 1) * 14),
      }))

  const paragraphs = contentPages.flatMap(page => page.blocks)
  if (!toc.length) issues.push({ id: 'missing-toc', code: 'missing-toc', severity: 'warning', message: 'هیچ تیتر استانداردی پیدا نشد؛ استایل Heading را در Word بررسی کنید.', page: 1 })
  images.filter(image => image.mimeType === 'image/tiff').forEach((image, index) => issues.push({ id: `image-format-${index}`, code: 'unsupported-image', severity: 'warning', message: `تصویر ${image.name} برای وب باید در سرور تبدیل شود.`, page: 1 }))
  const stats = {
    paragraphs: paragraphs.filter(block => block.type === 'paragraph').length,
    headings: paragraphs.filter(block => block.type === 'heading').length,
    images: images.length,
    tables: paragraphs.filter(block => block.type === 'table').length,
    formulas: paragraphs.filter(block => block.type === 'math').length,
    words: paragraphs.reduce((sum, block) => sum + (block.text?.split(/\s+/).filter(Boolean).length || 0), 0),
  }

  progress(80, 'محاسبه گزارش و درجه سختی')
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    checksum: await sha256(file),
    createdAt: new Date().toISOString(),
    totalPages: contentPages.length,
    previewPages: contentPages.slice(0, 50),
    toc,
    issues,
    images,
    stats,
    complexity: calculateComplexity(stats, issues),
  }
}

ctx.onmessage = async event => {
  try {
    const analysis = await analyze(event.data.file)
    progress(100, 'پیش‌نمایش محلی آماده است')
    ctx.postMessage({ type: 'complete', analysis })
  } catch (error) {
    ctx.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'تحلیل فایل ناموفق بود.' })
  }
}

export {}
