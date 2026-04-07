import { useGridStore } from '../../stores/gridStore'

export default function SelectionToolbar() {
  const { selectedBlockCount, clearSelection } = useGridStore()

  if (!selectedBlockCount) {
    return (
      <div className="px-3 py-1.5 bg-[#141414] border-b border-gray-700 text-xs text-gray-400">
        Select tool active — drag on canvas to select blocks
      </div>
    )
  }

  const { total, empty, filled } = selectedBlockCount

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[#141414] border-b border-gray-700 text-sm">
      <span className="text-orange-400 font-medium">
        {total} blocks selected
      </span>
      <span className="text-gray-400">
        ({filled} filled, {empty} empty)
      </span>

      <button
        onClick={clearSelection}
        className="ml-auto px-3 py-1 text-xs bg-red-900 hover:bg-red-800 rounded border border-red-700"
      >
        Clear Selection
      </button>
    </div>
  )
}