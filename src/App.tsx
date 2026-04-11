import { useEffect } from 'react'
import EditorLayout from './components/Toolbar/EditorLayout'
import AdBanner from './components/AdBanner'
import { useGridStore } from './stores/gridStore'
import { FaDiscord } from 'react-icons/fa'

function App() {
  const grid = useGridStore(s => s.grid)

  useEffect(() => {
    const hasContent = grid.some(row =>
      row.some(cell => cell.fg !== 0 || cell.bg !== 0)
    )
    if (!hasContent) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [grid])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">

      <header className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-orange-400">PW Planner</h1>
        <a
          href="https://discord.gg/pzDHcbxAkTZ"
          target="_blank"
          rel="noopener noreferrer"
          title="Join our Discord"
          className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#5865F2] hover:bg-[#5865F2]/10 transition-all"
        >
          <FaDiscord size={20} />
        </a>
      </header>

      <aside className="lg:hidden shrink-0 flex items-center justify-center bg-gray-900 border-b border-gray-800">
        <AdBanner adSlot="6291668108" adFormat="horizontal" />
      </aside>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside className="w-[160px] shrink-0 hidden lg:flex items-start justify-center pt-4 bg-gray-900 border-r border-gray-800">
          <AdBanner adSlot="3873388321" adFormat="vertical" />
        </aside>

        <div className="flex-1 overflow-hidden min-w-0 min-h-0">
          <EditorLayout />
        </div>

        <aside className="w-[160px] shrink-0 hidden lg:flex items-start justify-center pt-4 bg-gray-900 border-l border-gray-800">
          <AdBanner adSlot="2560306650" adFormat="vertical" />
        </aside>
      </div>

    </div>
  )
}

export default App