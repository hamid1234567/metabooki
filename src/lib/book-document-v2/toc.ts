import { normalizeBookTextV2 } from '@/lib/book-document-v2/normalize'
import type { BookDocumentV2, BookPageV2, BookTocItemV2, HeadingBlockV2 } from '@/lib/book-document-v2/schema'

export function flattenTocV2(items: BookTocItemV2[]): BookTocItemV2[] {
  return items.flatMap(item => [item, ...flattenTocV2(item.children || [])])
}

export function headingBlocksFromPagesV2(pages: BookPageV2[]) {
  return pages.flatMap((page, fallbackPageIndex) =>
    page.blocks
      .filter((block): block is HeadingBlockV2 => block.type === 'heading')
      .map(block => ({ block, page, pageIndex: Number.isFinite(page.index) ? page.index : fallbackPageIndex })),
  )
}

export function buildTocFromHeadingsV2(pages: BookPageV2[]): BookTocItemV2[] {
  return headingBlocksFromPagesV2(pages).map(({ block, page, pageIndex }, index) => ({
    id: `toc-${block.id || index}`,
    title: normalizeBookTextV2(block.text),
    level: block.level,
    blockId: block.id,
    anchor: block.anchor,
    pageIndex,
    printNumber: page.printNumber,
  }))
}

export function resolveTocTreeV2(flatItems: BookTocItemV2[]) {
  const roots: BookTocItemV2[] = []
  const stack: BookTocItemV2[] = []
  flatItems.forEach(item => {
    const normalized: BookTocItemV2 = { ...item, children: item.children ? resolveTocTreeV2(item.children) : [] }
    while (stack.length && stack[stack.length - 1].level >= normalized.level) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.children = [...(parent.children || []), normalized]
    else roots.push(normalized)
    stack.push(normalized)
  })
  return roots
}

export function mergeLoadedPagesTocV2(currentToc: BookTocItemV2[], loadedPages: BookPageV2[]) {
  const currentFlatToc = flattenTocV2(currentToc)
  const loadedPageIndexes = new Set(loadedPages.map(page => Number(page.index)).filter(Number.isFinite))
  const loadedToc = buildTocFromHeadingsV2(loadedPages)
  const order = new Map<string, number>()
  currentFlatToc.forEach((item, index) => order.set(item.id, index * 1000))
  loadedToc.forEach((item, index) => order.set(item.id, (Number(item.pageIndex || 0) * 1000) + index))
  return [
    ...currentFlatToc.filter(item => !loadedPageIndexes.has(Number(item.pageIndex))),
    ...loadedToc,
  ].sort((a, b) => {
    const pageDelta = Number(a.pageIndex || 0) - Number(b.pageIndex || 0)
    if (pageDelta) return pageDelta
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  })
}

export function tocAsFlatListV2(document: BookDocumentV2) {
  return flattenTocV2(document.toc.length ? document.toc : buildTocFromHeadingsV2(document.pages))
}
