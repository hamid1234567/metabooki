import { useState, type CSSProperties, type ElementType, type FormEvent, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { BookPlainTextV2, InlineTextV2 } from '@/components/book-content-v2/InlineTextV2'
import { PageBreakV2 } from '@/components/book-content-v2/PageBreakV2'
import { CalloutBlockV2 } from '@/components/book-content-v2/CalloutBlockV2'
import { InteractiveBlockV3 } from '@/features/interactive-v3/InteractiveBlockV3'
import { cleanImageCaptionV2, textDirectionV2, type BookBlockV2, type BookDocumentV2, type BookPageV2 } from '@/lib/book-document-v2'
import { shortenReferencePreviewV2 } from '@/lib/book-references'
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
  onInternalLink?: (targetId: string) => void
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
    const cleanCaption = cleanImageCaptionV2(block.caption)
    const width = block.widthPercent ? `${Math.max(12, Math.min(100, block.widthPercent))}%` : block.widthPx ? `${Math.max(80, block.widthPx)}px` : undefined
    const figureStyle: CSSProperties = {
      '--book-v2-image-width': width,
    } as CSSProperties
    return (
      <figure key={block.id} id={block.anchor || block.id} className={`book-v2-figure${selectedClass(block, options)}`} data-block-id={block.id} style={figureStyle}>
        {block.url ? <img src={block.url} alt={cleanCaption} loading="lazy" /> : <div className="book-v2-missing-image">تصویر در دسترس نیست</div>}
        {cleanCaption && <figcaption><InlineTextV2 inline={block.captionInline} fallback={cleanCaption} /></figcaption>}
        {block.issue && <small><BookPlainTextV2 text={block.issue} /></small>}
      </figure>
    )
  }

  if (block.type === 'table') {
    const { headers, bodyRows } = tableRows(block)
    return (
      <div key={block.id} id={block.anchor || block.id} className={`final-table book-v2-table${selectedClass(block, options)}`} data-block-id={block.id}>
        {block.caption && <p className="reader-table-title"><BookPlainTextV2 text={block.caption} /></p>}
        <table>
          {headers.length > 0 && <thead><tr>{headers.map((cell, index) => <th key={index}><BookPlainTextV2 text={cell} /></th>)}</tr></thead>}
          <tbody>{bodyRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><BookPlainTextV2 text={cell} /></td>)}</tr>)}</tbody>
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
    return <p key={block.id} id={block.anchor || block.id} className={`book-v2-math${selectedClass(block, options)}`} data-block-id={block.id}><BookPlainTextV2 text={block.expression} /></p>
  }

  if (block.type === 'callout') {
    return <CalloutBlockV2 key={block.id} block={block}>{renderChildren(block.blocks)}</CalloutBlockV2>
  }

  if (block.type === 'interactive') {
    return <InteractiveBlockV3 key={block.id} block={block} />
  }

  return null
}

function renderBlocks(blocks: BookBlockV2[], options: RenderOptionsV2 = {}): ReactNode[] {
  return blocks.map(block => renderBookBlockV2(block, childBlocks => renderBlocks(childBlocks, options), options))
}

function blockHasVisibleContentV2(block: BookBlockV2): boolean {
  if (block.type === 'paragraph' || block.type === 'heading') return Boolean((block.text || '').trim())
  if (block.type === 'list') return block.items.some(item => Boolean((item.text || '').trim()))
  if (block.type === 'image') return Boolean(block.url || cleanImageCaptionV2(block.caption))
  if (block.type === 'table') return Boolean(block.caption || block.headers?.some(Boolean) || block.rows.some(row => row.some(cell => Boolean(String(cell || '').trim()))))
  if (block.type === 'math') return Boolean((block.expression || '').trim())
  if (block.type === 'callout') return Boolean((block.title || '').trim() || block.blocks.some(blockHasVisibleContentV2))
  if (block.type === 'interactive') return Boolean((block.title || '').trim() || JSON.stringify(block.payload || {}) !== '{}')
  return false
}

function pageHasVisibleContentV2(page: BookPageV2) {
  if ((page as any).pageEnginePlaceholder) return true
  return page.blocks.some(blockHasVisibleContentV2)
}

