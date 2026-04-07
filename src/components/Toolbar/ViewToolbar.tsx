import { useGridStore} from '../../stores/gridStore'

/**
 * ViewToolbar
 * Rendered directly below the main Toolbar when activeTool === 'move'.
 * Provides zoom in / zoom out / reset controls, with a live zoom % readout.
 * The parent layout should place this between <Toolbar> and <WorldGrid>.
 */
export default function ViewToolbar() {
  const { zoom, setZoom } = useGridStore()

  const MIN_ZOOM = 0.05
  const MAX_ZOOM = 8

  const zoomIn  = () => setZoom(Math.min(MAX_ZOOM, zoom * 1.25))
  const zoomOut = () => setZoom(Math.max(MIN_ZOOM, zoom * 0.8))

  const btn = (label: string, icon: string, onClick: () => void, title: string) => (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-3 h-8 rounded border border-gray-600 bg-[#252525]
                 hover:bg-[#333] hover:border-gray-400 active:scale-95
                 text-gray-200 text-sm font-mono transition-all select-none"
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border-b border-gray-700/60">
      {/* Label */}
      <span className="text-[11px] uppercase tracking-widest text-gray-500 mr-1 select-none">
        View
      </span>

      {/* Zoom controls */}
      {btn('Zoom In',  '🔍', zoomIn,    'Zoom in  (also scroll up on canvas)')}
      {btn('Zoom Out', '🔎', zoomOut,   'Zoom out (also scroll down on canvas)')}
    

      <span className="text-[10px] text-gray-600 ml-auto select-none">
        Scroll on canvas to zoom · Middle-drag to pan
      </span>
    </div>
  )
}