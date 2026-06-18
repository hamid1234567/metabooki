import type { WordImportAnalysis } from '@/lib/word-import-types'
import { blockToHtml, blockToReaderBlock, pageText } from '@/lib/book-content'

export { blockToReaderBlock, pageText }

export function analysisToReaderPages(analysis: WordImportAnalysis, imageUrls: Record<string, string> = {}) {
  return (analysis.documentPages || analysis.previewPages).map(page => ({
    title: page.blocks.find(block => block.type === 'heading')?.text || (page.printNumber === undefined ? 'صفحه بدون شماره چاپی' : `صفحه ${Number.isFinite(Number(page.printNumber)) ? Number(page.printNumber).toLocaleString('fa-IR') : String(page.printNumber)}`),
    printNumber: page.printNumber,
    blocks: page.blocks.map(block => blockToReaderBlock(block, imageUrls, page, analysis)),
  }))
}

export function analysisToEditorHtml(analysis: WordImportAnalysis) {
  const pages = analysis.documentPages || analysis.previewPages
  const pageLabel = (page: WordImportAnalysis['previewPages'][number] | undefined, fallback: number) => {
    const value = page?.printNumber
    if (value === undefined || value === null || value === '') return ''
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('fa-IR') : String(value)
  }
  return pages.map((page, index) => {
    const beforeLabel = index ? pageLabel(pages[index - 1], index) : ''
    const afterLabel = index ? pageLabel(page, index + 1) : ''
    const separator = index
      ? `<hr data-page-break="true" data-before="${beforeLabel ? `پایان صفحه ${beforeLabel}` : ''}" data-after="${afterLabel ? `شروع صفحه ${afterLabel}` : ''}">`
      : ''
    return `${separator}${page.blocks.map(blockToHtml).join('')}`
  }).join('')
}
