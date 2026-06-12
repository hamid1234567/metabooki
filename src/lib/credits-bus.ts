// Event bus for real-time credit updates across components
type CreditListener = (newBalance: number) => void

const listeners: Set<CreditListener> = new Set()

export const creditsBus = {
  subscribe(fn: CreditListener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  emit(newBalance: number) {
    listeners.forEach(fn => fn(newBalance))
  }
}