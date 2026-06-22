export type AiImagePurpose = 'interactive' | 'book_cover' | 'direct'
export type AiImageSize = '1024x1024' | '1024x1536' | '1536x1024'

export interface BookCoverPromptContext {
  title: string
  category?: string
  description?: string
  sample?: string
}

export const INTERACTIVE_IMAGE_STYLE_SUFFIX = 'Style: no text, clean modern editorial illustration, soft palette or soft pastel educational illustration. The final result should be polished, visually attractive, and useful for learning.'

export function imageSizeForPurpose(purpose: AiImagePurpose): AiImageSize {
  if (purpose === 'book_cover') return '1024x1536'
  return '1536x1024'
}

export function buildInteractiveImagePrompt(imagePrompt: string) {
  const prompt = imagePrompt.trim()
  return prompt ? `${trimTerminalPeriod(prompt)}. ${INTERACTIVE_IMAGE_STYLE_SUFFIX}` : ''
}

export function buildBookCoverImagePrompt(context: BookCoverPromptContext) {
  const title = context.title.trim() || 'Untitled book'
  const category = (context.category || 'General').trim()
  const description = truncateClean(context.description || '', 300)
  const sample = truncateClean(context.sample || '', 1200)
  return [
    'Create a professional, elegant book cover illustration (no text, no typography, no letters).',
    'Style: tasteful editorial book-cover art, painterly, atmospheric, single coherent scene, vertical 3:4 composition, suitable as a thumbnail.',
    `Book title (for context only, do NOT render text): "${title}".`,
    `Genre: ${category}.`,
    `Synopsis: ${description || 'No synopsis provided.'}.`,
    `Opening passages (use to infer mood, setting, themes): ${sample || 'No opening passage provided.'}.`,
    'Output: a single illustrative cover image, no borders, no captions, no watermark, no text of any language.',
  ].join('\n')
}

export function buildDirectImagePrompt(prompt: string) {
  return prompt.trim()
}

export function buildAiImagePrompt(input: { purpose: AiImagePurpose; prompt?: string; cover?: BookCoverPromptContext }) {
  if (input.purpose === 'book_cover') return buildBookCoverImagePrompt(input.cover || { title: input.prompt || 'Untitled book' })
  if (input.purpose === 'interactive') return buildInteractiveImagePrompt(input.prompt || '')
  return buildDirectImagePrompt(input.prompt || '')
}

export function isPlaceholderCoverUrl(url?: string | null) {
  const value = String(url || '').trim()
  return Boolean(value) && /placehold|placeholder/i.test(value)
}

export function buildFallbackBookCoverDataUrl(context: BookCoverPromptContext) {
  const title = context.title || 'Metabooki'
  const category = context.category || 'Book'
  const hash = hashString(`${title}|${category}|${context.description || ''}`)
  const palettes = [
    ['#13294b', '#4067d8', '#f2b66d', '#f8fafc'],
    ['#143c3c', '#54b3a7', '#f4d06f', '#f8fafc'],
    ['#2a2258', '#7b61ff', '#f2a7c6', '#f8fafc'],
    ['#3b2f2f', '#b87542', '#f7d9a6', '#fff8ef'],
    ['#1f314f', '#38a3d1', '#9be7c9', '#f5fbff'],
  ]
  const palette = palettes[hash % palettes.length]
  const angle = 35 + (hash % 70)
  const orbX = 18 + (hash % 64)
  const orbY = 14 + ((hash >> 3) % 68)
  const lineTilt = -18 + ((hash >> 5) % 36)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1365" role="img" aria-label="${escapeXml(title)} cover art">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle})">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset=".56" stop-color="${palette[1]}"/>
      <stop offset="1" stop-color="${palette[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="55%">
      <stop offset="0" stop-color="${palette[3]}" stop-opacity=".72"/>
      <stop offset=".62" stop-color="${palette[3]}" stop-opacity=".18"/>
      <stop offset="1" stop-color="${palette[3]}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1024" height="1365" fill="url(#bg)"/>
  <circle cx="${orbX * 10.24}" cy="${orbY * 13.65}" r="360" fill="url(#glow)" filter="url(#soft)"/>
  <path d="M-40 1030 C220 830 384 936 578 756 C746 600 815 386 1080 296" fill="none" stroke="${palette[3]}" stroke-opacity=".28" stroke-width="92" stroke-linecap="round"/>
  <path d="M116 288 C296 178 458 178 626 278 C758 356 850 488 910 676" fill="none" stroke="${palette[3]}" stroke-opacity=".16" stroke-width="36" stroke-linecap="round"/>
  <g transform="translate(512 714) rotate(${lineTilt})" opacity=".34">
    <rect x="-264" y="-226" width="528" height="452" rx="72" fill="${palette[3]}" opacity=".12"/>
    <path d="M-186 114 L-44 -114 L52 28 L150 -132 L238 114" fill="none" stroke="${palette[3]}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="-190" cy="-122" r="38" fill="${palette[3]}" opacity=".72"/>
  </g>
  <rect x="54" y="54" width="916" height="1257" rx="82" fill="none" stroke="${palette[3]}" stroke-opacity=".18" stroke-width="4"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

export function resolveBookCoverArt(context: BookCoverPromptContext & { coverUrl?: string | null }) {
  if (!String(context.coverUrl || '').trim()) return ''
  if (!isPlaceholderCoverUrl(context.coverUrl)) return context.coverUrl || ''
  return buildFallbackBookCoverDataUrl(context)
}

function truncateClean(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function trimTerminalPeriod(value: string) {
  return value.replace(/[.。]+$/g, '').trim()
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
