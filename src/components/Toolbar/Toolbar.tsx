import { useEffect, useState } from 'react'
import { useGridStore, type Tool } from '../../stores/gridStore'
import { getItemById } from '../../data/items'
import ItemPalette from './ItemPalette'
import MapModal from './MapModal'

export default function Toolbar() {
  const {
    activeTool,
    setTool,
    undo,
    redo,
    mouseGridX,
    mouseGridY,
    grid,
  } = useGridStore()

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // ── Live cell under cursor ─────────────────────────────────────────────
  const currentCell = grid[mouseGridY]?.[mouseGridX]
  const fgItem = currentCell?.fg ? getItemById(currentCell.fg) : null
  const bgItem = currentCell?.bg ? getItemById(currentCell.bg) : null

  const displayX = mouseGridX   // 0-based as shown in your original image
  const displayY = mouseGridY

  const tools: { id: Tool; label: string; icon: string }[] = [
    { id: 'move',   label: 'Move / View', icon: '👁️' },
    { id: 'select', label: 'Select',      icon: '↖️' },
    { id: 'draw',   label: 'Draw',        icon: '✏️' },
    { id: 'erase',  label: 'Erase',       icon: '🧼' },
    { id: 'picker', label: 'Picker',      icon: '📌' },
    { id: 'fill',   label: 'Flood Fill',  icon: '🪣' },
  ]
  
    const [mapOpen, setMapOpen] = useState(false)
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-[#1a1a1a] border-b border-gray-700 overflow-x-auto">
      {/* Tool buttons */}
      <div className="flex gap-1">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`w-10 h-10 flex items-center justify-center text-2xl rounded border transition-all
              ${activeTool === t.id
                ? 'bg-orange-500 border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.3)] scale-105'
                : 'bg-[#2a2a2a] border-gray-600 hover:border-gray-400 hover:bg-[#363636]'
              }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-gray-600 mx-2" />

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          onClick={undo}
          title="Undo (Ctrl+Z)"
          className="w-10 h-10 flex items-center justify-center text-2xl rounded border bg-[#2a2a2a] border-gray-600 hover:border-gray-400 hover:bg-[#363636]"
        >
          ↩️
        </button>
        <button
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
          className="w-10 h-10 flex items-center justify-center text-2xl rounded border bg-[#2a2a2a] border-gray-600 hover:border-gray-400 hover:bg-[#363636]"
        >
          ↪️
        </button>
      </div>

      <div className="w-px h-8 bg-gray-600 mx-2" />

      {/* Map & Settings */}
        <button
        onClick={() => setMapOpen(true)}
        title="World Settings"
        className="w-10 h-10 flex items-center justify-center text-2xl rounded border bg-[#2a2a2a] border-gray-600 hover:border-gray-400 hover:bg-[#363636]"
        >
        🗺️
        </button>
        {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}


      {/* Right side — Current block + live coordinates */}
      <div className="ml-auto flex items-center gap-3 pr-2">
        <ItemPalette />  

        <div className="text-xs text-gray-400 font-mono leading-relaxed">
          <div>
            X:<span className="text-white ml-1">{displayX + 1}</span>{' '}
            Y:<span className="text-white ml-1">{displayY + 1}</span>{' '}
          </div>
          <div className="flex gap-2">
            <span className="text-blue-400">
              F: {fgItem ? <span className="text-blue-200">{fgItem.block_name}</span> : <span className="text-gray-600">Empty</span>}
            </span>
            <span className="text-purple-400">
              B: {bgItem ? <span className="text-purple-200">{bgItem.block_name}</span> : <span className="text-gray-600">Empty</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}