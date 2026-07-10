import type { InteractiveBlockV2 } from '@/lib/book-document-v2'

export type InteractiveV3Kind =
  | 'quiz'
  | 'flashcard'
  | 'accordion'
  | 'tabs'
  | 'timeline'
  | 'gallery'
  | 'scrollytelling'
  | 'hotspot'
  | 'author'

export type InteractiveV3Item = {
  id: string
  title?: string
  text?: string
  description?: string
  image?: string
  caption?: string
  front?: string
  back?: string
  name?: string
  role?: string
  bio?: string
  x?: number
  y?: number
}

export type InteractiveV3Payload = {
  schema?: 'interactive-v3'
  title?: string
  question?: string
  options?: string[]
  correct?: number
  explanation?: string
  items?: InteractiveV3Item[]
  cards?: InteractiveV3Item[]
  images?: InteractiveV3Item[]
  events?: InteractiveV3Item[]
  steps?: InteractiveV3Item[]
  tabs?: InteractiveV3Item[]
  authors?: InteractiveV3Item[]
  points?: InteractiveV3Item[]
  image?: string
  imageWidthPercent?: number
  caption?: string
}

export type InteractiveV3Block = Omit<InteractiveBlockV2, 'kind' | 'payload'> & {
  kind: InteractiveV3Kind
  payload: InteractiveV3Payload
}

export type InteractiveV3Definition = {
  kind: InteractiveV3Kind
  label: string
  shortLabel: string
  icon: string
  allowsMedia: boolean
  maxItems?: number
  itemCollection?: keyof InteractiveV3Payload
}

export const INTERACTIVE_V3_MAX_ITEMS = 10
