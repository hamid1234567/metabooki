import { Fragment, type ReactNode } from 'react'
import { normalizeBookTextV2, textDirectionV2 } from '@/lib/book-document-v2'
import { splitBookTextForDisplay } from '@/lib/book-content'
import type { BookInlineV2 } from '@/lib/book-document-v2'

function wrapWithMarks(node: ReactNode, span: BookInlineV2) {
  let current = node
  const marks = span.marks || []
  if (marks.includes('bold')) current = <strong>{current}</strong>
  if (marks.includes('italic')) current = <em>{current}</em>
  if (marks.includes('underline')) current = <u>{current}</u>
  if (marks.includes('strike')) current = <s>{current}</s>
  if (marks.includes('code')) current = <code>{current}</code>
  if (marks.includes('superscript')) current = <sup>{current}</sup>
  if (marks.includes('subscript')) current = <sub>{current}</sub>
  return current
}

function spanStyle(span: BookInlineV2) {
  return {
    color: span.style?.color,
    fontFamily: span.style?.fontFamily,
    fontSize: span.style?.fontSize,
  }
}

export function BookPlainTextV2({ text = '' }: { text?: string }) {
  return (
    <>
      {splitBookTextForDisplay(normalizeBookTextV2(text)).map((part, index) => part.numeric
        ? <bdi key={index} className="book-number-run" dir="ltr">{part.text}</bdi>
        : <Fragment key={index}>{part.text}</Fragment>)}
    </>
  )
}

function CitationTooltip({ span, children }: { span: BookInlineV2; children: ReactNode }) {
  const text = normalizeBookTextV2(span.footnoteText || span.referenceText || '')
  if (!text) return <>{children}</>
  const direction = textDirectionV2(text)
  return (
    <span
      className={`citation-reference ${span.footnoteText ? 'footnote-reference' : ''}`}
      data-footnote-id={span.footnoteId}
      data-footnote-text={span.footnoteText ? text : undefined}
      data-reference-anchor={span.referenceAnchor}
      data-reference-text={span.referenceText ? text : undefined}
      data-tooltip-dir={direction}
      dir={direction}
      tabIndex={0}
      role="button"
    >
      {children}
      <span className="citation-tooltip" dir={direction}>{text}</span>
    </span>
  )
}

function ImageReference({ span, children }: { span: BookInlineV2; children: ReactNode }) {
  return (
    <button
      type="button"
      className="book-image-reference"
      data-image-ref-id={span.imageRefId}
      title="مشاهده تصویر مرتبط"
    >
      {children}
    </button>
  )
}

export function InlineTextV2({ inline, fallback = '' }: { inline?: BookInlineV2[]; fallback?: string }) {
  if (!inline?.length) return <BookPlainTextV2 text={fallback} />
  return (
    <>
      {inline.map((span, index) => {
        const content = wrapWithMarks(<span style={spanStyle(span)}><BookPlainTextV2 text={span.text} /></span>, span)
        const withCitation = span.footnoteText || span.referenceText || span.footnoteId
          ? <CitationTooltip span={span}>{content}</CitationTooltip>
          : content
        const withImageRef = span.imageRefId
          ? <ImageReference span={span}>{withCitation}</ImageReference>
          : withCitation
        return (
          <Fragment key={span.id || index}>
            {span.href && !span.imageRefId ? <a href={span.href} target={span.href.startsWith('#') ? undefined : '_blank'} rel={span.href.startsWith('#') ? undefined : 'noopener noreferrer'}>{withImageRef}</a> : withImageRef}
          </Fragment>
        )
      })}
    </>
  )
}
