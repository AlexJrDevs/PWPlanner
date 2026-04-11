import { useGridStore } from '../../stores/gridStore'

export default function SelectionToolbar() {
  const {
    selectedBlockCount,
    duplicateGhost,
    clearSelection,
    deleteSelection,
    duplicateSelection,
  } = useGridStore()

  

  if (!selectedBlockCount && !duplicateGhost) {
    return (
      <div className="px-3 py-1.5 bg-[#141414] border-b border-gray-700 text-xs text-gray-400">
        Select tool active — drag on the canvas to select blocks
      </div>
    )
  }

    const { total, empty, filled } = selectedBlockCount ?? { total: 0, empty: 0, filled: 0 }
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[#141414] border-b border-gray-700 text-sm">
      <span className="text-orange-400 font-medium">{total} blocks selected</span>
      <span className="text-gray-400">({filled} filled • {empty} empty)</span>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={duplicateSelection}
          className="px-3 py-1 text-xs bg-blue-900/80 hover:bg-blue-800 border border-blue-700 rounded transition-colors"
          title="Clone selection (copies tiles offset by 1)"
        >
          Clone
        </button>

        <button
          onClick={deleteSelection}
          className="px-3 py-1 text-xs bg-red-900/80 hover:bg-red-800 border border-red-700 rounded transition-colors"
        >
          Delete
        </button>
        <button
          onClick={clearSelection}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition-colors"
        >
          Deselect
        </button>
      </div>
    </div>
  )
}