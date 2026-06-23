import type { CSSProperties, ElementType, ReactNode } from 'react'
import { InlineTextV2 } from '@/components/book-content-v2/InlineTextV2'
import { PageBreakV2 } from '@/components/book-content-v2/PageBreakV2'
import { CalloutBlockV2 } from '@/components/book-content-v2/CalloutBlockV2'
import { InteractiveBlockV2 } from '@/components/book-content-v2/InteractiveBlockV2'
import { normalizeBookTextV2, textDirectionV2, type BookBlockV2, type BookDocumentV2, type BookPageV2 } from '@/lib/book-document-v2'
import './book-content-v2.css'

function blockStyle(block: BookBlockV2): CSSProperties {
  const format = (block.style || {}) as Record<string, unknown>
  return {
    color: format.color ? String(format.color) : undefined,
    fontSize: format.fontSizePt ? `${format.fontSizePt}pt` : undefined,
    fontWeight: format.bold ? 800 : undefined,
    fontStyle: format.italic ? 'italic' : undefined,
    textAlign: format.alignment ? String(format.alignment) as CSSProperties['textAlign'] : undefined,
  }
}

function tableRows(block: Extract<BookBlockV2, { type: 'table' }>) {
  const bodyRows = block.headers?.length ? block.rows : block.rows.slice(1)
  const headers = block.headers?.length ? block.headers : block.rows[0] || []
  return { headers, bodyRows }
}

export function renderBookBlockV2(block: BookBlockV2, renderChildren: (blocks: BookBlockV2[]) => ReactNode) {
  const direction = block.direction === 'auto' || !block.direction ? textDirectionV2('text' in block ? block.text : '') : block.direction
  if (block.type === 'heading') {
    const HeadingTag = `h${block.level}` as ElementType
    return (
      <HeadingTag
        key={block.id}
        id={block.anchor || block.id}
        className={`book-v2-heading book-v2-heading-${block.level} web-heading web-heading-${block.level}`}
        data-book-heading="true"
        data-block-id={block.id}
        dir={direction}
        style={blockStyle(block)}
      >
        <InlineTextV2 inline={block.inline} fallback={block.text} />
      </HeadingTag>
    )
  }

  if (block.type === 'paragraph') {
    return (
      <p
        key={block.id}
        id={block.anchor || block.id}
        className={`book-v2-paragraph ${block.semantic ? `book-v2-${block.semantic}` : ''}`}
        data-block-id={block.id}
        dir={direction}
        style={blockStyle(block)}
      >
        {block.anchors?.filter(anchor => anchor !== block.anchor).map(anchor => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}
        <InlineTextV2 inline={block.inline} fallback={block.text} />
      </p>
    )
  }

  if (block.type === 'image') {
    const width = block.widthPercent ? `${Math.max(12, Math.min(100, block.widthPercent))}%` : block.widthPx ? `${Math.max(80, block.widthPx)}px` : undefined
    return (
      <figure key={block.id} id={block.anchor || block.id} className="book-v2-figure" data-block-id={block.id} style={{ maxWidth: width }}>
        {block.url ? <img src={block.url} alt={block.caption || ''} loading="lazy" /> : <div className="book-v2-missing-image">تصویر در دسترس نیست</div>}
        {block.caption && <figcaption>{normalizeBookTextV2(block.caption)}</figcaption>}
        {block.issue && <small>{normalizeBookTextV2(block.issue)}</small>}
      </figure>
    )
  }

  if (block.type === 'table') {
    const { headers, bodyRows } = tableRows(block)
    return (
      <div key={block.id} id={block.anchor || block.id} className="final-table book-v2-table" data-block-id={block.id}>
        {block.caption && <p className="reader-table-title">{normalizeBookTextV2(block.caption)}</p>}
        <table>
          {headers.length > 0 && <thead><tr>{headers.map((cell, index) => <th key={index}>{normalizeBookTextV2(cell)}</th>)}</tr></thead>}
          <tbody>{bodyRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{normalizeBookTextV2(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul'
    return (
      <ListTag key={block.id} id={block.anchor || block.id} className={`book-v2-list ${block.ordered ? 'reader-list-ordered' : 'reader-list-bullet'}`} data-block-id={block.id} dir={direction}>
        {block.items.map(item => <li key={item.id}><InlineTextV2 inline={item.inline} fallback={item.text} /></li>)}
      </ListTag>
    )
  }

  if (block.type === 'math') {
    return <p key={block.id} id={block.anchor || block.id} className="book-v2-math" data-block-id={block.id}>{normalizeBookTextV2(block.expression)}</p>
  }

  if (block.type === 'callout') {
    return <CalloutBlockV2 key={block.id} block={block}>{renderChildren(block.blocks)}</CalloutBlockV2>
  }

  if (block.type === 'interactive') {
    return <InteractiveBlockV2 key={block.id} block={block} />
  }

  return null
}

function renderBlocks(blocks: BookBlockV2[]) {
  return blocks.map(block => renderBookBlockV2(block, renderBlocks))
}

export function BookRendererV2({ document, pages, blocks, compact = false }: { document?: BookDocumentV2; pages?: BookPageV2[]; blocks?: BookBlockV2[]; compact?: boolean }) {
  if (blocks) return <div className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'}>{renderBlocks(blocks)}</div>
  const visiblePages = pages || document?.pages || []
  return (
    <article className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'} dir={document?.direction === 'ltr' ? 'ltr' : 'rtl'}>
      {visiblePages.map((page, index) => (
        <section key={page.id} className="book-v2-page" data-page-index={page.index} data-print-page={page.printNumber ?? ''}>
          {index > 0 && <PageBreakV2 previous={visiblePages[index - 1]} next={page} />}
          {renderBlocks(page.blocks)}
        </section>
      ))}
    </article>
  )
}
