import { useState, useEffect, useRef, useCallback } from 'react'
import type { Item, ItemCategory } from '../../data/items'

export type BlockItem = Item

interface BlockPaletteProps {
  isOpen: boolean
  onClose: () => void
  items: BlockItem[]                    // All available items to choose from
  slotIndex: number
  currentPallet: BlockItem[]            // Current blocks in this slot's pallet
  onUpdatePallet: (slotIndex: number, newPallet: BlockItem[]) => void
}

export default function BlockPalette({
  isOpen,
  onClose,
  items,
  slotIndex,
  currentPallet,
  onUpdatePallet,
}: BlockPaletteProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ItemCategory | 'All'>('All')
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const categories: (ItemCategory | 'All')[] = [
    'All',
    ...Array.from(new Set(items.map(i => i.category)))
  ]

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
      setSearch('')
      setActiveCategory('All')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const onBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleSelect = (selectedItem: BlockItem) => {
    let newPallet = [...currentPallet]

    // Check if item already exists in pallet
    const existingIndex = newPallet.findIndex(item => item.id === selectedItem.id)

    if (existingIndex !== -1) {
      // Move existing item to front (make it active)
      const [existing] = newPallet.splice(existingIndex, 1)
      newPallet.unshift(existing)
    } else {
      // Add new item to front (make it active)
      newPallet.unshift(selectedItem)
    }

    onUpdatePallet(slotIndex, newPallet)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onBackdropClick}
    >
      <div className="bg-[#0d0d0d] border border-gray-600 rounded-lg p-4 w-[860px] max-w-[95vw] max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between mb-2">
          <h2 className="text-white text-xl">Select Item</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Search */}
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="mb-2 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
        />

        {/* Categories */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-1 overflow-y-auto flex-1 p-1"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}
        >
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="aspect-square bg-gray-900 border border-gray-700 hover:border-blue-500 rounded overflow-hidden transition-all active:scale-95"
              title={item.name}
            >
              <img
                src={item.sprite}
                alt={item.name}
                className="w-full h-full object-contain p-1"
              />
            </button>
          ))}
        </div>

        {/* Footer - hovered name */}
        <div className="mt-2 text-xs text-gray-400 min-h-[1.25em]">
          {hoveredId !== null && items.find(i => i.id === hoveredId)?.name}
        </div>

      </div>
    </div>
  )
}