import { useCallback, useEffect, useRef, useState } from 'react'
import { BOOK_LIST_MAX_ROWS } from '@/lib/book-listing'

function countGridColumns(element: HTMLElement | null) {
  if (!element) return 1
  const columns = window.getComputedStyle(element).gridTemplateColumns
  if (!columns || columns === 'none') return 1
  return Math.max(1, columns.split(' ').filter(Boolean).length)
}

export function useGridRowsPageSize(maxRows = BOOK_LIST_MAX_ROWS) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [columns, setColumns] = useState(1)

  const measure = useCallback(() => {
    setColumns(current => {
      const next = countGridColumns(gridRef.current)
      return current === next ? current : next
    })
  }, [])

  useEffect(() => {
    measure()
    const element = gridRef.current
    if (!element) return
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    globalThis.addEventListener('resize', measure)
    return () => globalThis.removeEventListener('resize', measure)
  }, [measure])

  return {
    gridRef,
    columns,
    pageSize: Math.max(1, columns * maxRows),
    maxRows,
  }
}
