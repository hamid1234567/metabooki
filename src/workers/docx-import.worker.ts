/// <reference lib="webworker" />
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import UTIF from 'utif'
import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter'
import { formatPrintNumber, normalizeBookText, printPageLabel } from '@/lib/book-content'
import type { ImportFootnote, ImportImage, ImportInlineSpan, ImportIssue, ImportPage, ImportParagraph, TocEntry, WordImportAnalysis, WordStyleDefinition } from '@/lib/word-import-types'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const orderedParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false })
const regularParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false })

function progress(value: number, label: string) {
  ctx.postMessage({ type: 'progress', progress: value, label })
}

const browserImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'])

function dataUrlToArrayBuffer(dataUrl: string) {
  const encoded = dataUrl.split(',')[1] || ''
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

async function canvasToPng(canvas: OffscreenCanvas) {
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
}

async function convertTiff(data: ArrayBuffer) {
  const directory = UTIF.decode(data)[0]
  if (!directory) throw new Error('ساختار TIFF قابل خواندن نیست.')
  UTIF.decodeImage(data, directory)
  const rgba = UTIF.toRGBA8(directory)
  const canvas = new OffscreenCanvas(directory.width, directory.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas محلی در دسترس نیست.')
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), directory.width, directory.height), 0, 0)
  return canvasToPng(canvas)
}

async function convertBrowserDecodableImage(data: ArrayBuffer, mimeType: string) {
  const bitmap = await createImageBitmap(new Blob([data], { type: mimeType }))
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas محلی در دسترس نیست.')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToPng(canvas)
}

async function convertImageLocally(image: ImportImage): Promise<ImportImage> {
  if (browserImageTypes.has(image.mimeType)) return { ...image, conversionStatus: 'original-web' }
  try {
    let converted: ArrayBuffer | null = null
    if (image.mimeType === 'image/tiff') converted = await convertTiff(image.data)
    else if (image.mimeType === 'image/emf' || image.mimeType === 'image/wmf') {
      const dataUrl = image.mimeType === 'image/emf'
        ? await convertEmfToDataUrl(image.data, 2400, 2400, { dpiScale: 2 })
        : await convertWmfToDataUrl(image.data, 2400, 2400, { dpiScale: 2 })
      if (dataUrl) converted = dataUrlToArrayBuffer(dataUrl)
    } else converted = await convertBrowserDecodableImage(image.data, image.mimeType)
    if (!converted) throw new Error('مبدل محلی خروجی قابل نمایش تولید نکرد.')
    return {
      ...image,
      name: image.name.replace(/\.[^.]+$/, '') + '.png',
      mimeType: 'image/png',
      data: converted,
      originalName: image.name,
      originalMimeType: image.mimeType,
      conversionStatus: 'converted-local',
    }
  } catch (error) {
    return {
      ...image,
      conversionStatus: 'conversion-failed',
      conversionError: error instanceof Error ? error.message : 'تبدیل محلی ناموفق بود.',
    }
  }
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function collectText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/Â¬|¬/g, '\u200C')
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return value.map(collectText).join('')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record['#text'] === 'string' || typeof record['#text'] === 'number' || typeof record['#text'] === 'bigint') {
    return String(record['#text']).replace(/Â¬|¬/g, '\u200C')
  }
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
  if (Array.isArray(value)) {
    value.forEach(item => found.push(...findElementAttributes(item, key)))
  }
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

function firstSentence(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const match = normalized.match(/^.{1,180}?[.!?؟؛](?:\s|$)/)
  return (match?.[0] || normalized.slice(0, 180)).trim()
}

function isCitationLabel(text: string) {
  return /^[\s[(（{]*[\d۰-۹٠-٩]+(?:\s*[-–,،؛;]\s*[\d۰-۹٠-٩]+)*[\s\])）}.,،؛;]*$/.test(text.trim())
}

function enrichPlainCitations(inline: ImportInlineSpan[]) {
  const citationPattern = /([[(（]\s*[\d۰-۹٠-٩]+(?:\s*[-–,،؛;]\s*[\d۰-۹٠-٩]+)*\s*[\])）])/g
  return inline.flatMap(span => {
    if (span.href || span.footnoteId || span.superscript || span.subscript || !citationPattern.test(span.text)) {
      citationPattern.lastIndex = 0
      return [span]
    }
    citationPattern.lastIndex = 0
    return span.text.split(citationPattern).filter(Boolean).map(text => {
      if (!isCitationLabel(text)) return { ...span, text }
      return {
        ...span,
        text,
        referenceText: `ارجاع ${text.trim()}؛ متن کامل منبع در این فایل Word موجود نیست.`,
      }
    })
  })
}

