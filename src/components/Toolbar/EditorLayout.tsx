import Toolbar from './Toolbar'
import ViewToolbar from './ViewToolbar'
import SelectionToolbar from './SelectionToolbar'
import WorldGrid from '../WorldGrid/WorldGrid'
import { useGridStore } from '../../stores/gridStore'

export default function EditorLayout() {
  const activeTool = useGridStore(s => s.activeTool)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Toolbar />

      {/* Canvas fills all remaining space */}
      <div className="relative flex-1 overflow-hidden">
        <WorldGrid />

        {/* Overlay — outer div blocks nothing, inner div only covers the bar itself */}
        {(activeTool === 'move' || activeTool === 'select') && (
          <div className="absolute top-0 left-0 right-0 pointer-events-none z-30">
            <div className="pointer-events-auto">
              {activeTool === 'move' && <ViewToolbar />}
              {activeTool === 'select' && <SelectionToolbar />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}