export type ImportIssueSeverity = 'info' | 'warning' | 'error'

export interface ImportIssue {
  id: string
  severity: ImportIssueSeverity
  code: string
  message: string
  page: number
  imageId?: string
}

export interface ImportParagraph {
  id: string
  type: 'paragraph' | 'heading' | 'caption' | 'table-title' | 'image' | 'table' | 'math' | 'list'
  text?: string
  inline?: ImportInlineSpan[]
  items?: Array<{ text: string; inline?: ImportInlineSpan[] }>
  ordered?: boolean
  listLevel?: number
  listId?: string
  level?: number
  style?: string
  anchor?: string
  anchors?: string[]
  imageId?: string
  rows?: string[][]
  format?: {
    fontSizePt?: number
    color?: string
    bold?: boolean
    italic?: boolean
    alignment?: 'right' | 'left' | 'center' | 'justify'
    direction?: 'rtl' | 'ltr'
  }
  imageWidthPercent?: number
  imageWidthPx?: number
  pageBreakBefore?: boolean
}

export interface ImportInlineSpan {
  text: string
  bold?: boolean
  italic?: boolean
  superscript?: boolean
  subscript?: boolean
  href?: string
  footnoteId?: string
  footnoteText?: string
  pageBreakBefore?: boolean
  referenceText?: string
  referenceAnchor?: string
}

export interface ImportPage {
  number: number
  printNumber?: number
  blocks: ImportParagraph[]
}

export interface ImportImage {
  id: string
  name: string
  mimeType: string
  data: ArrayBuffer
  originalName?: string
  originalMimeType?: string
  conversionStatus?: 'original-web' | 'converted-local' | 'conversion-failed'
  conversionError?: string
  wordPages?: number[]
  caption?: string
  previewBlockId?: string
  contextBefore?: string
  contextAfter?: string
  isReferenced?: boolean
}

export interface ImportFootnote {
  id: string
  text: string
  inline: ImportInlineSpan[]
}

export interface TocEntry {
  id: string
  title: string
  level: number
  page: number
  included: boolean
  styleId?: string
  previewAvailable?: boolean
}

export interface WordStyleDefinition {
  id: string
  name: string
  usedCount: number
  suggestedLevel: number | null
  selectedLevel: number | null
  selectedRole: 'body' | 'heading' | 'caption' | 'table-title' | 'ignore'
  titleCandidate: boolean
  sampleText?: string
  basedOn?: string
  outlineLevel?: number
  fontSizePt?: number
  color?: string
  bold?: boolean
  italic?: boolean
  alignment?: 'right' | 'left' | 'center' | 'justify'
}

export interface ComplexityAssessment {
  score: number
  grade: 'ساده' | 'متوسط' | 'پیچیده' | 'بسیار پیچیده'
  estimatedCredits: number
  factors: Array<{ label: string; value: number; weight: number }>
}

export interface WordImportAnalysis {
  id: string
  fileName: string
  fileSize: number
  checksum: string
  createdAt: string
  totalPages: number
  documentPages?: ImportPage[]
  previewPages: ImportPage[]
  toc: TocEntry[]
  styles: WordStyleDefinition[]
  suggestedTitle?: string
  issues: ImportIssue[]
  images: ImportImage[]
  footnotes: ImportFootnote[]
  stats: {
    paragraphs: number
    headings: number
    images: number
    tables: number
    formulas: number
    footnotes: number
    words: number
  }
  complexity: ComplexityAssessment
}

export interface LocalImportProject {
  id: string
  sourceFile: File
  analysis: WordImportAnalysis
  title: string
  subtitle: string
  author: string
  authors: string[]
  translators: string[]
  category: string
  description: string
  bookTypes: Array<'تألیف' | 'ترجمه' | 'گردآوری' | 'ویرایش'>
  publisherName: string
  isbn: string
  publicationYear: string
  edition: string
  language: string
  keywords: string[]
  updatedAt: string
}

export type ImportBookMetadata = Omit<LocalImportProject, 'id' | 'sourceFile' | 'analysis' | 'updatedAt'>

export interface ImportWorkerProgress {
  type: 'progress'
  progress: number
  label: string
}

export interface ImportWorkerComplete {
  type: 'complete'
  analysis: WordImportAnalysis
}

export interface ImportWorkerFailure {
  type: 'error'
  message: string
}

export type ImportWorkerMessage = ImportWorkerProgress | ImportWorkerComplete | ImportWorkerFailure
