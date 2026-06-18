import type { WordImportAnalysis, WordStyleDefinition } from '@/lib/word-import-types'

export function applyWordStyleMapping(
  analysis: WordImportAnalysis,
  styleId: string,
  mapping: string,
): WordImportAnalysis {
  const selectedLevel = mapping.startsWith('h') ? Number(mapping.slice(1)) : null
  const selectedRole: WordStyleDefinition['selectedRole'] = mapping.startsWith('h') ? 'heading' : mapping === 'caption' ? 'caption' : mapping === 'table-title' ? 'table-title' : mapping === 'ignore' ? 'ignore' : 'body'
  const styles = analysis.styles.map(style => style.id === styleId ? { ...style, selectedLevel, selectedRole } : style)
  const mappedPages = (analysis.documentPages || analysis.previewPages).map(page => ({
    ...page,
    blocks: page.blocks.map(block => {
      if (block.style !== styleId || !block.text) return block
      return {
        ...block,
        type: selectedLevel ? 'heading' as const : selectedRole === 'caption' ? 'caption' as const : selectedRole === 'table-title' ? 'table-title' as const : 'paragraph' as const,
        level: selectedLevel || undefined,
      }
    }),
  }))
  const toc = mappedPages.flatMap((page, pageIndex) => page.blocks
    .filter(block => block.type === 'heading' && block.text)
    .map(block => ({
      id: block.id,
      title: block.text || '',
      level: block.level || 1,
      page: Number.isFinite(Number(page.printNumber)) ? Number(page.printNumber) : page.number,
      included: analysis.toc.find(item => item.id === block.id)?.included ?? true,
      styleId: block.style,
      previewAvailable: pageIndex < 50,
    })))
  return {
    ...analysis,
    styles,
    documentPages: mappedPages,
    previewPages: mappedPages.slice(0, 50),
    toc,
    stats: { ...analysis.stats, headings: toc.length },
    issues: toc.length
      ? analysis.issues.filter(issue => issue.code !== 'missing-toc')
      : analysis.issues.some(issue => issue.code === 'missing-toc')
        ? analysis.issues
        : [...analysis.issues, { id: 'missing-toc', code: 'missing-toc', severity: 'warning', message: 'برای ساخت فهرست حداقل یک Style را به H1 تا H6 متصل کنید.', page: 1 }],
  }
}
