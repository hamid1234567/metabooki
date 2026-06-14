export type ImportIssueSeverity = 'info' | 'warning' | 'error'

export interface ImportIssue {
  id: string
  severity: ImportIssueSeverity
  code: string
  message: string
  page: number
}

export interface ImportParagraph {
  id: string
  type: 'paragraph' | 'heading' | 'image' | 'table' | 'math'
  text?: string
  level?: number
  style?: string
  imageId?: string
  rows?: string[][]
}

export interface ImportPage {
  number: number
  blocks: ImportParagraph[]
}

export interface ImportImage {
  id: string
  name: string
  mimeType: string
  data: ArrayBuffer
}

export interface TocEntry {
  id: string
  title: string
  level: number
  page: number
  included: boolean
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
  previewPages: ImportPage[]
  toc: TocEntry[]
  issues: ImportIssue[]
  images: ImportImage[]
  stats: {
    paragraphs: number
    headings: number
    images: number
    tables: number
    formulas: number
    words: number
  }
  complexity: ComplexityAssessment
}

export interface LocalImportProject {
  id: string
  sourceFile: File
  analysis: WordImportAnalysis
  title: string
  author: string
  category: string
  description: string
  updatedAt: string
}

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