function parseAlignment(value: unknown): WordStyleDefinition['alignment'] {
  const alignment = String(value || '').toLowerCase()
  if (alignment === 'both' || alignment === 'distribute') return 'justify'
  if (alignment === 'right' || alignment === 'left' || alignment === 'center') return alignment
  return undefined
}

function wordToggle(value: unknown, key: string): boolean | undefined {
  const attributes = findElementAttributes(value, key)[0]
  const matches = deepFind(value, key)
  if (!attributes && !matches.length) return undefined
  const regularValue = matches[0] && typeof matches[0] === 'object' && !Array.isArray(matches[0])
    ? matches[0] as Record<string, unknown>
    : undefined
  const raw = String(attributes?.['@_w:val'] ?? attributes?.['@_val'] ?? regularValue?.['@_w:val'] ?? regularValue?.['@_val'] ?? 'true').toLowerCase()
  return !['0', 'false', 'off', 'none'].includes(raw)
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
    const captionCandidate = /(caption|figure|image|picture|شکل|تصویر|عکس)/i.test(`${id} ${name}`)
    const tableTitleCandidate = /(table\s*(title|caption)|عنوان\s*جدول|جدول)/i.test(`${id} ${name}`) && !captionCandidate
    const sizeRaw = raw?.['w:rPr']?.['w:sz']?.['@_w:val'] || raw?.['w:rPr']?.['w:szCs']?.['@_w:val']
    result.set(id, {
      id,
      name,
      usedCount: 0,
      suggestedLevel,
      selectedLevel: suggestedLevel,
      selectedRole: suggestedLevel ? 'heading' : captionCandidate ? 'caption' : tableTitleCandidate ? 'table-title' : 'body',
      titleCandidate: /(^|\s)title($|\s)/i.test(`${id} ${name}`) && !/subtitle/i.test(`${id} ${name}`),
      basedOn: raw?.['w:basedOn']?.['@_w:val'],
      outlineLevel,
      fontSizePt: sizeRaw ? Number(sizeRaw) / 2 : undefined,
      color: raw?.['w:rPr']?.['w:color']?.['@_w:val'],
      bold: wordToggle(raw?.['w:rPr'], 'w:b'),
      italic: wordToggle(raw?.['w:rPr'], 'w:i'),
      alignment: parseAlignment(raw?.['w:pPr']?.['w:jc']?.['@_w:val']),
    })
  }
  for (const style of result.values()) {
    const parent = style.basedOn ? result.get(style.basedOn) : undefined
    if (!style.suggestedLevel && parent?.suggestedLevel) {
      style.suggestedLevel = parent.suggestedLevel
      style.selectedLevel = parent.suggestedLevel
      style.selectedRole = 'heading'
    }
    style.fontSizePt ??= parent?.fontSizePt
    style.color ??= parent?.color
    style.bold ??= parent?.bold
    style.italic ??= parent?.italic
    style.alignment ??= parent?.alignment
  }
  return result
}

type NumberingFormats = Map<string, Map<number, string>>

function parseNumbering(numberingXml: string | undefined): NumberingFormats {
  const formats: NumberingFormats = new Map()
  if (!numberingXml) return formats
  const parsed = regularParser.parse(numberingXml)
  const root = parsed?.['w:numbering']
  const abstractFormats = new Map<string, Map<number, string>>()
  normalizeArray(root?.['w:abstractNum']).forEach(raw => {
    const abstractId = String(raw?.['@_w:abstractNumId'] ?? raw?.['@_abstractNumId'] ?? '')
    if (!abstractId) return
    const levelFormats = new Map<number, string>()
    normalizeArray(raw?.['w:lvl']).forEach(level => {
      const ilvl = Number(level?.['@_w:ilvl'] ?? level?.['@_ilvl'] ?? 0)
      const format = String(level?.['w:numFmt']?.['@_w:val'] ?? level?.['w:numFmt']?.['@_val'] ?? '')
      if (format) levelFormats.set(ilvl, format)
    })
    abstractFormats.set(abstractId, levelFormats)
  })
  normalizeArray(root?.['w:num']).forEach(raw => {
    const numId = String(raw?.['@_w:numId'] ?? raw?.['@_numId'] ?? '')
    const abstractId = String(raw?.['w:abstractNumId']?.['@_w:val'] ?? raw?.['w:abstractNumId']?.['@_val'] ?? '')
    const inherited = abstractFormats.get(abstractId)
    if (numId && inherited) formats.set(numId, inherited)
  })
  return formats
}

