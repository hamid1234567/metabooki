/// <reference lib="webworker" />
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import type { ImportImage, ImportIssue, ImportPage, ImportParagraph, TocEntry, WordImportAnalysis, WordStyleDefinition } from '@/lib/word-import-types'

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
  return Object.entries(record)
    .filter(([key]) => key !== ':@' && key !== '#text')
    .map(([key, item]) => key === 'w:tab' ? '\t' : key === 'w:br' ? '\n' : collectText(item))
    .join('')
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

function findElementAttributes(value: unknown, key: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  if (Array.isArray(value)) value.forEach(item => found.push(...findElementAttributes(item, key)))
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (key in record) {
      const attributes = record[':@']
      if (attributes && typeof attributes === 'object') found.push(attributes as Record<string, unknown>)
    }
    Object.values(record).forEach(item => found.push(...findElementAttributes(item, key)))
  }
  return found
}

function elementAttribute(value: unknown, key: string, ...attributes: string[]) {
  const attrs = findElementAttributes(value, key)[0]
  return attributes.map(attribute => attrs?.[attribute]).find(item => item !== undefined)
}

function getStyle(node: unknown) {
  return String(elementAttribute(node, 'w:pStyle', '@_w:val', '@_val') || '')
}

function headingLevel(style: string) {
  const match = style.match(/(?:heading|toc|level|عنوان|تیتر|سطح)\s*[-_ ]?([1-6])/i)
  return match ? Number(match[1]) : 0
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseAlignment(value: unknown): WordStyleDefinition['alignment'] {
  const alignment = String(value || '').toLowerCase()
  if (alignment === 'both' || alignment === 'distribute') return 'justify'
  if (alignment === 'right' || alignment === 'left' || alignment === 'center') return alignment
  return undefined
}

function parseStyles(stylesXml: string | undefined) {
  const result = new Map<string, WordStyleDefinition>()
  if (!stylesXml) return result
  const parsed = regularParser.parse(stylesXml)
  const styles = normalizeArray(parsed?.['w:styles']?.['w:style'])
  for (const raw of styles) {
    if (raw?.['@_w:type'] !== 'paragraph') continue
    const id = String(raw?.['@_w:styleId'] || '')
    if (!id) continue
    const name = String(raw?.['w:name']?.['@_w:val'] || id)
    const outlineRaw = raw?.['w:pPr']?.['w:outlineLvl']?.['@_w:val']
    const outlineLevel = outlineRaw !== undefined ? Number(outlineRaw) : undefined
    const namedLevel = headingLevel(`${id} ${name}`)
    const suggestedLevel = namedLevel || (outlineLevel !== undefined && outlineLevel < 6 ? outlineLevel + 1 : null)
    const sizeRaw = raw?.['w:rPr']?.['w:sz']?.['@_w:val'] || raw?.['w:rPr']?.['w:szCs']?.['@_w:val']
    result.set(id, {
      id,
      name,
      usedCount: 0,
      suggestedLevel,
      selectedLevel: suggestedLevel,
      titleCandidate: /(^|\s)title($|\s)/i.test(`${id} ${name}`) && !/subtitle/i.test(`${id} ${name}`),
      basedOn: raw?.['w:basedOn']?.['@_w:val'],
      outlineLevel,
      fontSizePt: sizeRaw ? Number(sizeRaw) / 2 : undefined,
      color: raw?.['w:rPr']?.['w:color']?.['@_w:val'],
      bold: Boolean(raw?.['w:rPr']?.['w:b']),
      italic: Boolean(raw?.['w:rPr']?.['w:i']),
      alignment: parseAlignment(raw?.['w:pPr']?.['w:jc']?.['@_w:val']),
    })
  }
  for (const style of result.values()) {
    const parent = style.basedOn ? result.get(style.basedOn) : undefined
    if (!style.suggestedLevel && parent?.suggestedLevel) {
      style.suggestedLevel = parent.suggestedLevel
      style.selectedLevel = parent.suggestedLevel
    }
    style.fontSizePt ??= parent?.fontSizePt
    style.color ??= parent?.color
    style.bold ??= parent?.bold
    style.italic ??= parent?.italic
    style.alignment ??= parent?.alignment
  }
  return result
}

function hasPageBreak(node: unknown) {
  return findElementAttributes(node, 'w:br').some(attrs => attrs['@_w:type'] === 'page' || attrs['@_type'] === 'page')
    || deepFind(node, 'w:lastRenderedPageBreak').length > 0
}

function relationIds(node: unknown) {
  const ids = new Set<string>()
  for (const attrs of [...findElementAttributes(node, 'a:blip'), ...findElementAttributes(node, 'v:imagedata')]) {
    const id = attrs['@_r:embed'] || attrs['@_r:id']
    if (id) ids.add(String(id))
  }
  return [...ids]
}

function normalizeParagraph(node: unknown, number: number, imageRelations: Map<string, string>, styles: Map<string, WordStyleDefinition>): ImportParagraph[] {
  const style = getStyle(node)
  const definition = styles.get(style)
  const level = definition?.selectedLevel || headingLevel(style)
  const text = collectText(node).replace(/\s+\n/g, '\n').trim()
  const blocks: ImportParagraph[] = []
  if (definition) definition.usedCount += 1
  const directSize = elementAttribute(node, 'w:sz', '@_w:val')
  const directColor = elementAttribute(node, 'w:color', '@_w:val')
  const directAlignment = elementAttribute(node, 'w:jc', '@_w:val')
  const format: ImportParagraph['format'] = {
    fontSizePt: directSize ? Number(directSize) / 2 : definition?.fontSizePt,
    color: String(directColor || definition?.color || '').replace(/^auto$/i, '') || undefined,
    bold: deepFind(node, 'w:b').length > 0 || definition?.bold,
    italic: deepFind(node, 'w:i').length > 0 || definition?.italic,
    alignment: parseAlignment(directAlignment) || definition?.alignment,
  }
  if (text) blocks.push({ id: `p-${number}`, type: level ? 'heading' : 'paragraph', text, level: level || undefined, style: style || undefined, format })
  relationIds(node).forEach((relationId, index) => {
    const imageId = imageRelations.get(relationId)
    const extent = findElementAttributes(node, 'wp:extent')[index]
    const widthEmu = Number(extent?.['@_cx'] || extent?.['@_wp:cx'] || 0)
    if (imageId) blocks.push({ id: `p-${number}-image-${index}`, type: 'image', imageId, imageWidthPercent: widthEmu ? Math.min(100, Math.max(18, widthEmu / 914400 / 6.5 * 100)) : undefined })
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
  const styles = parseStyles(await zip.file('word/styles.xml')?.async('text'))
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
    if (block.type === 'heading' && block.text) toc.push({ id: block.id, title: block.text, level: block.level || 1, page: pages.length, included: true, styleId: block.style })
  }

  for (const item of bodyItems.flatMap(value => Array.isArray(value) ? value : [value])) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if ('w:p' in record) {
      paragraphNumber += 1
      const node = record['w:p']
      normalizeParagraph(node, paragraphNumber, imageRelations, styles).forEach(append)
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
  const suggestedTitleBlock = contentPages.flatMap(page => page.blocks).find(block => block.text && styles.get(block.style || '')?.titleCandidate)
  if (!toc.length) issues.push({ id: 'missing-toc', code: 'missing-toc', severity: 'warning', message: 'تیتر خودکار پیدا نشد؛ از بخش نگاشت Style، استایل‌های فصل را به H1 تا H6 متصل کنید.', page: 1 })
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
    styles: [...styles.values()].sort((a, b) => b.usedCount - a.usedCount || Number(Boolean(b.suggestedLevel)) - Number(Boolean(a.suggestedLevel)) || a.name.localeCompare(b.name)),
    suggestedTitle: suggestedTitleBlock?.text,
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
