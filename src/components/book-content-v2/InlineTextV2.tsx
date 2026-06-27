import { Fragment, type ReactNode } from 'react'
import { normalizeBookTextV2, textDirectionV2 } from '@/lib/book-document-v2'
import { isBookLtrRunText, splitBookTextForDisplay } from '@/lib/book-content'
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

function canJoinLtrInlineRun(span: BookInlineV2) {
  if (span.href || span.imageRefId || span.footnoteId || span.footnoteText || span.referenceText || span.referenceAnchor) return false
  return isBookLtrRunText(span.text || '')
}

function isInlineWhitespace(span: BookInlineV2) {
  return !span.href
    && !span.imageRefId
    && !span.footnoteId
    && !span.footnoteText
    && !span.referenceText
    && !span.referenceAnchor
    && !span.marks?.length
    && /^\s+$/.test(normalizeBookTextV2(span.text || ''))
}

function nextNonSpaceInline(inline: BookInlineV2[], startIndex: number) {
  return inline.slice(startIndex).find(span => !isInlineWhitespace(span))
}

function groupInlineRuns(inline: BookInlineV2[]) {
  const groups: Array<{ ltr: boolean; spans: BookInlineV2[] }> = []
  let current: BookInlineV2[] = []

  const flush = (ltr = false) => {
    if (!current.length) return
    groups.push({ ltr, spans: current })
    current = []
  }

  inline.forEach((span, index) => {
    const joins = canJoinLtrInlineRun(span)
    const nextNonSpace = nextNonSpaceInline(inline, index + 1)
    const joinsAsSpace = isInlineWhitespace(span) && current.length && Boolean(nextNonSpace && canJoinLtrInlineRun(nextNonSpace))
    if (joins || joinsAsSpace) {
      current.push(span)
      return
    }
    flush(true)
    groups.push({ ltr: false, spans: [span] })
  })
  flush(true)
  return groups
}

function SpanText({ span, isolated = false }: { span: BookInlineV2; isolated?: boolean }) {
  return isolated ? <>{normalizeBookTextV2(span.text)}</> : <BookPlainTextV2 text={span.text} />
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
      {groupInlineRuns(inline).map((group, groupIndex) => {
        const nodes = group.spans.map((span, index) => {
          const content = wrapWithMarks(<span style={spanStyle(span)}><SpanText span={span} isolated={group.ltr} /></span>, span)
          const withCitation = span.footnoteText || span.referenceText || span.footnoteId
            ? <CitationTooltip span={span}>{content}</CitationTooltip>
            : content
          const withImageRef = span.imageRefId
            ? <ImageReference span={span}>{withCitation}</ImageReference>
            : withCitation
          return (
            <Fragment key={span.id || `${groupIndex}-${index}`}>
              {span.href && !span.imageRefId ? <a href={span.href} target={span.href.startsWith('#') ? undefined : '_blank'} rel={span.href.startsWith('#') ? undefined : 'noopener noreferrer'}>{withImageRef}</a> : withImageRef}
            </Fragment>
          )
        })
        return group.ltr
          ? <bdi key={`ltr-${groupIndex}`} className="book-ltr-inline-run" dir="ltr">{nodes}</bdi>
          : <Fragment key={`inline-${groupIndex}`}>{nodes}</Fragment>
      })}
    </>
  )
}