function paragraphListInfo(node: unknown, numberingFormats: NumberingFormats) {
  const numId = String(elementAttribute(node, 'w:numId', '@_w:val', '@_val') || '')
  if (!numId) return null
  const level = Number(elementAttribute(node, 'w:ilvl', '@_w:val', '@_val') || 0)
  const format = numberingFormats.get(numId)?.get(level) || numberingFormats.get(numId)?.get(0) || ''
  return { listId: numId, listLevel: Number.isFinite(level) ? level : 0, ordered: format ? !/bullet/i.test(format) : true }
}

function hasPageBreak(node: unknown) {
  return findElementAttributes(node, 'w:br').some(attrs => attrs['@_w:type'] === 'page' || attrs['@_type'] === 'page')
    || deepFind(node, 'w:lastRenderedPageBreak').length > 0
}

type PrintNumberState = { value: number; format: string }

function pageNumberSettings(node: unknown) {
  const matches = deepFind(node, 'w:pgNumType')
    .map(item => item && typeof item === 'object' ? (item as Record<string, unknown>)[':@'] as Record<string, unknown> | undefined : undefined)
    .filter(Boolean)
  const attrs = matches[matches.length - 1]
  if (!attrs) return null
  const start = Number(attrs['@_w:start'] ?? attrs['@_start'] ?? 0)
  const format = String(attrs['@_w:fmt'] ?? attrs['@_fmt'] ?? 'decimal')
  return { start: Number.isFinite(start) && start > 0 ? start : undefined, format }
}

function relationIds(node: unknown) {
  const ids = new Set<string>()
  for (const attrs of [...findElementAttributes(node, 'a:blip'), ...findElementAttributes(node, 'v:imagedata')]) {
    const id = attrs['@_r:embed'] || attrs['@_r:id']
    if (id) ids.add(String(id))
  }
  return [...ids]
}

function parseInline(node: unknown, hyperlinks: Map<string, string>, inheritedHref?: string): ImportInlineSpan[] {
  const spans: ImportInlineSpan[] = []
  let pendingPageBreak = false
  const visit = (value: unknown, href?: string) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && 'w:hyperlink' in (item as Record<string, unknown>)) {
          const attrs = (item as Record<string, Record<string, unknown>>)[':@']
          const relationId = String(attrs?.['@_r:id'] || '')
          const anchor = String(attrs?.['@_w:anchor'] || '')
          visit((item as Record<string, unknown>)['w:hyperlink'], hyperlinks.get(relationId) || (anchor ? `#${anchor}` : href))
        } else visit(item, href)
      })
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if ('w:lastRenderedPageBreak' in record || ('w:br' in record && String(elementAttribute([record], 'w:br', '@_w:type', '@_type') || '') === 'page')) {
      pendingPageBreak = true
      return
    }
    if ('w:instrText' in record || 'w:delText' in record) return
    if ('w:hyperlink' in record) {
      const hyperlink = record['w:hyperlink'] as Record<string, unknown> | undefined
      const attrs = hyperlink && typeof hyperlink === 'object' ? hyperlink : record[':@'] as Record<string, unknown> | undefined
      const relationId = String(attrs?.['@_r:id'] || '')
      const anchor = String(attrs?.['@_w:anchor'] || '')
      visit(record['w:hyperlink'], hyperlinks.get(relationId) || (anchor ? `#${anchor}` : href))
      return
    }
    if ('w:r' in record) {
      const run = record['w:r']
      if (hasPageBreak(run)) pendingPageBreak = true
      const vertical = String(elementAttribute(run, 'w:vertAlign', '@_w:val') || '')
      const runHref = href
      const textParts: string[] = []
      const footnoteId = String(elementAttribute(run, 'w:footnoteReference', '@_w:id', '@_id') || '')
      const collectVisible = (part: unknown) => {
        if (Array.isArray(part)) return part.forEach(collectVisible)
        if (!part || typeof part !== 'object') return
        const item = part as Record<string, unknown>
        if ('w:instrText' in item || 'w:fldChar' in item || 'w:delText' in item) return
        if ('w:t' in item) textParts.push(collectText(item['w:t']))
        else if ('w:tab' in item) textParts.push(' ')
        else if ('w:br' in item) textParts.push('\n')
        else Object.values(item).forEach(collectVisible)
      }
      collectVisible(run)
      const text = normalizeBookText(textParts.join(''))
      if (text || footnoteId) spans.push({
        text: text || footnoteId,
        bold: wordToggle(run, 'w:b') ?? wordToggle(run, 'w:bCs'),
        italic: wordToggle(run, 'w:i') ?? wordToggle(run, 'w:iCs'),
        superscript: vertical === 'superscript',
        subscript: vertical === 'subscript',
        href: runHref,
        footnoteId: footnoteId || undefined,
        pageBreakBefore: pendingPageBreak || undefined,
      })
      pendingPageBreak = false
      return
    }
    Object.values(record).forEach(item => visit(item, href))
  }
  visit(node, inheritedHref)
  return spans
}

