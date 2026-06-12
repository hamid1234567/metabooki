import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToman(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان'
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function normalizeIranMobile(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')
  // If starts with 98, add leading 0
  if (digits.startsWith('98')) {
    digits = '0' + digits.slice(2)
  }
  // If starts with +98, strip + and add leading 0
  if (phone.startsWith('+98')) {
    digits = '0' + phone.replace(/\D/g, '').slice(2)
  }
  // Ensure 11 digits starting with 09
  if (digits.length === 10 && digits.startsWith('9')) {
    digits = '0' + digits
  }
  return digits
}

export function isValidIranMobile(phone: string): boolean {
  return /^09[0-9]{9}$/.test(normalizeIranMobile(phone))
}

export function isValidNationalId(id: string): boolean {
  if (!/^\d{10}$/.test(id)) return false
  const digits = id.split('').map(Number)
  const check = digits[9]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i)
  }
  const remainder = sum % 11
  if (remainder < 2) return check === remainder
  return check === 11 - remainder
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}