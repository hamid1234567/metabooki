import { Fragment, type ReactNode } from 'react'
import { normalizeBookTextV2, textDirectionV2 } from '@/lib/book-document-v2'
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

export function InlineTextV2({ inline, fallback = '' }: { inline?: BookInlineV2[]; fallback?: string }) {
  if (!inline?.length) return <>{normalizeBookTextV2(fallback)}</>
  return (
    <>
      {inline.map((span, index) => {
        const content = wrapWithMarks(<span style={spanStyle(span)}>{normalizeBookTextV2(span.text)}</span>, span)
        const withCitation = span.footnoteText || span.referenceText || span.footnoteId
          ? <CitationTooltip span={span}>{content}</CitationTooltip>
          : content
        return (
          <Fragment key={span.id || index}>
            {span.href ? <a href={span.href} target="_blank" rel="noopener noreferrer">{withCitation}</a> : withCitation}
          </Fragment>
        )
      })}
    </>
  )
}
