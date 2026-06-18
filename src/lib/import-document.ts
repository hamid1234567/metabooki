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
  return (analysis.documentPages || analysis.previewPages).map(page => page.blocks.map(blockToHtml).join('')).join('<hr data-page-break="true">')
}
