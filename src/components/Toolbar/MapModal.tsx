import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGridStore, WORLD_COLS, WORLD_ROWS } from '../../stores/gridStore'
import { getItemById } from '../../data/items'
import type { Item } from '../../data/types'

const TILE_SIZE = 32
const ATLAS_SIZE = 1024

// Shared image cache
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

/**
 * Draws exactly the item's source rect — no neighbouring sprite bleed.
 * Scaled to fit `displaySize`, centred horizontally, bottom-aligned.
 */
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
      const destY = displaySize - drawH   // bottom-aligned

      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, item.x, flippedY, item.w, item.h, destX, destY, drawW, drawH)
    }).catch(() => { /* missing atlas */ })

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

interface Props {
  onClose: () => void
}

export default function MapModal({ onClose }: Props) {
  const { grid } = useGridStore()

  const counts = new Map<number, number>()
  for (const row of grid) {
    for (const cell of row) {
      if (cell.fg !== 0) counts.set(cell.fg, (counts.get(cell.fg) ?? 0) + 1)
      if (cell.bg !== 0) counts.set(cell.bg, (counts.get(cell.bg) ?? 0) + 1)
    }
  }

  const entries = [...counts.entries()]
    .map(([id, count]) => ({ id, count, item: getItemById(id) }))
    .filter((e): e is { id: number; count: number; item: NonNullable<ReturnType<typeof getItemById>> } => !!e.item)
    .sort((a, b) => b.count - a.count)

  const handleExportPNG = async () => {
    const canvas = document.createElement('canvas')
    canvas.width = WORLD_COLS * TILE_SIZE
    canvas.height = WORLD_ROWS * TILE_SIZE
    const ctx = canvas.getContext('2d', { alpha: false })!

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    /**
     * Draw one item into a TILE_SIZE × TILE_SIZE cell using drawImage so only
     * the exact source rect is sampled — no bleed from neighbours.
     * The sprite is scaled to fit, bottom-aligned (matching WorldGrid).
     */
    const drawItemInTile = async (itemId: number, cellX: number, cellY: number) => {
      const item = getItemById(itemId)
      if (!item) return
      try {
        const img = await loadAtlasImage(item.atlas)
        const flippedY = img.height - item.y - item.h

        const scale = Math.min(TILE_SIZE / item.w, TILE_SIZE / item.h)
        const drawW = item.w * scale
        const drawH = item.h * scale

        const destX = cellX + (TILE_SIZE - drawW) / 2
        const destY = cellY + (TILE_SIZE - drawH)   // bottom-aligned

        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, item.x, flippedY, item.w, item.h, destX, destY, drawW, drawH)
      } catch {
        console.warn(`Failed to load atlas for item ${itemId}`)
      }
    }

    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        const cell = grid[r][c]
        const x = c * TILE_SIZE
        const y = r * TILE_SIZE
        if (cell.bg !== 0) await drawItemInTile(cell.bg, x, y)
        if (cell.fg !== 0) await drawItemInTile(cell.fg, x, y)
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'world.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png', 1.0)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#141414] border border-gray-700/80 rounded-2xl w-full max-w-[500px] max-h-[640px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Map Summary</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {WORLD_COLS}×{WORLD_ROWS} world • {entries.length} item types used
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
              <span className="text-4xl opacity-40">🗺️</span>
              <p>No items placed yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map(({ id, count, item }) => (
                <div
                  key={id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1e1e1e] hover:bg-[#252525]"
                >
                  <div className="w-8 h-8 shrink-0 rounded-md bg-black/30 overflow-hidden">
                    <SpriteCanvas item={item} displaySize={32} />
                  </div>
                  <span className="flex-1 text-sm text-gray-200 font-mono">{item.block_name}</span>
                  <span className="text-xs text-gray-500 font-mono">{item.category}</span>
                  <span className="text-sm font-semibold text-orange-400 font-mono w-12 text-right">
                    ×{count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 bg-[#0a0a0a] flex justify-between items-center">
          <span className="text-xs text-gray-500">
            Total placed: {[...counts.values()].reduce((a, b) => a + b, 0)} blocks
          </span>
          <button
            onClick={handleExportPNG}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            💾 Export as PNG
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}