import type { WordImportAnalysis } from '@/lib/word-import-types'
import { blockToHtml, blockToReaderBlock, pageBreakHtml, pageText, printPageLabel } from '@/lib/book-content'

export { blockToReaderBlock, pageText }

export function analysisToReaderPages(analysis: WordImportAnalysis, imageUrls: Record<string, string> = {}) {
  return (analysis.documentPages || analysis.previewPages).map(page => ({
    title: page.blocks.find(block => block.type === 'heading')?.text || (page.printNumber === undefined ? 'صفحه بدون شماره چاپی' : `صفحه ${printPageLabel(page.printNumber)}`),
    printNumber: page.printNumber,
    blocks: page.blocks.map(block => blockToReaderBlock(block, imageUrls, page, analysis)),
  }))
}

export function analysisToEditorHtml(analysis: WordImportAnalysis) {
  const pages = analysis.documentPages || analysis.previewPages
  return pages.map((page, index) => {
    const separator = index ? pageBreakHtml(pages[index - 1], page) : ''
    return `${separator}${page.blocks.map(blockToHtml).join('')}`
  }).join('')
}
