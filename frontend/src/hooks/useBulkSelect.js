import { useState, useCallback } from 'react'

export default function useBulkSelect(items) {
  const [selectedIds, setSelectedIds] = useState(new Set())

  const toggleItem = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === items.length
        ? new Set()
        : new Set(items.map(i => i.id))
    )
  }, [items])

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const hasSelection = selectedIds.size > 0
  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length

  return {
    selectedIds: [...selectedIds],
    toggleItem,
    toggleAll,
    isSelected,
    clearSelection,
    hasSelection,
    allSelected,
    someSelected,
    count: selectedIds.size,
  }
}
