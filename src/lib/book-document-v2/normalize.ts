import { bookTextDirection, normalizeBookText } from '@/lib/book-content'
import type { BookDirectionV2, BookInlineV2 } from '@/lib/book-document-v2/schema'

export const BOOK_V2_ZWNJ = '\u200C'

const EXTRA_LEGACY_ZWS = /\s*(?:\u00AC|\u00AD)\s*/g

export function normalizeBookTextV2(value: unknown) {
  return normalizeBookText(String(value ?? ''))
    .replace(EXTRA_LEGACY_ZWS, BOOK_V2_ZWNJ)
    .replace(/\u200C{2,}/g, BOOK_V2_ZWNJ)
}

export function normalizeInlineV2(inline: unknown): BookInlineV2[] | undefined {
  if (!Array.isArray(inline)) return undefined
  const spans = inline
    .map((span, index) => {
      const item = (span || {}) as Record<string, unknown>
      const marks = [
        item.bold ? 'bold' : '',
        item.italic ? 'italic' : '',
        item.underline ? 'underline' : '',
        item.strike ? 'strike' : '',
        item.superscript ? 'superscript' : '',
        item.subscript ? 'subscript' : '',
        item.code ? 'code' : '',
      ].filter(Boolean) as BookInlineV2['marks']
      const style = {
        color: item.color ? String(item.color) : undefined,
        fontFamily: item.fontFamily ? String(item.fontFamily) : undefined,
        fontSize: item.fontSize ? String(item.fontSize) : undefined,
      }
      return {
        id: item.id ? String(item.id) : `inline-${index}`,
        text: normalizeBookTextV2(item.text),
        marks,
        href: item.href ? String(item.href) : undefined,
        footnoteId: item.footnoteId ? String(item.footnoteId) : undefined,
        footnoteText: item.footnoteText ? normalizeBookTextV2(item.footnoteText) : undefined,
        referenceAnchor: item.referenceAnchor ? String(item.referenceAnchor) : undefined,
        referenceText: item.referenceText ? normalizeBookTextV2(item.referenceText) : undefined,
        style,
      } satisfies BookInlineV2
    })
    .filter(span => span.text || span.footnoteId || span.referenceText)
  return spans.length ? spans : undefined
}

export function inlinePlainTextV2(inline: BookInlineV2[] | undefined, fallback = '') {
  if (!inline?.length) return normalizeBookTextV2(fallback)
  return inline.map(span => normalizeBookTextV2(span.text)).join('')
}

export function textDirectionV2(value: unknown): BookDirectionV2 {
  return bookTextDirection(normalizeBookTextV2(value))
}