function PageEngineLoadingV2() {
  return (
    <div className="book-v2-page-loading" aria-label="در حال بارگذاری صفحه">
      <span>در حال بارگذاری صفحه...</span>
    </div>
  )
}

function EmptyBookPageV2() {
  return (
    <div className="book-v2-empty-page" aria-label="صفحه خالی">
      <span>این صفحه عمداً خالی گذاشته شده است.</span>
    </div>
  )
}

function findBookBlockV2(blocks: BookBlockV2[], blockId?: string): BookBlockV2 | null {
  if (!blockId) return null
  for (const block of blocks) {
    if (block.id === blockId) return block
    if (block.type === 'callout') {
      const nested = findBookBlockV2(block.blocks, blockId)
      if (nested) return nested
    }
  }
  return null
}

function findImageBlockByRefV2(blocks: BookBlockV2[], refId?: string): Extract<BookBlockV2, { type: 'image' }> | null {
  if (!refId) return null
  const normalized = decodeURIComponent(String(refId).replace(/^#/, ''))
  for (const block of blocks) {
    if (block.type === 'image') {
      const refs = [block.id, block.anchor, block.imageId, ...(block.anchors || [])].filter(Boolean).map(String)
      if (refs.includes(normalized)) return block
    }
    if (block.type === 'callout') {
      const nested = findImageBlockByRefV2(block.blocks, normalized)
      if (nested) return nested
    }
  }
  return null
}

function clampedInlinePreviewPositionV2(root: HTMLElement, target: HTMLElement, estimatedWidth: number, estimatedHeight: number) {
  const rootRect = root.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const margin = 12
  const minLeft = Math.max(margin, rootRect.left + margin)
  const maxLeft = Math.max(minLeft, Math.min(window.innerWidth - estimatedWidth - margin, rootRect.right - estimatedWidth - margin))
  const preferredLeft = targetRect.left + (targetRect.width / 2) - (estimatedWidth / 2)
  const belowTop = targetRect.bottom + 10
  const aboveTop = targetRect.top - estimatedHeight - 10
  const maxTop = Math.min(window.innerHeight - estimatedHeight - margin, rootRect.bottom - estimatedHeight - margin)
  const useAbove = belowTop > maxTop && aboveTop >= Math.max(margin, rootRect.top + margin)
  const preferredTop = useAbove ? aboveTop : belowTop

  return {
    left: Math.min(maxLeft, Math.max(minLeft, preferredLeft)),
    top: Math.min(maxTop, Math.max(Math.max(margin, rootRect.top + margin), preferredTop)),
  }
}

export function BookRendererV2({ document, pages, blocks, compact = false, editable = false, selectedBlockId, onSelectBlock, onTextChange, onInternalLink }: BookRendererV2Props) {
  const options = { editable, selectedBlockId, onSelectBlock, onTextChange }
  const visiblePages = pages || document?.pages || []
  const rootBlocks = blocks || visiblePages.flatMap(page => page.blocks)
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string; initialScale: number; captionInline?: Extract<BookBlockV2, { type: 'image' }>['captionInline'] } | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomCaptionVisible, setZoomCaptionVisible] = useState(true)
  const [zoomCaptionExiting, setZoomCaptionExiting] = useState(false)
  const [imageRefPreview, setImageRefPreview] = useState<{ block: Extract<BookBlockV2, { type: 'image' }>; x: number; y: number } | null>(null)
  const [inlineRefPreview, setInlineRefPreview] = useState<{ text: string; direction: 'rtl' | 'ltr'; x: number; y: number } | null>(null)
  const openZoomForImageBlock = (imageBlock: Extract<BookBlockV2, { type: 'image' }>, src = imageBlock.url) => {
    if (!src) return
    const caption = cleanImageCaptionV2(imageBlock.caption)
    const initialScale = imageBlock.widthPercent
      ? Math.max(0.12, Math.min(1, imageBlock.widthPercent / 100))
      : 1
    setZoomImage({ src, alt: caption, initialScale, captionInline: imageBlock.captionInline })
    setZoomScale(initialScale)
    setZoomCaptionVisible(true)
    setZoomCaptionExiting(false)
  }
  const findImageReferenceBlock = (refId?: string) => {
    const block = findImageBlockByRefV2(rootBlocks, refId)
    if (block) return block
    const normalized = decodeURIComponent(String(refId || '').replace(/^#/, ''))
    const asset = document?.assets.find(asset => [asset.id, asset.blockId].filter(Boolean).map(String).includes(normalized))
    if (!asset?.url) return null
    return {
      id: asset.blockId || asset.id,
      type: 'image' as const,
      url: asset.url,
      caption: asset.caption || '',
      imageId: asset.id,
      printNumber: asset.printNumber,
      status: asset.status,
      issue: asset.issue,
    }
  }
  const handleImageClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const imageReference = target.closest<HTMLElement>('[data-image-ref-id]')
    if (imageReference?.dataset.imageRefId) {
      const imageBlock = findImageReferenceBlock(imageReference.dataset.imageRefId)
      if (imageBlock) {
        event.preventDefault()
        openZoomForImageBlock(imageBlock)
        return
      }
    }
    const localLink = target.closest<HTMLAnchorElement>('a[href^="#"]')
    if (localLink) {
      const href = localLink.getAttribute('href') || ''
      const imageBlock = findImageReferenceBlock(href)
      if (imageBlock) {
        event.preventDefault()
        openZoomForImageBlock(imageBlock)
        return
      }
      const targetId = decodeURIComponent(href.replace(/^#/, ''))
      if (targetId) {
        event.preventDefault()
        const localTarget = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#${CSS.escape(targetId)}, [data-reader-anchor="${CSS.escape(targetId)}"]`)
        if (localTarget) localTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else onInternalLink?.(targetId)
        return
      }
    }
    const image = target.closest('img')
    if (!image?.src) return
    const figure = image.closest<HTMLElement>('figure[data-block-id]')
    const imageBlock = findBookBlockV2(rootBlocks, figure?.dataset.blockId)
    if (imageBlock?.type === 'image') openZoomForImageBlock(imageBlock, image.src)
    else {
      setZoomImage({ src: image.src, alt: image.alt || '', initialScale: 1 })
      setZoomScale(1)
      setZoomCaptionVisible(true)
      setZoomCaptionExiting(false)
    }
  }
  const handleImageReferenceMove = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const refTarget = target.closest<HTMLElement>('[data-image-ref-id], a[href^="#"]')
    const refId = refTarget?.dataset.imageRefId || (refTarget instanceof HTMLAnchorElement ? refTarget.getAttribute('href') || '' : '')
    const imageBlock = findImageReferenceBlock(refId || '')
    if (imageBlock?.url) {
      if (inlineRefPreview) setInlineRefPreview(null)
      setImageRefPreview({ block: imageBlock, x: event.clientX, y: event.clientY })
      return
    }
    if (imageRefPreview) setImageRefPreview(null)

    const tooltipTarget = target.closest<HTMLElement>('[data-reference-tooltip]')
    const tooltip = tooltipTarget?.dataset.referenceTooltip?.trim()
    if (!tooltipTarget || !tooltip) {
      if (inlineRefPreview) setInlineRefPreview(null)
      return
    }
    const { left, top } = clampedInlinePreviewPositionV2(event.currentTarget as HTMLElement, tooltipTarget, 320, 92)
    setInlineRefPreview({
      text: tooltip,
      direction: tooltipTarget.dataset.tooltipDir === 'ltr' || textDirectionV2(tooltip) === 'ltr' ? 'ltr' : 'rtl',
      x: left,
      y: top,
    })
  }
  const handleImageReferenceOut = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-image-ref-id], a[href^="#"], [data-reference-tooltip]')) {
      if (imageRefPreview) setImageRefPreview(null)
      if (inlineRefPreview) setInlineRefPreview(null)
    }
  }
  const toggleZoomCaption = () => {
    if (zoomCaptionVisible && !zoomCaptionExiting) {
      setZoomCaptionExiting(true)
      window.setTimeout(() => {
        setZoomCaptionVisible(false)
        setZoomCaptionExiting(false)
      }, 320)
      return
    }
    setZoomCaptionVisible(true)
    setZoomCaptionExiting(false)
  }
  const showZoomCaption = Boolean(zoomImage?.alt && (zoomCaptionVisible || zoomCaptionExiting))
  const zoomModal = zoomImage && (
    <div className="book-v2-image-modal" role="dialog" aria-modal="true" onClick={() => setZoomImage(null)}>
      <div className="book-v2-image-modal-card" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => setZoomImage(null)} aria-label="Close image preview" />
        <div className="book-v2-image-modal-toolbar" aria-label="Image zoom tools">
          <button type="button" onClick={() => setZoomScale(scale => Math.min(3, Number((scale + 0.25).toFixed(2))))} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setZoomScale(scale => Math.max(0.12, Number((scale - 0.25).toFixed(2))))} aria-label="Zoom out">-</button>
          <button type="button" onClick={() => setZoomScale(zoomImage.initialScale)} aria-label="Reset zoom">{Math.round(zoomScale * 100)}%</button>
          {zoomImage.alt && <button type="button" onClick={toggleZoomCaption} aria-label={zoomCaptionVisible && !zoomCaptionExiting ? 'Hide caption' : 'Show caption'}>{zoomCaptionVisible && !zoomCaptionExiting ? 'CC' : 'CC+'}</button>}
        </div>
        <div className={`book-v2-image-modal-stage ${showZoomCaption ? 'has-caption' : ''} ${zoomCaptionExiting ? 'is-caption-exiting' : ''}`}>
          <div className="book-v2-image-modal-scroll">
            <img src={zoomImage.src} alt={zoomImage.alt} style={{ width: `${zoomScale * 100}%`, maxWidth: zoomScale > 1 ? 'none' : '100%', maxHeight: zoomScale > 1 ? 'none' : '100%' }} />
          </div>
          {showZoomCaption && (
            <div className={`book-v2-image-modal-caption ${zoomCaptionExiting ? 'is-exiting' : ''}`} dir={textDirectionV2(zoomImage.alt)}>
              <InlineTextV2 inline={zoomImage.captionInline} fallback={zoomImage.alt} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
  const hoverPreview = imageRefPreview && (
    <div
      className="book-v2-image-ref-preview"
      style={{ left: Math.min(window.innerWidth - 220, imageRefPreview.x + 14), top: Math.min(window.innerHeight - 170, imageRefPreview.y + 14) }}
      dir={textDirectionV2(cleanImageCaptionV2(imageRefPreview.block.caption))}
    >
      <img src={imageRefPreview.block.url} alt={cleanImageCaptionV2(imageRefPreview.block.caption)} />
      {cleanImageCaptionV2(imageRefPreview.block.caption) && <span>{shortenReferencePreviewV2(cleanImageCaptionV2(imageRefPreview.block.caption), 20)}</span>}
    </div>
  )
  const inlinePreview = inlineRefPreview && (
    <div
      className="book-v2-inline-ref-preview"
      style={{ left: inlineRefPreview.x, top: inlineRefPreview.y }}
      dir={inlineRefPreview.direction}
    >
      {inlineRefPreview.text}
    </div>
  )
  if (blocks) return <div className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'} onClick={handleImageClick} onMouseMove={handleImageReferenceMove} onMouseOut={handleImageReferenceOut}>{renderBlocks(blocks, options)}{hoverPreview}{inlinePreview}{zoomModal}</div>
  return (
    <article className={compact ? 'book-v2-renderer compact' : 'book-v2-renderer'} dir={document?.direction === 'ltr' ? 'ltr' : 'rtl'} onClick={handleImageClick} onMouseMove={handleImageReferenceMove} onMouseOut={handleImageReferenceOut}>
      {visiblePages.map((page, index) => (
        <section key={page.id} className="book-v2-page" data-page-index={page.index} data-print-page={page.printNumber ?? ''}>
          {index > 0 && <PageBreakV2 previous={visiblePages[index - 1]} next={page} />}
          {(page as any).pageEnginePlaceholder ? <PageEngineLoadingV2 /> : pageHasVisibleContentV2(page) ? renderBlocks(page.blocks, options) : <EmptyBookPageV2 />}
        </section>
      ))}
      {hoverPreview}
      {inlinePreview}
      {zoomModal}
    </article>
  )
}