function normalizeParagraph(node: unknown, number: number, imageRelations: Map<string, string>, hyperlinks: Map<string, string>, styles: Map<string, WordStyleDefinition>, numberingFormats: NumberingFormats): ImportParagraph[] {
  const style = getStyle(node) || '__no_style__'
  const definition = styles.get(style)
  const level = definition?.selectedLevel || headingLevel(style)
  const listInfo = !level ? paragraphListInfo(node, numberingFormats) : null
  const inline = enrichPlainCitations(parseInline(node, hyperlinks))
  const text = inline.map(span => span.text).join('').replace(/[ \t]+\n/g, '\n').trim()
  const anchors = findElementAttributes(node, 'w:bookmarkStart')
    .map(attrs => String(attrs['@_w:name'] || attrs['@_name'] || ''))
    .filter(anchor => anchor && anchor !== '_GoBack')
  const anchor = anchors[0]
  const blocks: ImportParagraph[] = []
  if (definition) {
    definition.usedCount += 1
    if (!definition.sampleText && text) definition.sampleText = firstSentence(text)
  }
  const directSize = elementAttribute(node, 'w:sz', '@_w:val')
  const directColor = elementAttribute(node, 'w:color', '@_w:val')
  const directAlignment = elementAttribute(node, 'w:jc', '@_w:val')
  const format: ImportParagraph['format'] = {
    fontSizePt: directSize ? Number(directSize) / 2 : definition?.fontSizePt,
    color: String(directColor || definition?.color || '').replace(/^auto$/i, '') || undefined,
    bold: definition?.bold,
    italic: definition?.italic,
    alignment: parseAlignment(directAlignment) || definition?.alignment,
  }
  const semanticType: ImportParagraph['type'] = level ? 'heading' : definition?.selectedRole === 'caption' ? 'caption' : definition?.selectedRole === 'table-title' ? 'table-title' : listInfo ? 'list' : 'paragraph'
  const leadingPageBreak = Boolean(inline[0]?.pageBreakBefore)
  const inlineGroups = inline.reduce<ImportInlineSpan[][]>((groups, span) => {
    if (span.pageBreakBefore && groups[groups.length - 1]?.length) groups.push([])
    groups[groups.length - 1].push({ ...span, pageBreakBefore: undefined })
    return groups
  }, [[]]).filter(group => group.length)
  inlineGroups.forEach((group, groupIndex) => {
    const groupText = group.map(span => span.text).join('').replace(/[ \t]+\n/g, '\n').trim()
    if (groupText) blocks.push({
      id: `p-${number}${groupIndex ? `-${groupIndex}` : ''}`,
      type: semanticType,
      text: groupText,
      inline: group,
      items: listInfo ? [{ text: groupText, inline: group }] : undefined,
      ordered: listInfo?.ordered,
      listLevel: listInfo?.listLevel,
      listId: listInfo?.listId,
      level: level || undefined,
      style: style || undefined,
      anchor: groupIndex ? undefined : anchor,
      anchors: groupIndex ? undefined : anchors,
      format,
      pageBreakBefore: groupIndex > 0 || (groupIndex === 0 && leadingPageBreak) || undefined,
    })
  })
  relationIds(node).filter(relationId => imageRelations.has(relationId)).forEach((relationId, index) => {
    const imageId = imageRelations.get(relationId)
    const extent = findElementAttributes(node, 'wp:extent')[index]
    const widthEmu = Number(extent?.['@_cx'] || extent?.['@_wp:cx'] || 0)
    if (imageId) blocks.push({
      id: `p-${number}-image-${index}`,
      type: 'image',
      imageId,
      imageWidthPercent: widthEmu ? Math.min(100, widthEmu / 914400 / 6.5 * 100) : undefined,
      imageWidthPx: widthEmu ? Math.round(widthEmu / 914400 * 96) : undefined,
    })
  })
  if (deepFind(node, 'm:oMath').length || deepFind(node, 'm:oMathPara').length) {
    blocks.push({ id: `p-${number}-math`, type: 'math', text: text || 'فرمول استخراج‌شده از Word' })
  }
  return blocks
}

