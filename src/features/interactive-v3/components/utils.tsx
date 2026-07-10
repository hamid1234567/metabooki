import type { InteractiveV3Block, InteractiveV3Item, InteractiveV3Payload } from '../types'
import { normalizeInteractiveItemsV3 } from '../registry'

export function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function imageValue(item?: InteractiveV3Item | Record<string, unknown>) {
  const record = (item || {}) as Record<string, unknown>
  return stringValue(record.image || record.url || record.src)
}

export function titleValue(item?: InteractiveV3Item | Record<string, unknown>, fallback = '') {
  return stringValue(item?.title || item?.name || item?.front || item?.caption || fallback)
}

export function bodyValue(item?: InteractiveV3Item | Record<string, unknown>) {
  return stringValue(item?.description || item?.text || item?.bio || item?.back || item?.caption)
}

export function directionTextFromItem(item?: InteractiveV3Item | Record<string, unknown>) {
  if (!item) return ''
  return [
    item.title,
    item.name,
    item.front,
    item.caption,
    item.description,
    item.text,
    item.bio,
    item.back,
    item.role,
  ].map(stringValue).filter(Boolean).join(' ')
}

export function directionFromText(text = ''): 'rtl' | 'ltr' | undefined {
  const firstStrong = String(text).match(/[\u0600-\u06FF]|[A-Za-z]/)?.[0]
  if (!firstStrong) return undefined
  return /[\u0600-\u06FF]/.test(firstStrong) ? 'rtl' : 'ltr'
}

export function itemsFor(block: InteractiveV3Block, key: keyof InteractiveV3Payload) {
  return normalizeInteractiveItemsV3(block.payload || {}, key, block.kind === 'author') as InteractiveV3Item[]
}

export function blockTitle(block: InteractiveV3Block) {
  if (block.payload && Object.prototype.hasOwnProperty.call(block.payload, 'title')) return stringValue(block.payload.title)
  return stringValue(block.title)
}

export function MediaTextCard({ image, title, body, index }: { image?: string; title?: string; body?: string; index?: number }) {
  const hasImage = Boolean(image)
  const text = [title, body].filter(Boolean).join(' ')
  return (
    <div className={`interactive-v3-media-card interactive-v3-animated-panel ${hasImage ? 'has-media' : 'no-media'}`} dir={directionFromText(text)}>
      {hasImage && (
        <div className="interactive-v3-media">
          <img src={image} alt={title || ''} loading="lazy" />
        </div>
      )}
      <div className="interactive-v3-copy">
        {typeof index === 'number' && <span className="interactive-v3-index">{index + 1}</span>}
        {title && <h4>{title}</h4>}
        {body && <p>{body}</p>}
      </div>
    </div>
  )
}
