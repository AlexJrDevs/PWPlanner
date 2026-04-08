import Toolbar from './Toolbar'
import ViewToolbar from './ViewToolbar'
import SelectionToolbar from './SelectionToolbar'
import WorldGrid from '../WorldGrid/WorldGrid'
import { useGridStore } from '../../stores/gridStore'

export default function EditorLayout() {
  const activeTool = useGridStore(s => s.activeTool)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Canvas fills ALL remaining space */}
      <div className="relative flex-1 overflow-hidden">
        <WorldGrid />

        {/* Floating conditional toolbars — appear just above the main toolbar */}
        {(activeTool === 'move' || activeTool === 'select') && (
          <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
            <div className="pointer-events-auto px-4 py-2 border-t border-gray-700">
              {activeTool === 'move' && <ViewToolbar />}
              {activeTool === 'select' && <SelectionToolbar />}
            </div>
          </div>
        )}
      </div>

      {/* Main Toolbar — always at the very bottom */}
      <Toolbar />
    </div>
  )
}