function parseFootnotes(xml: string | undefined, hyperlinks: Map<string, string>): ImportFootnote[] {
  if (!xml) return []
  const parsed = regularParser.parse(xml)
  return normalizeArray(parsed?.['w:footnotes']?.['w:footnote'])
    .filter(note => Number(note?.['@_w:id']) >= 0)
    .map(note => {
      const inline = parseInline(note, hyperlinks).filter(span => !span.footnoteId)
      return { id: String(note['@_w:id']), inline, text: inline.map(span => span.text).join('').trim() }
    })
    .filter(note => note.text)
}

function tableBlock(node: unknown, number: number, hyperlinks: Map<string, string>): ImportParagraph {
  const rows = deepFind(node, 'w:tr').map(row => deepFind(row, 'w:tc').map(cell => parseInline(cell, hyperlinks).map(span => span.text).join('').trim()))
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
  const numberingFormats = parseNumbering(await zip.file('word/numbering.xml')?.async('text'))
  styles.set('__no_style__', {
    id: '__no_style__',
    name: 'بدون Style صریح (متن عادی)',
    usedCount: 0,
    suggestedLevel: null,
    selectedLevel: null,
    selectedRole: 'body',
    titleCandidate: false,
  })
  const relationships = new Map<string, string>()
  const hyperlinks = new Map<string, string>()
  const relsEntry = zip.file('word/_rels/document.xml.rels')
  if (relsEntry) {
    const rels = regularParser.parse(await relsEntry.async('text'))
    const entries = rels?.Relationships?.Relationship || []
    for (const rel of Array.isArray(entries) ? entries : [entries]) {
      if (rel?.['@_Id'] && rel?.['@_Target']) {
        const target = String(rel['@_Target'])
        if (String(rel?.['@_Type'] || '').endsWith('/hyperlink')) hyperlinks.set(rel['@_Id'], target)
        else relationships.set(rel['@_Id'], target.replace('../', ''))
      }
    }
  }
  const footnotes = parseFootnotes(await zip.file('word/footnotes.xml')?.async('text'), hyperlinks)

  const extractedImages: ImportImage[] = []
  const imageByPath = new Map<string, string>()
  const imageEntries = Object.values(zip.files).filter(entry => !entry.dir && entry.name.startsWith('word/media/'))
  for (const [index, entry] of imageEntries.entries()) {
    const extension = entry.name.split('.').pop()?.toLowerCase() || 'bin'
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
      wmf: 'image/wmf', emf: 'image/emf', bmp: 'image/bmp',
    }
    const mimeType = mimeTypes[extension] || 'application/octet-stream'
    const id = `image-${index + 1}`
    extractedImages.push({ id, name: entry.name.split('/').pop() || id, mimeType, data: await entry.async('arraybuffer') })
    if (extension !== 'wdp') imageByPath.set(entry.name.replace('word/', ''), id)
  }
  const images: ImportImage[] = []
  for (const [index, image] of extractedImages.entries()) {
    progress(22 + Math.round((index + 1) / Math.max(1, extractedImages.length) * 20), `تبدیل محلی تصویر ${index + 1} از ${extractedImages.length}`)
    images.push(await convertImageLocally(image))
  }
  const imageRelations = new Map([...relationships].map(([id, path]) => [id, imageByPath.get(path)]).filter((item): item is [string, string] => Boolean(item[1])))

  progress(45, 'ساخت پیش‌نمایش محلی')
  const parsed = orderedParser.parse(await documentEntry.async('text'))
  const body = deepFind(parsed, 'w:body')[0] || parsed
  const bodyItems = Array.isArray(body) ? body : [body]
  let printState: PrintNumberState | null = null
  const printNumberForState = () => printState ? formatPrintNumber(printState.value, printState.format) : undefined
  const pages: ImportPage[] = [{ number: 1, printNumber: printNumberForState(), blocks: [] }]
  const toc: TocEntry[] = []
  const issues: ImportIssue[] = []
  let paragraphNumber = 0
  let tableNumber = 0

  const pushPage = (settings?: { start?: number; format?: string } | null) => {
    if (pages.length >= 2000) return
    if (settings?.start) printState = { value: settings.start, format: settings.format || 'decimal' }
    else if (printState) printState = { ...printState, value: printState.value + 1 }
    pages.push({ number: pages.length + 1, printNumber: printNumberForState(), blocks: [] })
  }

  const append = (block: ImportParagraph) => {
    if (block.pageBreakBefore && pages[pages.length - 1].blocks.length) pushPage()
    if (block.type === 'list') {
      const currentBlocks = pages[pages.length - 1].blocks
      const previous = currentBlocks[currentBlocks.length - 1]
      if (
        previous?.type === 'list'
        && previous.ordered === block.ordered
        && previous.listLevel === block.listLevel
        && previous.listId === block.listId
        && !block.pageBreakBefore
      ) {
        previous.items = [...(previous.items || []), ...(block.items || [])]
        previous.text = [previous.text, block.text].filter(Boolean).join('\n')
        return
      }
    }
    pages[pages.length - 1].blocks.push(block)
    if (block.type === 'heading' && block.text) {
      const page = pages[pages.length - 1]
      const numericPrintNumber = Number(page.printNumber)
      toc.push({ id: block.id, title: block.text, level: block.level || 1, page: Number.isFinite(numericPrintNumber) ? numericPrintNumber : page.number, included: true, styleId: block.style })
    }
  }

  for (const item of bodyItems.flatMap(value => Array.isArray(value) ? value : [value])) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if ('w:p' in record) {
      paragraphNumber += 1
      const node = record['w:p']
      const normalized = normalizeParagraph(node, paragraphNumber, imageRelations, hyperlinks, styles, numberingFormats)
      normalized.forEach(append)
      const sectionPageStart = pageNumberSettings(node)
      if (sectionPageStart?.start && pages[pages.length - 1].blocks.length) pushPage(sectionPageStart)
      else if (hasPageBreak(node) && !normalized.some(block => block.pageBreakBefore)) pushPage()
    } else if ('w:tbl' in record) {
      tableNumber += 1
      append(tableBlock(record['w:tbl'], tableNumber, hyperlinks))
    }
  }

  let lastContentPageIndex = pages.length - 1
  while (lastContentPageIndex > 0 && !pages[lastContentPageIndex].blocks.length) lastContentPageIndex -= 1
  const physicalPages = pages.slice(0, Math.max(1, lastContentPageIndex + 1))
  const contentPages = physicalPages
  const hasExplicitPrintNumbers = contentPages.some(page => page.printNumber !== undefined)
  if (!hasExplicitPrintNumbers) {
    const firstTextPageIndex = contentPages.findIndex(page => (page.blocks || []).some(block => block.type === 'heading'))
    if (firstTextPageIndex >= 0) {
      contentPages.forEach((page, index) => {
        page.printNumber = index >= firstTextPageIndex ? index - firstTextPageIndex + 1 : undefined
      })
    }
  }
  const pageForBlockId = new Map<string, ImportPage>()
  contentPages.forEach(page => page.blocks.forEach(block => pageForBlockId.set(block.id, page)))
  toc.forEach(item => {
    const page = pageForBlockId.get(item.id)
    if (!page) return
    const printNumber = Number(page.printNumber)
    item.page = Number.isFinite(printNumber) ? printNumber : page.number
  })

  const paragraphs = contentPages.flatMap(page => page.blocks)
  const footnoteTargets = new Map(footnotes.map(note => [note.id, note.text]))
  paragraphs.forEach(block => block.inline?.forEach(span => {
    if (span.footnoteId) span.footnoteText = footnoteTargets.get(span.footnoteId)
  }))
  const anchorTargets = new Map<string, string>()
  paragraphs.forEach(block => block.anchors?.forEach(anchor => {
    if (block.text) anchorTargets.set(anchor, block.text)
  }))
  paragraphs.forEach(block => block.inline?.forEach(span => {
    if (!span.href?.startsWith('#') || !isCitationLabel(span.text)) return
    const targetAnchor = span.href.slice(1)
    const targetText = anchorTargets.get(targetAnchor)
    if (targetText) {
      span.referenceAnchor = targetAnchor
      span.referenceText = targetText.slice(0, 800)
    }
  }))
  const imageUsage = new Map<string, { pages: Set<number | string>; caption?: string; previewBlockId?: string; contextBefore?: string; contextAfter?: string }>()
  contentPages.forEach(page => page.blocks.forEach((block, index, blocks) => {
    if (block.type !== 'image' || !block.imageId) return
    const usage = imageUsage.get(block.imageId) || { pages: new Set<number>() }
    usage.pages.add(page.printNumber ?? page.number)
    const next = blocks[index + 1]
    const previous = blocks[index - 1]
    usage.caption ||= next?.type === 'caption' ? next.text : previous?.type === 'caption' ? previous.text : undefined
    usage.previewBlockId ||= block.id
    usage.contextBefore ||= previous?.text?.slice(0, 180)
    usage.contextAfter ||= next?.text?.slice(0, 180)
    imageUsage.set(block.imageId, usage)
  }))
  images.forEach(image => {
    const usage = imageUsage.get(image.id)
    image.isReferenced = Boolean(usage)
    image.wordPages = usage ? [...usage.pages] : []
    image.caption = usage?.caption
    image.previewBlockId = usage?.previewBlockId
    image.contextBefore = usage?.contextBefore
    image.contextAfter = usage?.contextAfter
  })
  const suggestedTitleBlock = contentPages.flatMap(page => page.blocks).find(block => block.text && styles.get(block.style || '')?.titleCandidate)
  if (!toc.length) issues.push({ id: 'missing-toc', code: 'missing-toc', severity: 'warning', message: 'تیتر خودکار پیدا نشد؛ از بخش نگاشت Style، استایل‌های فصل را به H1 تا H6 متصل کنید.', page: 1 })
  const convertedImageCount = images.filter(image => image.conversionStatus === 'converted-local').length
  if (convertedImageCount) issues.push({ id: 'image-format-summary', code: 'converted-image', severity: 'info', message: `از مجموع ${images.length.toLocaleString('fa-IR')} تصویر، ${convertedImageCount.toLocaleString('fa-IR')} تصویر پیش از آپلود به‌صورت محلی تبدیل و در پیش‌نمایش جایگزین شد.`, page: 1 })
  images.filter(image => image.isReferenced && image.conversionStatus === 'conversion-failed').forEach(image => {
    const printPage = image.wordPages?.[0] || 1
    const issuePage = Number(printPage)
    issues.push({
      id: `image-conversion-failed-${image.id}`,
      imageId: image.id,
      code: 'unsupported-image',
      severity: 'warning',
      page: Number.isFinite(issuePage) ? issuePage : 1,
      message: `${image.caption || image.originalName || image.name} در صفحه چاپی ${printPageLabel(printPage)} تبدیل نشد: ${image.conversionError || 'فرمت پشتیبانی نمی‌شود.'}`,
    })
  })
  const stats = {
    paragraphs: paragraphs.filter(block => block.type === 'paragraph').length,
    headings: paragraphs.filter(block => block.type === 'heading').length,
    images: images.length,
    tables: paragraphs.filter(block => block.type === 'table').length,
    formulas: paragraphs.filter(block => block.type === 'math').length,
    footnotes: footnotes.length,
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
    documentPages: contentPages,
    previewPages: contentPages.slice(0, 50),
    toc: toc.map(item => ({
      ...item,
      previewAvailable: contentPages.slice(0, 50).some(page => page.blocks.some(block => block.id === item.id)),
    })),
    styles: [...styles.values()].filter(style => style.usedCount > 0).sort((a, b) => {
      const priority = (style: WordStyleDefinition) => style.selectedRole === 'heading' ? 0 : style.selectedRole === 'caption' || style.selectedRole === 'table-title' ? 1 : style.usedCount ? 2 : 3
      return priority(a) - priority(b) || (a.selectedLevel || 99) - (b.selectedLevel || 99) || b.usedCount - a.usedCount || a.name.localeCompare(b.name)
    }),
    suggestedTitle: suggestedTitleBlock?.text,
    issues,
    images,
    footnotes,
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
