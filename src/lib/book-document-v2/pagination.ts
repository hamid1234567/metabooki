import { printPageBoundaryLabels, printPageLabel, type PrintPageValue } from '@/lib/book-content'

export function printPageLabelV2(value: PrintPageValue) {
  return printPageLabel(value)
}

export function pageBoundaryLabelsV2(previous?: { printNumber?: PrintPageValue }, next?: { printNumber?: PrintPageValue }) {
  return printPageBoundaryLabels(previous, next)
}

export function hasPrintPageLabelV2(value: PrintPageValue) {
  return Boolean(printPageLabelV2(value).trim())
}
