import { createPortal } from 'react-dom'
import { useGridStore, WORLD_COLS, WORLD_ROWS } from '../../stores/gridStore'
import { getItemById } from '../../data/items'

const TILE_SIZE = 32   // 256 / 8 = 32  (your original intent)

interface Props {
  onClose: () => void
}

export default function MapModal({ onClose }: Props) {
  const { grid } = useGridStore()

  // Count all placed items (fg + bg)
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

    // Optional dark background (remove or change if you want transparent)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const imageCache = new Map<string, HTMLImageElement>()

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!)

      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          imageCache.set(src, img)
          resolve(img)
        }
        img.onerror = reject
        img.src = src
      })
    }

    // Draw background layer first, then foreground
    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        const cell = grid[r][c]
        const x = c * TILE_SIZE
        const y = r * TILE_SIZE

        // Background first
        if (cell.bg !== 0) {
          const item = getItemById(cell.bg)
          if (item?.sprite) {
            try {
              const img = await loadImage(item.sprite)
              ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
            } catch (e) {
              console.warn(`Failed to load bg sprite ${item.sprite}`)
            }
          }
        }

        // Foreground on top
        if (cell.fg !== 0) {
          const item = getItemById(cell.fg)
          if (item?.sprite) {
            try {
              const img = await loadImage(item.sprite)
              ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
            } catch (e) {
              console.warn(`Failed to load fg sprite ${item.sprite}`)
            }
          }
        }
      }
    }

    // Download as PNG
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'world.png'          // Changed filename to match what we actually export
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png', 1.0)   // quality only matters for jpeg/webp
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#141414] border border-gray-700/80 rounded-2xl w-full max-w-[500px] max-h-[640px] flex flex-col overflow-hidden">
        {/* Header */}
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

        {/* Item list */}
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
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-black/30 rounded-md overflow-hidden">
                    {item.sprite ? (
                      <img
                        src={item.sprite}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span>❓</span>
                    )}
                  </div>
                  <span className="flex-1 text-sm text-gray-200 font-mono">{item.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{item.category}</span>
                  <span className="text-sm font-semibold text-orange-400 font-mono w-12 text-right">
                    ×{count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
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