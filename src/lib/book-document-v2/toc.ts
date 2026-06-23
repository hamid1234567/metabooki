import { normalizeBookTextV2 } from '@/lib/book-document-v2/normalize'
import type { BookDocumentV2, BookPageV2, BookTocItemV2, HeadingBlockV2 } from '@/lib/book-document-v2/schema'

export function flattenTocV2(items: BookTocItemV2[]): BookTocItemV2[] {
  return items.flatMap(item => [item, ...flattenTocV2(item.children || [])])
}

export function headingBlocksFromPagesV2(pages: BookPageV2[]) {
  return pages.flatMap((page, pageIndex) =>
    page.blocks
      .filter((block): block is HeadingBlockV2 => block.type === 'heading')
      .map(block => ({ block, page, pageIndex })),
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

export function tocAsFlatListV2(document: BookDocumentV2) {
  return flattenTocV2(document.toc.length ? document.toc : buildTocFromHeadingsV2(document.pages))
}
