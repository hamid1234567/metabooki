import type { InteractiveBlockV2 } from '@/lib/book-document-v2'
import { isInteractiveV3Kind } from './registry'
import type { InteractiveV3Block } from './types'
import { AccordionInteractiveV3 } from './components/AccordionInteractiveV3'
import { AuthorInteractiveV3 } from './components/AuthorInteractiveV3'
import { FlashcardInteractiveV3 } from './components/FlashcardInteractiveV3'
import { GalleryInteractiveV3 } from './components/GalleryInteractiveV3'
import { HotspotInteractiveV3 } from './components/HotspotInteractiveV3'
import { QuizInteractiveV3 } from './components/QuizInteractiveV3'
import { StorytellingInteractiveV3 } from './components/StorytellingInteractiveV3'
import { TimelineInteractiveV3 } from './components/TimelineInteractiveV3'
import './interactive-v3.css'

export function InteractiveBlockV3({ block }: { block: InteractiveBlockV2 }) {
  if (!isInteractiveV3Kind(block.kind)) {
    return null
  }
  const v3Block = block as InteractiveV3Block
  if (v3Block.kind === 'quiz') return <QuizInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'flashcard') return <FlashcardInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'accordion' || v3Block.kind === 'tabs') return <AccordionInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'timeline') return <TimelineInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'gallery') return <GalleryInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'scrollytelling') return <StorytellingInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'hotspot') return <HotspotInteractiveV3 block={v3Block} />
  if (v3Block.kind === 'author') return <AuthorInteractiveV3 block={v3Block} />
  return null
}
