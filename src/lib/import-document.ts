import type { WordImportAnalysis } from '@/lib/word-import-types'
import { blockToHtml, blockToReaderBlock, pageText } from '@/lib/book-content'

export { blockToReaderBlock, pageText }

export function analysisToReaderPages(analysis: WordImportAnalysis, imageUrls: Record<string, string> = {}) {
  return (analysis.documentPages || analysis.previewPages).map(page => ({
    title: page.blocks.find(block => block.type === 'heading')?.text || `صفحه ${(page.printNumber || page.number).toLocaleString('fa-IR')}`,
    printNumber: page.printNumber || page.number,
    blocks: page.blocks.map(block => blockToReaderBlock(block, imageUrls, page, analysis)),
  }))
}

export function analysisToEditorHtml(analysis: WordImportAnalysis) {
  const pages = analysis.documentPages || analysis.previewPages
  const pageLabel = (page: WordImportAnalysis['previewPages'][number] | undefined, fallback: number) => {
    const value = page?.printNumber || page?.number || fallback
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('fa-IR') : String(value)
  }
  return pages.map((page, index) => {
    const separator = index
      ? `<hr data-page-break="true" data-before="پایان صفحه ${pageLabel(pages[index - 1], index)}" data-after="شروع صفحه ${pageLabel(page, index + 1)}">`
      : ''
    return `${separator}${page.blocks.map(blockToHtml).join('')}`
  }).join('')
}
