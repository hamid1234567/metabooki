import { normalizeBookTextV2, textDirectionV2 } from '@/lib/book-document-v2/normalize'
import type { BookInlineV2 } from '@/lib/book-document-v2/schema'

export type BookReferenceKindV2 = 'external' | 'heading' | 'image' | 'footnote' | 'reference' | 'none'

export const BOOK_REFERENCE_CLASS_V2 = 'book-inline-reference'
export const BOOK_REFERENCE_IMAGE_CLASS_V2 = 'book-image-reference'
export const BOOK_REFERENCE_CITATION_CLASS_V2 = 'citation-reference'

export function referenceKindFromInlineV2(span: Pick<BookInlineV2, 'href' | 'imageRefId' | 'footnoteId' | 'footnoteText' | 'referenceText' | 'referenceAnchor'>): BookReferenceKindV2 {
  if (span.imageRefId) return 'image'
  if (span.footnoteId || span.footnoteText) return 'footnote'
  if (span.referenceText || span.referenceAnchor) return 'reference'
  if (span.href) return String(span.href).startsWith('#') ? 'heading' : 'external'
  return 'none'
}

export function referenceKindFromElementV2(element: HTMLElement | null | undefined): BookReferenceKindV2 {
  if (!element) return 'none'
  if (element.dataset.imageRefId) return 'image'
  if (element.dataset.footnoteId || element.dataset.footnoteText) return 'footnote'
  if (element.dataset.referenceText || element.dataset.referenceAnchor) return 'reference'
  if (element instanceof HTMLAnchorElement && element.getAttribute('href')) {
    return element.getAttribute('href')?.startsWith('#') ? 'heading' : 'external'
  }
  const link = element.closest('a[href]')
  if (link instanceof HTMLAnchorElement) return link.getAttribute('href')?.startsWith('#') ? 'heading' : 'external'
  return 'none'
}

export function inlineHasReferenceV2(span: BookInlineV2) {
  return referenceKindFromInlineV2(span) !== 'none'
}

export function inlineReferenceTargetV2(span: BookInlineV2) {
  return span.imageRefId
    || span.footnoteText
    || span.footnoteId
    || span.referenceText
    || span.referenceAnchor
    || span.href
    || ''
}

export function referenceDisplayLabelV2(kind: BookReferenceKindV2) {
  if (kind === 'external') return 'لینک خارجی'
  if (kind === 'heading') return 'لینک به سرفصل'
  if (kind === 'image') return 'لینک تصویر'
  if (kind === 'footnote') return 'پاورقی'
  if (kind === 'reference') return 'رفرنس'
  return 'بدون ارجاع'
}

export function shortenReferencePreviewV2(value = '', maxLength = 20) {
  const text = normalizeBookTextV2(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

export function referenceTooltipTextV2(span: BookInlineV2) {
  return normalizeBookTextV2(span.footnoteText || span.referenceText || '')
}

export function referenceTooltipDirectionV2(text = '') {
  return textDirectionV2(text)
}

export function referenceHoverTextV2(span: BookInlineV2) {
  const kind = referenceKindFromInlineV2(span)
  const target = normalizeBookTextV2(inlineReferenceTargetV2(span))
  if (kind === 'external') return target
  if (kind === 'heading') return `رفتن به سرفصل ${shortenReferencePreviewV2(target.replace(/^#/, ''), 48)}`
  return ''
}

export function referenceHtmlDataAttributesV2(span: BookInlineV2) {
  const kind = referenceKindFromInlineV2(span)
  const tooltip = referenceTooltipTextV2(span)
  const hoverText = referenceHoverTextV2(span)
  const direction = referenceTooltipDirectionV2(tooltip || hoverText || span.text)
  return {
    'data-reference-kind': kind === 'none' ? undefined : kind,
    'data-image-ref-id': span.imageRefId || undefined,
    'data-footnote-id': span.footnoteId || undefined,
    'data-footnote-text': span.footnoteText ? tooltip : undefined,
    'data-reference-anchor': span.referenceAnchor || undefined,
    'data-reference-text': span.referenceText ? tooltip : undefined,
    'data-reference-tooltip': hoverText || undefined,
    'data-tooltip-dir': direction,
  }
}

export function referenceClassNameV2(span: BookInlineV2, extra = '') {
  const kind = referenceKindFromInlineV2(span)
  return [
    kind !== 'none' ? BOOK_REFERENCE_CLASS_V2 : '',
    kind === 'image' ? BOOK_REFERENCE_IMAGE_CLASS_V2 : '',
    kind === 'external' ? 'book-external-reference' : '',
    kind === 'heading' ? 'book-heading-reference' : '',
    kind === 'footnote' || kind === 'reference' ? BOOK_REFERENCE_CITATION_CLASS_V2 : '',
    kind === 'footnote' ? 'footnote-reference' : '',
    extra,
  ].filter(Boolean).join(' ')
}
