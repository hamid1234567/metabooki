import { normalizeBookTextV2, type BookBlockV2, type InteractiveBlockV2 } from '@/lib/book-document-v2'
import type { BookPageV2 } from '@/lib/book-document-v2'
import { createInteractivePayloadV3, interactiveV3Definition, isInteractiveV3Kind, normalizeInteractiveItemsV3 } from './registry'
import { INTERACTIVE_V3_MAX_ITEMS, type InteractiveV3Item, type InteractiveV3Kind, type InteractiveV3Payload } from './types'

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const attr = (name: string, value: unknown) => value === undefined || value === null || value === '' ? '' : ` ${name}="${escapeHtml(String(value))}"`

function valueOf(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function input(name: string, value: unknown, placeholder: string, extra = '') {
  return `<input ${extra} data-v3-field="${escapeHtml(name)}" value="${escapeHtml(valueOf(value))}" placeholder="${escapeHtml(placeholder)}">`
}

function text(name: string, value: unknown, placeholder: string, extra = '') {
  return `<textarea ${extra} data-v3-field="${escapeHtml(name)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(valueOf(value))}</textarea>`
}

function mediaTools(path: string, image = '') {
  return `<div class="interactive-v3-editor-media" data-v3-media="${escapeHtml(path)}">
    ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<span></span>'}
    <div contenteditable="false" class="interactive-v3-editor-media-tools">
      <button type="button" data-v3-media-action="upload" title="آپلود تصویر">↑</button>
      <button type="button" data-v3-media-action="library" title="انتخاب از تصاویر کتاب">▧</button>
      <button type="button" data-v3-media-action="ai" title="تولید با هوش مصنوعی">✦</button>
    </div>
  </div>`
}

function hotspotMedia(image = '') {
  return `<div class="interactive-v3-editor-media interactive-v3-editor-hotspot-media" data-v3-media="image">
    ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<span></span>'}
    <div contenteditable="false" class="interactive-v3-editor-media-tools">
      <button type="button" data-v3-media-action="upload" title="آپلود تصویر">↑</button>
      <button type="button" data-v3-media-action="library" title="انتخاب از تصاویر کتاب">▧</button>
      <button type="button" data-v3-media-action="ai" title="تولید با هوش مصنوعی">✦</button>
    </div>
  </div>`
}

function itemShell(collection: keyof InteractiveV3Payload, index: number, item: InteractiveV3Item, body: string, media = true) {
  return `<article class="interactive-v3-editor-item" data-v3-list="${escapeHtml(String(collection))}" data-v3-index="${index}"${attr('data-v3-item-id', item.id)}>
    <header contenteditable="false"><b>${index + 1}</b><button type="button" data-v3-item-remove="true" title="حذف آیتم">×</button></header>
    <div class="interactive-v3-editor-item-grid ${media ? 'has-media' : 'no-media'}">
      ${media ? mediaTools(`${String(collection)}.${index}.image`, item.image || '') : ''}
      <div>${body}</div>
    </div>
  </article>`
}

function limitedItems(payload: InteractiveV3Payload, collection: keyof InteractiveV3Payload, unlimited = false) {
  return normalizeInteractiveItemsV3(payload, collection, unlimited) as InteractiveV3Item[]
}

function editorItemsHtml(kind: InteractiveV3Kind, payload: InteractiveV3Payload) {
  if (kind === 'quiz') {
    const options = Array.isArray(payload.options) ? payload.options.slice(0, INTERACTIVE_V3_MAX_ITEMS) : ['', '', '', '']
    const radioName = `correct-${kind}`
    return `<div class="interactive-v3-editor-quiz">
      ${text('question', payload.question, 'متن سؤال')}
      <div class="interactive-v3-editor-options">
        ${options.map((option, index) => `<label><input type="radio" name="${radioName}" data-v3-field="correct" value="${index}" ${Number(payload.correct || 0) === index ? 'checked' : ''}><span>${index + 1}</span>${input(`options.${index}`, option, `گزینه ${index + 1}`)}</label>`).join('')}
      </div>
      ${text('explanation', payload.explanation, 'بازخورد یا توضیح پاسخ')}
    </div>`
  }

  if (kind === 'flashcard') {
    return limitedItems(payload, 'cards').map((card, index) => itemShell('cards', index, card, `${input('front', card.front, 'روی کارت')}${text('back', card.back, 'پشت کارت')}`)).join('')
  }

  if (kind === 'accordion') {
    return limitedItems(payload, 'items').map((item, index) => itemShell('items', index, item, `${input('title', item.title, 'عنوان بخش')}${text('description', item.description || item.text, 'توضیح')}`)).join('')
  }

  if (kind === 'tabs') {
    return limitedItems(payload, 'tabs').map((item, index) => itemShell('tabs', index, item, `${input('title', item.title, 'عنوان تب')}${text('description', item.description || item.text, 'توضیح')}`)).join('')
  }

  if (kind === 'timeline') {
    return limitedItems(payload, 'events').map((item, index) => itemShell('events', index, item, `${input('title', item.title, 'عنوان مرحله')}${text('description', item.description || item.text, 'توضیح مرحله')}`)).join('')
  }

  if (kind === 'gallery') {
    return limitedItems(payload, 'images').map((item, index) => itemShell('images', index, item, `${text('caption', item.caption || item.description, 'کپشن تصویر')}`)).join('')
  }

  if (kind === 'scrollytelling') {
    return limitedItems(payload, 'steps').map((item, index) => itemShell('steps', index, item, `${input('title', item.title, 'عنوان مرحله')}${text('description', item.description || item.text, 'روایت مرحله')}`)).join('')
  }

  if (kind === 'hotspot') {
    const points = limitedItems(payload, 'points')
    return `<div class="interactive-v3-editor-hotspot">
      <div class="interactive-v3-editor-hotspot-canvas" data-v3-hotspot-canvas="true">
        ${hotspotMedia(payload.image || '')}
        ${points.map((point, index) => `<article class="interactive-v3-editor-hotspot-point" data-v3-list="points" data-v3-index="${index}"${attr('data-v3-item-id', point.id)} style="--x:${escapeHtml(valueOf(point.x ?? 50))}%;--y:${escapeHtml(valueOf(point.y ?? 50))}%">
          <b contenteditable="false">${index + 1}</b>
          <div class="interactive-v3-editor-hotspot-card">
            <button type="button" data-v3-item-remove="true" title="حذف نقطه">×</button>
            ${input('title', point.title, 'عنوان نقطه')}
            ${text('text', point.text, 'توضیح نقطه')}
            <input data-v3-field="x" type="hidden" value="${escapeHtml(valueOf(point.x ?? 50))}">
            <input data-v3-field="y" type="hidden" value="${escapeHtml(valueOf(point.y ?? 50))}">
          </div>
        </article>`).join('')}
      </div>
      ${text('caption', payload.caption, 'کپشن تصویر')}
      <small class="interactive-v3-editor-hotspot-hint">برای افزودن نقطه، روی محل مورد نظر در تصویر کلیک کنید.</small>
    </div>`
  }

  return limitedItems(payload, 'authors', true).map((author, index) => itemShell('authors', index, author, `${input('name', author.name, 'نام نویسنده')}${input('role', author.role, 'نقش یا سمت')}${text('bio', author.bio, 'معرفی کوتاه')}`)).join('')
}

export function interactiveBlockToEditorHtmlV3(block: BookBlockV2) {
  if (block.type !== 'interactive') return ''
  const kind = isInteractiveV3Kind(block.kind) ? block.kind : 'quiz'
  const def = interactiveV3Definition(kind)
  const payload = { ...createInteractivePayloadV3(kind), ...(block.payload || {}), schema: 'interactive-v3' } as InteractiveV3Payload
  return `<section contenteditable="false" class="book-interactive-v3 interactive-v3-editor" data-block-id="${escapeHtml(block.id)}" data-v2-type="interactive" data-v3="true" data-kind="${escapeHtml(kind)}">
    <header class="interactive-v3-editor-head">
      <span>${escapeHtml(def.icon)}</span>
      <div>
        <small>${escapeHtml(def.label)}</small>
        ${input('title', Object.prototype.hasOwnProperty.call(payload, 'title') ? payload.title : block.title || '', 'عنوان بلوک', 'class="interactive-v3-editor-title"')}
      </div>
      <button type="button" class="interactive-v3-editor-remove" data-v3-block-remove="true" title="حذف این تعاملی">×</button>
    </header>
    <div class="interactive-v3-editor-body">${editorItemsHtml(kind, payload)}</div>
    ${def.itemCollection ? `<button type="button" class="interactive-v3-editor-add" data-v3-add-item="${escapeHtml(String(def.itemCollection))}">+ افزودن آیتم</button>` : ''}
  </section>`
}

function queryValue(root: HTMLElement, selector: string) {
  const element = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  return normalizeBookTextV2(element?.value || '')
}

function fieldValue(root: HTMLElement, name: string) {
  return queryValue(root, `[data-v3-field="${CSS.escape(name)}"]`)
}

function parseItems(root: HTMLElement, collection: keyof InteractiveV3Payload, media = true) {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-v3-list="${CSS.escape(String(collection))}"]`)).slice(0, collection === 'authors' || collection === 'points' ? undefined : INTERACTIVE_V3_MAX_ITEMS).map((item, index) => {
    const get = (name: string) => queryValue(item, `[data-v3-field="${CSS.escape(name)}"]`)
    return {
      id: item.dataset.v3ItemId || `${String(collection)}-${index + 1}`,
      title: get('title'),
      text: get('text'),
      description: get('description'),
      caption: get('caption'),
      front: get('front'),
      back: get('back'),
      name: get('name'),
      role: get('role'),
      bio: get('bio'),
      x: Number(get('x')) || 50,
      y: Number(get('y')) || 50,
      image: media ? item.querySelector<HTMLElement>('[data-v3-media] img')?.getAttribute('src') || get('image') : '',
    }
  })
}

export function interactiveBlockFromEditorElementV3(element: HTMLElement, old: InteractiveBlockV2 | undefined, page: BookPageV2): BookBlockV2 | null {
  const kind = isInteractiveV3Kind(element.dataset.kind) ? element.dataset.kind : undefined
  if (!kind) return old || null
  const fallback = createInteractivePayloadV3(kind)
  const payload: InteractiveV3Payload = { ...fallback, schema: 'interactive-v3', title: fieldValue(element, 'title') }

  if (kind === 'quiz') {
    payload.question = fieldValue(element, 'question')
    payload.explanation = fieldValue(element, 'explanation')
    payload.options = Array.from(element.querySelectorAll<HTMLInputElement>('[data-v3-field^="options."]')).map(input => normalizeBookTextV2(input.value)).slice(0, INTERACTIVE_V3_MAX_ITEMS)
    payload.correct = Number(element.querySelector<HTMLInputElement>('[data-v3-field="correct"]:checked')?.value ?? 0)
  } else if (kind === 'flashcard') payload.cards = parseItems(element, 'cards')
  else if (kind === 'accordion') payload.items = parseItems(element, 'items')
  else if (kind === 'tabs') payload.tabs = parseItems(element, 'tabs')
  else if (kind === 'timeline') payload.events = parseItems(element, 'events')
  else if (kind === 'gallery') payload.images = parseItems(element, 'images')
  else if (kind === 'scrollytelling') payload.steps = parseItems(element, 'steps')
  else if (kind === 'hotspot') {
    payload.image = element.querySelector<HTMLElement>('[data-v3-media="image"] img')?.getAttribute('src') || ''
    payload.caption = fieldValue(element, 'caption')
    payload.points = parseItems(element, 'points', false)
  } else if (kind === 'author') payload.authors = parseItems(element, 'authors')

  return {
    ...(old || {}),
    id: element.dataset.blockId || old?.id || '',
    type: 'interactive',
    kind: kind as any,
    title: payload.title,
    anchor: old?.anchor || element.dataset.blockId || old?.id,
    printNumber: page.printNumber,
    payload,
  } as BookBlockV2
}

function blankItemForCollection(collection: keyof InteractiveV3Payload, index: number): InteractiveV3Item {
  const id = `${String(collection)}-${Date.now()}-${index + 1}`
  if (collection === 'cards') return { id, front: '', back: '', image: '' }
  if (collection === 'images') return { id, image: '', caption: '' }
  if (collection === 'points') return { id, x: 50, y: 50, title: '', text: '' }
  if (collection === 'authors') return { id, name: '', role: '', bio: '', image: '' }
  return { id, title: '', description: '', image: '' }
}

export function appendInteractiveItemV3(block: BookBlockV2, collection: keyof InteractiveV3Payload): BookBlockV2 {
  if (block.type !== 'interactive') return block
  const payload = { ...(block.payload || {}) } as InteractiveV3Payload
  const current = Array.isArray(payload[collection]) ? [...payload[collection] as InteractiveV3Item[]] : []
  if (collection !== 'authors' && collection !== 'points' && current.length >= INTERACTIVE_V3_MAX_ITEMS) return block
  payload[collection] = [...current, blankItemForCollection(collection, current.length)] as any
  return { ...block, payload }
}

export function appendHotspotPointV3(block: BookBlockV2, x: number, y: number): BookBlockV2 {
  if (block.type !== 'interactive') return block
  const payload = { ...(block.payload || {}) } as InteractiveV3Payload
  const current = Array.isArray(payload.points) ? [...payload.points] : []
  payload.points = [...current, {
    id: `point-${Date.now()}-${current.length + 1}`,
    x: Math.max(0, Math.min(100, Math.round(x * 100) / 100)),
    y: Math.max(0, Math.min(100, Math.round(y * 100) / 100)),
    title: '',
    text: '',
  }]
  return { ...block, payload }
}

export function removeInteractiveItemV3(block: BookBlockV2, collection: keyof InteractiveV3Payload, index: number): BookBlockV2 {
  if (block.type !== 'interactive') return block
  const payload = { ...(block.payload || {}) } as InteractiveV3Payload
  const current = Array.isArray(payload[collection]) ? [...payload[collection] as InteractiveV3Item[]] : []
  if (current.length <= 1 || index < 0) return block
  payload[collection] = current.filter((_, itemIndex) => itemIndex !== index) as any
  return { ...block, payload }
}

export function setInteractiveItemImagesV3(block: BookBlockV2, collection: keyof InteractiveV3Payload | undefined, startIndex: number, urls: string[]): BookBlockV2 {
  if (block.type !== 'interactive' || !urls.length) return block
  const payload = { ...(block.payload || {}) } as InteractiveV3Payload
  if (!collection) {
    payload.image = urls[0]
    return { ...block, payload }
  }
  const current = Array.isArray(payload[collection]) ? [...payload[collection] as InteractiveV3Item[]] : []
  const next = current.length ? current : [blankItemForCollection(collection, 0)]
  urls.forEach((url, offset) => {
    const index = startIndex + offset
    if (collection !== 'authors' && index >= INTERACTIVE_V3_MAX_ITEMS) return
    while (next.length <= index) next.push(blankItemForCollection(collection, next.length))
    next[index] = { ...next[index], image: url }
  })
  payload[collection] = next as any
  return { ...block, payload }
}
