// Mock library for storing purchased books and reading progress in localStorage

const LIBRARY_KEY = 'metabooki_library'
const PROGRESS_KEY = 'metabooki_progress'

interface LibraryEntry {
  bookId: string
  purchasedAt: string
  price: number
}

interface ProgressEntry {
  bookId: string
  currentPage: number
  totalPages: number
  lastReadAt: string
}

function getUserLibrary(userId: string): Record<string, LibraryEntry> {
  try {
    const data = localStorage.getItem(LIBRARY_KEY)
    const all: Record<string, Record<string, LibraryEntry>> = data ? JSON.parse(data) : {}
    return all[userId] || {}
  } catch { return {} }
}

function saveUserLibrary(userId: string, library: Record<string, LibraryEntry>) {
  try {
    const data = localStorage.getItem(LIBRARY_KEY)
    const all: Record<string, Record<string, LibraryEntry>> = data ? JSON.parse(data) : {}
    all[userId] = library
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(all))
  } catch { console.warn('Failed to save library') }
}

function getUserProgress(userId: string): Record<string, ProgressEntry> {
  try {
    const data = localStorage.getItem(PROGRESS_KEY)
    const all: Record<string, Record<string, ProgressEntry>> = data ? JSON.parse(data) : {}
    return all[userId] || {}
  } catch { return {} }
}

function saveUserProgress(userId: string, progress: Record<string, ProgressEntry>) {
  try {
    const data = localStorage.getItem(PROGRESS_KEY)
    const all: Record<string, Record<string, ProgressEntry>> = data ? JSON.parse(data) : {}
    all[userId] = progress
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { console.warn('Failed to save progress') }
}

export function isInMockLibrary(userId: string, bookId: string): boolean {
  const library = getUserLibrary(userId)
  return !!library[bookId]
}

export function addToMockLibrary(userId: string, bookId: string, price: number): boolean {
  try {
    const library = getUserLibrary(userId)
    library[bookId] = { bookId, purchasedAt: new Date().toISOString(), price }
    saveUserLibrary(userId, library)
    return true
  } catch { return false }
}

export function getMockLibrary(userId: string): string[] {
  return Object.keys(getUserLibrary(userId))
}

export function getMockLibraryEntries(userId: string): LibraryEntry[] {
  return Object.values(getUserLibrary(userId))
}

// Reading progress
export function saveReadingProgress(userId: string, bookId: string, currentPage: number, totalPages: number) {
  const progress = getUserProgress(userId)
  progress[bookId] = { bookId, currentPage, totalPages, lastReadAt: new Date().toISOString() }
  saveUserProgress(userId, progress)
}

export function getReadingProgress(userId: string, bookId: string): ProgressEntry | null {
  const progress = getUserProgress(userId)
  return progress[bookId] || null
}

export function getAllReadingProgress(userId: string): Record<string, ProgressEntry> {
  return getUserProgress(userId)
}

export function getReadingPercent(userId: string, bookId: string, totalPages: number): number {
  const p = getReadingProgress(userId, bookId)
  if (!p) return 0
  return Math.round(((p.currentPage + 1) / totalPages) * 100)
}