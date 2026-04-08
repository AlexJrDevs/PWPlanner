import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGridStore } from '../../stores/gridStore'
import { items, getItemById } from '../../data/items'
import type { Item, ItemCategory } from '../../data/types'

const MAX_SLOTS = 8
const CATEGORIES: (ItemCategory | 'all')[] = ['all', 'block', 'background', 'prop']

export default function ItemPalette() {
  const { selectedItemId, setSelectedItem } = useGridStore()

  const [slots, setSlots] = useState<number[]>(() => (selectedItemId ? [selectedItemId] : []))
  const [open, setOpen] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ItemCategory | 'all'>('all')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const activeItem = getItemById(selectedItemId)

  // Close palette dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // Reset when closing browser
  useEffect(() => {
    if (!browserOpen) {
      setQuery('')
      setActiveCategory('all')
    } else {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [browserOpen])

  const selectSlot = useCallback((id: number) => {
    setSelectedItem(id)
    setOpen(false)
  }, [setSelectedItem])

  const removeSlot = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSlots((prev) => {
      const next = prev.filter((s) => s !== id)
      if (id === selectedItemId && next.length > 0) setSelectedItem(next[0])
      return next
    })
  }, [selectedItemId, setSelectedItem])

  const addItem = useCallback((item: Item) => {
    setSlots((prev) => {
      const isAlreadyIn = prev.includes(item.id)
      const next = isAlreadyIn 
        ? prev 
        : prev.length >= MAX_SLOTS 
          ? [...prev.slice(1), item.id] 
          : [...prev, item.id]
      
      setSelectedItem(item.id)
      setBrowserOpen(false)
      setOpen(false)
      return next
    })
  }, [setSelectedItem])

  // Filter items by search + category
  const filteredItems = useMemo(() => {
    let result = items

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }

    if (activeCategory !== 'all') {
      result = result.filter((i) => i.category === activeCategory)
    }

    return result
  }, [query, activeCategory])

  // Dropdown position
  const dropdownStyle = () => {
    if (!triggerRef.current) return {}

    const rect = triggerRef.current.getBoundingClientRect()

    return {
      position: 'fixed' as const,
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      transform: 'translateY(-100%)',   // Moves entire dropdown up so its bottom aligns near the button
      marginBottom: '8px',
      zIndex: 60,
    }
  }

  return (
    <>
      {/* Trigger + Layer Toggle */}
      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          className={`
            flex items-center gap-1.5 h-10 pl-1 pr-2.5 rounded border-2 transition-all select-none
            ${open ? 'border-blue-400 bg-[#1c2a3a] shadow-[0_0_0_3px_rgba(96,165,250,0.2)]'
                   : 'border-blue-700/50 bg-[#242424] hover:border-blue-500 hover:bg-[#2c3440]'}
          `}
        >
          <Sprite item={activeItem} />
          <span className="text-[11px] font-mono text-blue-200 max-w-[72px] truncate leading-none hidden sm:block">
            {activeItem?.name ?? 'None'}
          </span>
          <span className={`text-[9px] text-gray-600 ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>

      </div>

      {/* Palette Dropdown */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="bg-[#141414] border border-gray-700/80 rounded-xl overflow-hidden w-[232px]"
          style={{
            ...dropdownStyle(),
            boxShadow: '0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div className="p-2.5 grid grid-cols-4 gap-1.5">
            {slots.map((id) => {
              const item = getItemById(id)
              const isActive = id === selectedItemId
              return (
                <div key={id} className="relative group/slot">
                  <button
                    onClick={() => selectSlot(id)}
                    className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden transition-all
                      ${isActive ? 'border-orange-400 bg-orange-950/40 scale-105' : 'border-gray-700 bg-[#1e1e1e] hover:border-gray-500 hover:bg-[#282828]'}`}
                  >
                    <Sprite item={item} />
                  </button>
                  {isActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />}
                  <button
                    onMouseDown={(e) => removeSlot(id, e)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-800 border border-gray-700 text-gray-500 text-[10px] flex items-center justify-center opacity-0 group-hover/slot:opacity-100 hover:bg-red-700 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )
            })}

            {slots.length < MAX_SLOTS && (
              <>
                <button
                  onClick={() => setBrowserOpen(true)}
                  className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-lg hover:border-blue-500 hover:text-blue-400 hover:bg-blue-950/20"
                >
                  +
                </button>
                {Array.from({ length: MAX_SLOTS - slots.length - 1 }).map((_, i) => (
                  <div key={`ph-${i}`} className="w-full aspect-square rounded-lg border border-gray-800/60 bg-[#111]" />
                ))}
              </>
            )}
          </div>

          {activeItem && (
            <div className="px-3 py-1.5 border-t border-gray-800 bg-[#0e0e0e] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-[10px] text-gray-400 font-mono truncate">{activeItem.name}</span>
            </div>
          )}

          <button
            onClick={() => setBrowserOpen(true)}
            className="w-full text-[11px] text-blue-500 hover:text-blue-300 py-2 border-t border-gray-800/60 bg-[#0e0e0e]"
          >
            Browse all items →
          </button>
        </div>,
        document.body
      )}

      {/* ==================== ITEM BROWSER MODAL ==================== */}
      {browserOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBrowserOpen(false)
          }}
        >
          <div className="bg-[#141414] border border-gray-700/80 rounded-2xl w-full max-w-[620px] max-h-[720px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Item Browser</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {slots.length}/{MAX_SLOTS} palette slots used
                </p>
              </div>
              <button
                onClick={() => setBrowserOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-800">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Category Tabs - BELOW Search */}
            <div className="px-6 pt-4 pb-3 border-b border-gray-800 bg-[#0f0f0f]">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all flex-shrink-0
                      ${activeCategory === cat
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-[#242424] text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-200'}
                    `}
                  >
                    {cat === 'all' ? 'All Items' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-gray-500 gap-3">
                  <span className="text-5xl opacity-50">🔍</span>
                  <p className="text-lg">No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  {filteredItems.map((item) => {
                    const inPalette = slots.includes(item.id)
                    const isSelected = item.id === selectedItemId

                    return (
                      <button
                        key={item.id}
                        onClick={() => !inPalette && addItem(item)}
                        disabled={inPalette}
                        className={`group relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all
                          ${isSelected 
                            ? 'border-orange-500 bg-orange-950/30' 
                            : inPalette 
                              ? 'border-gray-800 bg-[#1a1a1a] opacity-50 cursor-default' 
                              : 'border-gray-800 bg-[#1a1a1a] hover:border-blue-500 hover:bg-[#1f2a3a] cursor-pointer'}
                        `}
                      >
                        <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-lg bg-black/30">
                          {item.sprite ? (
                            <img
                              src={item.sprite}
                              alt={item.name}
                              className="max-w-full max-h-full object-contain"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          ) : (
                            <span className="text-3xl">❓</span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 text-center leading-tight line-clamp-2 font-mono px-1">
                          {item.name}
                        </span>

                        {inPalette && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500" />
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 text-xs">⭐</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-[#0a0a0a] flex justify-between items-center text-xs text-gray-500">
              <span>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} 
                {query && ` matching "${query}"`}
              </span>
              <button
                onClick={() => setBrowserOpen(false)}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function Sprite({ item }: { item: Item | undefined }) {
  return (
    <div className="w-8 h-8 flex items-center justify-center overflow-hidden shrink-0">
      {item?.sprite ? (
        <img
          src={item.sprite}
          alt={item.name}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span className="text-xl select-none">🪨</span>
      )}
    </div>
  )
}