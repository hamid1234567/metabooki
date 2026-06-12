// Persistent mock user credits store in localStorage
const CREDITS_KEY = 'metabooki_credits'

export function getStoredCredits(userId: string, defaultCredits: number): number {
  try {
    const data = localStorage.getItem(CREDITS_KEY)
    const all: Record<string, number> = data ? JSON.parse(data) : {}
    return all[userId] ?? defaultCredits
  } catch {
    return defaultCredits
  }
}

export function saveCredits(userId: string, credits: number) {
  try {
    const data = localStorage.getItem(CREDITS_KEY)
    const all: Record<string, number> = data ? JSON.parse(data) : {}
    all[userId] = credits
    localStorage.setItem(CREDITS_KEY, JSON.stringify(all))
  } catch {
    console.warn('Failed to save credits')
  }
}