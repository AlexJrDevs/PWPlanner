import { useGridStore } from '../../stores/gridStore'

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
      className="flex items-center gap-1 px-2 sm:px-3 h-7 sm:h-8 rounded border border-gray-600 bg-[#252525]
                 hover:bg-[#333] hover:border-gray-400 active:scale-95
                 text-gray-200 text-xs sm:text-sm font-mono transition-all select-none shrink-0"
    >
      <span className="text-sm sm:text-base leading-none">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  return (
    <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#141414] border-b border-gray-700/60 overflow-x-auto">
      <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1 select-none shrink-0">
        View
      </span>

      {btn('Zoom In',  '🔍', zoomIn,  'Zoom in')}
      {btn('Zoom Out', '🔎', zoomOut, 'Zoom out')}

      <span className="text-[10px] text-gray-600 ml-auto select-none hidden md:block shrink-0">
        Scroll to zoom · Middle-drag to pan
      </span>
    </div>
  )
}