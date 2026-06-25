import { useState, type CSSProperties, type ElementType, type FormEvent, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { InlineTextV2 } from '@/components/book-content-v2/InlineTextV2'
import { PageBreakV2 } from '@/components/book-content-v2/PageBreakV2'
import { CalloutBlockV2 } from '@/components/book-content-v2/CalloutBlockV2'
import { InteractiveBlockV2 } from '@/components/book-content-v2/InteractiveBlockV2'
import { normalizeBookTextV2, textDirectionV2, type BookBlockV2, type BookDocumentV2, type BookPageV2 } from '@/lib/book-document-v2'
import './book-content-v2.css'

type TextEditableBlockV2 = Extract<BookBlockV2, { type: 'heading' | 'paragraph' }>

export type BookRendererV2Props = {
  document?: BookDocumentV2
  pages?: BookPageV2[]
  blocks?: BookBlockV2[]
  compact?: boolean
  editable?: boolean
  selectedBlockId?: string
  onSelectBlock?: (blockId: string) => void
  onTextChange?: (blockId: string, value: string) => void
}

type RenderOptionsV2 = Pick<BookRendererV2Props, 'editable' | 'selectedBlockId' | 'onSelectBlock' | 'onTextChange'>

function blockStyle(block: BookBlockV2): CSSProperties {
  const format = (block.style || {}) as Record<string, unknown>
  return {
    color: format.color ? String(format.color) : undefined,
    fontSize: format.fontSize ? String(format.fontSize) : format.fontSizePt ? `${format.fontSizePt}pt` : undefined,
    fontFamily: format.fontFamily ? String(format.fontFamily) : undefined,
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

function editableTextProps(block: TextEditableBlockV2, options: RenderOptionsV2): HTMLAttributes<HTMLElement> {
  if (!options.editable) return {}
  const selectBlock = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    options.onSelectBlock?.(block.id)
  }
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    onClick: selectBlock,
    onFocus: () => options.onSelectBlock?.(block.id),
    onInput: (event: FormEvent<HTMLElement>) => {
      options.onTextChange?.(block.id, event.currentTarget.textContent || '')
    },
  }
}

function selectedClass(block: BookBlockV2, options: RenderOptionsV2) {
  return options.selectedBlockId === block.id ? ' is-editor-selected' : ''
}

export function renderBookBlockV2(block: BookBlockV2, renderChildren: (blocks: BookBlockV2[]) => ReactNode, options: RenderOptionsV2 = {}): ReactNode {
  const direction = block.direction === 'auto' || !block.direction ? textDirectionV2('text' in block ? block.text : '') : block.direction

  if (block.type === 'heading') {
    const HeadingTag = `h${block.level}` as ElementType
    return (
      <HeadingTag
        key={block.id}
        id={block.anchor || block.id}
        className={`book-v2-heading book-v2-heading-${block.level} web-heading web-heading-${block.level}${selectedClass(block, options)}`}
        data-book-heading="true"
        data-block-id={block.id}
        dir={direction}
        style={blockStyle(block)}
        {...editableTextProps(block, options)}
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
        className={`book-v2-paragraph ${block.semantic ? `book-v2-${block.semantic}` : ''}${selectedClass(block, options)}`}
        data-block-id={block.id}
        dir={direction}
        style={blockStyle(block)}
        {...editableTextProps(block, options)}
      >
        {block.anchors?.filter(anchor => anchor !== block.anchor).map(anchor => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}
        <InlineTextV2 inline={block.inline} fallback={block.text} />
      </p>
    )
  }

  if (block.type === 'image') {
    const width = block.widthPercent ? `${Math.max(12, Math.min(100, block.widthPercent))}%` : block.widthPx ? `${Math.max(80, block.widthPx)}px` : undefined
    const wrapClass = ` wrap-${block.wrap === 'square-inline' ? 'square-inline' : 'top-bottom'}`
    const figureStyle: CSSProperties = {
      maxWidth: width,
    }
    return (
      <figure key={block.id} id={block.anchor || block.id} className={`book-v2-figure${wrapClass}${selectedClass(block, options)}`} data-block-id={block.id} style={figureStyle}>
        {block.url ? <img src={block.url} alt={block.caption || ''} loading="lazy" /> : <div className="book-v2-missing-image">ØªØµÙˆÛŒØ± Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†ÛŒØ³Øª</div>}
        {block.caption?.trim() && <figcaption><InlineTextV2 inline={block.captionInline} fallback={block.caption} /></figcaption>}
        {block.issue && <small>{normalizeBookTextV2(block.issue)}</small>}
      </figure>
    )
  }

  if (block.type === 'table') {
    const { headers, bodyRows } = tableRows(block)
    return (
      <div key={block.id} id={block.anchor || block.id} className={`final-table book-v2-table${selectedClass(block, options)}`} data-block-id={block.id}>
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
      <ListTag key={block.id} id={block.anchor || block.id} className={`book-v2-list ${block.ordered ? 'reader-list-ordered' : 'reader-list-bullet'}${selectedClass(block, options)}`} data-block-id={block.id} dir={direction} style={blockStyle(block)}>
        {block.items.map(item => <li key={item.id}><InlineTextV2 inline={item.inline} fallback={item.text} /></li>)}
      </ListTag>
    )
  }

  if (block.type === 'math') {
    return <p key={block.id} id={block.anchor || block.id} className={`book-v2-math${selectedClass(block, options)}`} data-block-id={block.id}>{normalizeBookTextV2(block.expression)}</p>
  }

  if (block.type === 'callout') {
    return <CalloutBlockV2 key={block.id} block={block}>{renderChildren(block.blocks)}</CalloutBlockV2>
  }

  if (block.type === 'interactive') {
    return <InteractiveBlockV2 key={block.id} block={block} />
  }

  return null
}

function renderBlocks(blocks: BookBlockV2[], options: RenderOptionsV2 = {}): ReactNode[] {
  return blocks.map(block => renderBookBlockV2(block, childBlocks => renderBlocks(childBlocks, options), options))
}

export function BookRendererV2({ document, pages, blocks, compact = false, editable = false, selectedBlockId, onSelectBlock, onTextChange }: BookRendererV2Props) {
  const options = { editable, selectedBlockId, onSelectBlock, onTextChange }
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const handleImageClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const image = target.closest('img')
    if (!image?.src) return
    setZoomImage({ src: image.src, alt: image.alt || '' })
    setZoomScale(1)
  }
  const zoomModal = zoomImage && (
    <div className="book-v2-image-modal" role="dialog" aria-modal="true" onClick={() => setZoomImage(null)}>
      <div className="book-v2-image-modal-card" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => setZoomImage(null)} aria-label="Close image preview" />
        <div className="book-v2-image-modal-toolbar" aria-label="Image zoom tools">
          <button type="button" onClick={() => setZoomScale(scale => Math.min(3, Number((scale + 0.25).toFixed(2))))} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setZoomScale(scale => Math.max(0.5, Number((scale - 0.25).toFixed(2))))} aria-label="Zoom out">-</button>
          <button type="button" onClick={() => setZoomScale(1)} aria-label="Reset zoom">100%</button>
        </div>
        <div className="book-v2-image-modal-stage">
          <img src={zoomImage.src} alt={zoomImage.alt} style={{ width: `${zoomScale * 100}%`, maxWidth: zoomScale > 1 ? 'none' : '100%', maxHeight: zoomScale > 1 ? 'none' : '100%' }} />
        </div>
        {zoomImage.alt && <p>{normalizeBookTextV2(zoomImage.alt)}</p>}
      </div>
    </div>
  )
  if (blocks) return <div className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'} onClick={handleImageClick}>{renderBlocks(blocks, options)}{zoomModal}</div>
  const visiblePages = pages || document?.pages || []
  return (
    <article className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'} dir={document?.direction === 'ltr' ? 'ltr' : 'rtl'} onClick={handleImageClick}>
      {visiblePages.map((page, index) => (
        <section key={page.id} className="book-v2-page" data-page-index={page.index} data-print-page={page.printNumber ?? ''}>
          {index > 0 && <PageBreakV2 previous={visiblePages[index - 1]} next={page} />}
          {renderBlocks(page.blocks, options)}
        </section>
      ))}
      {zoomModal}
    </article>
  )
}

