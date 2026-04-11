import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGridStore } from '../../stores/gridStore'
import { items, getItemById } from '../../data/items'
import type { Item, ItemCategory } from '../../data/types'

const MAX_SLOTS = 8
const CATEGORIES: (ItemCategory | 'all')[] = ['all', 'block', 'background', 'prop']
const ATLAS_SIZE = 1024

const imageCache = new Map<string, HTMLImageElement>()

function loadAtlasImage(atlas: string): Promise<HTMLImageElement> {
  if (imageCache.has(atlas)) return Promise.resolve(imageCache.get(atlas)!)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { imageCache.set(atlas, img); resolve(img) }
    img.onerror = reject
    img.src = `/assets/${atlas}`
  })
}

function SpriteCanvas({ item, displaySize }: { item: Item; displaySize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef?.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false
    loadAtlasImage(item.atlas).then((img) => {
      if (cancelled) return
      ctx.clearRect(0, 0, displaySize, displaySize)
      const flippedY = ATLAS_SIZE - item.y - item.h
      const scale = Math.min(displaySize / item.w, displaySize / item.h)
      const drawW = item.w * scale
      const drawH = item.h * scale
      const destX = (displaySize - drawW) / 2
      const destY = displaySize - drawH
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, item.x, flippedY, item.w, item.h, destX, destY, drawW, drawH)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [item, displaySize])

  return (
    <canvas
      ref={canvasRef}
      width={displaySize}
      height={displaySize}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  )
}

function Sprite({ item, size = 32 }: { item: Item | undefined; size?: number }) {
  if (!item) return <span className="text-xl select-none">🪨</span>
  return <SpriteCanvas item={item} displaySize={size} />
}

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

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

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

  const filteredItems = useMemo(() => {
    let result = items
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((i) => i.block_name.toLowerCase().includes(q))
    }
    if (activeCategory !== 'all') {
      result = result.filter((i) => i.category === activeCategory)
    }
    return result
  }, [query, activeCategory])

  // On mobile: anchor to screen edges. On desktop: anchor below trigger.
  const dropdownStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {}
    const rect = triggerRef.current.getBoundingClientRect()
    const isMobile = window.innerWidth < 640
    if (isMobile) {
      return {
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: '8px',
        right: '8px',
        zIndex: 60,
      }
    }
    return {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      transform: 'translateY(-100%)',
      marginBottom: '8px',
      width: '232px',
      zIndex: 60,
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Trigger — smaller on mobile */}
        <button
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          className={`
            flex items-center gap-1 h-10 pl-1 pr-1.5 rounded border-2 transition-all select-none
            ${open
              ? 'border-blue-400 bg-[#1c2a3a] shadow-[0_0_0_2px_rgba(96,165,250,0.2)]'
              : 'border-blue-700/50 bg-[#242424] hover:border-blue-500 hover:bg-[#2c3440]'}
          `}
        >
          <Sprite item={activeItem} size={24} />
          <span className="text-[11px] font-mono text-blue-200 max-w-[60px] truncate leading-none hidden sm:block">
            {activeItem?.block_name ?? 'None'}
          </span>
          <span className={`text-[9px] text-gray-600 ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
      </div>

      {/* Palette Dropdown */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="bg-[#141414] border border-gray-700/80 rounded-xl overflow-hidden"
          style={{
            ...dropdownStyle(),
            boxShadow: '0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div className="p-2 grid grid-cols-4 gap-1.5">
            {slots.map((id) => {
              const item = getItemById(id)
              const isActive = id === selectedItemId
              return (
                <div key={id} className="relative group/slot">
                  <button
                    onClick={() => selectSlot(id)}
                    className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden transition-all
                      ${isActive
                        ? 'border-orange-400 bg-orange-950/40 scale-105'
                        : 'border-gray-700 bg-[#1e1e1e] hover:border-gray-500 hover:bg-[#282828]'}`}
                  >
                    <Sprite item={item} size={28} />
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
              <span className="text-[10px] text-gray-400 font-mono truncate">{activeItem.block_name}</span>
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
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setBrowserOpen(false) }}
        >
          {/* Bottom sheet on mobile, centred modal on desktop */}
          <div
            className="bg-[#141414] border border-gray-700/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[620px] flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh' }}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-100">Item Browser</h2>
                <p className="text-xs text-gray-500 mt-0.5">{slots.length}/{MAX_SLOTS} slots used</p>
              </div>
              <button
                onClick={() => setBrowserOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-gray-800">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Category tabs */}
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-gray-800 bg-[#0f0f0f]">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap transition-all flex-shrink-0
                      ${activeCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#242424] text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-200'}
                    `}
                  >
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Items grid — 4 cols on mobile, 6 on desktop */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-3">
                  <span className="text-4xl opacity-50">🔍</span>
                  <p>No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
                  {filteredItems.map((item) => {
                    const inPalette = slots.includes(item.id)
                    const isSelected = item.id === selectedItemId
                    return (
                      <button
                        key={item.id}
                        onClick={() => !inPalette && addItem(item)}
                        disabled={inPalette}
                        className={`group relative flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-2xl border transition-all
                          ${isSelected
                            ? 'border-orange-500 bg-orange-950/30'
                            : inPalette
                              ? 'border-gray-800 bg-[#1a1a1a] opacity-50 cursor-default'
                              : 'border-gray-800 bg-[#1a1a1a] hover:border-blue-500 hover:bg-[#1f2a3a] cursor-pointer'}
                        `}
                      >
                        <div className="rounded-lg bg-black/30 overflow-hidden">
                          <SpriteCanvas item={item} displaySize={40} />
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 text-center leading-tight line-clamp-2 font-mono w-full">
                          {item.block_name}
                        </span>
                        {inPalette && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        {isSelected && <div className="absolute top-1.5 right-1.5 text-[10px]">⭐</div>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-gray-800 bg-[#0a0a0a] flex justify-between items-center text-xs text-gray-500">
              <span>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                {query && ` for "${query}"`}
              </span>
              <button
                onClick={() => setBrowserOpen(false)}
                className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
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