import EditorLayout from './components/Toolbar/EditorLayout'

function App() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Top bar */}
      <header className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-orange-400">PW Planner</h1>
        <span className="text-xs text-gray-500">World Grid</span>
      </header>

      {/* Full editor with conditional toolbars */}
      <EditorLayout />
    </div>
  )
}

export default App