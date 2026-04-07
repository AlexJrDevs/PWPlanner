import { create } from 'zustand'

export const WORLD_COLS = 80
export const WORLD_ROWS = 60
export const TILE_SIZE = 256

export interface GridCell {
  fg: number
  bg: number
}

type Grid = GridCell[][]

export const ITEM_BEDROCK_ID = 1
export const ITEM_LAVA_ID = 2

const createEmptyGrid = (): Grid =>
  Array.from({ length: WORLD_ROWS }, (_, row) =>
    Array.from({ length: WORLD_COLS }, () => {
      if (row === WORLD_ROWS - 3 || row === WORLD_ROWS - 2)
        return { fg: ITEM_BEDROCK_ID, bg: 0 }
      if (row === WORLD_ROWS - 1)
        return { fg: ITEM_LAVA_ID, bg: 0 }
      return { fg: 0, bg: 0 }
    })
  )

export type Layer = 'fg' | 'bg'
export type Tool = 'move' | 'select' | 'draw' | 'erase' | 'picker' | 'fill'

interface GridStore {
  grid: Grid
  history: Grid[]
  historyIndex: number

  selectedItemId: number
  selectedLayer: Layer
  activeTool: Tool

  // Mouse position on grid (0-based internally, display as 1-based)
  mouseGridX: number
  mouseGridY: number

  // Camera & Zoom (managed in WorldGrid but mirrored here for toolbar display)
  zoom: number
  cameraX: number
  cameraY: number

  // Selection
  selection: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  selectedBlockCount: { total: number; empty: number; filled: number } | null

  // Actions
  setCell: (row: number, col: number) => void
  eraseCell: (row: number, col: number) => void
  fillGrid: (row: number, col: number) => void
  pickItem: (row: number, col: number) => void

  setSelectedItem: (id: number) => void
  setLayer: (layer: Layer) => void
  setTool: (tool: Tool) => void

  // Undo / Redo
  undo: () => void
  redo: () => void
  saveToHistory: () => void

  // Mouse & Camera
  setMouseGridPosition: (col: number, row: number) => void
  setZoom: (newZoom: number) => void
  setCamera: (x: number, y: number) => void

  // Selection
  startSelection: (row: number, col: number) => void
  updateSelection: (row: number, col: number) => void
  endSelection: () => void
  clearSelection: () => void

  clearGrid: () => void
}

export const useGridStore = create<GridStore>((set, get) => ({
  grid: createEmptyGrid(),
  history: [createEmptyGrid()],
  historyIndex: 0,

  selectedItemId: 1,
  selectedLayer: 'fg',
  activeTool: 'move',

  mouseGridX: 0,
  mouseGridY: 0,

  zoom: 1.0,
  cameraX: 0,
  cameraY: 0,

  selection: null,
  selectedBlockCount: null,

  saveToHistory: () => {
    const { grid, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(grid.map(row => row.map(cell => ({ ...cell }))))
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  setCell: (row, col) => {
    const { grid, selectedItemId, selectedLayer } = get()
    const newGrid = grid.map(r => r.map(c => ({ ...c })))
    if (selectedLayer === 'fg') newGrid[row][col].fg = selectedItemId
    else newGrid[row][col].bg = selectedItemId
    set({ grid: newGrid })
    get().saveToHistory()
  },

  eraseCell: (row, col) => {
    const { grid, selectedLayer } = get()
    const newGrid = grid.map(r => r.map(c => ({ ...c })))
    if (selectedLayer === 'fg') newGrid[row][col].fg = 0
    else newGrid[row][col].bg = 0
    set({ grid: newGrid })
    get().saveToHistory()
  },

  pickItem: (row, col) => {
    const { grid, selectedLayer } = get()
    const cell = grid[row][col]
    const id = selectedLayer === 'fg' ? cell.fg : cell.bg
    if (id !== 0) {
      // Pick the item and automatically switch to draw tool
      set({ selectedItemId: id, activeTool: 'draw' })
    }
  },

  fillGrid: (startRow, startCol) => {
    const { grid, selectedItemId, selectedLayer } = get()
    const targetId = selectedLayer === 'fg'
      ? grid[startRow][startCol].fg
      : grid[startRow][startCol].bg

    if (targetId === selectedItemId) return

    const newGrid = grid.map(r => r.map(c => ({ ...c })))
    const stack: [number, number][] = [[startRow, startCol]]

    while (stack.length) {
      const [r, c] = stack.pop()!
      if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
      const cellVal = selectedLayer === 'fg' ? newGrid[r][c].fg : newGrid[r][c].bg
      if (cellVal !== targetId) continue

      if (selectedLayer === 'fg') newGrid[r][c].fg = selectedItemId
      else newGrid[r][c].bg = selectedItemId

      stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
    }

    set({ grid: newGrid })
    get().saveToHistory()
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    set({ grid: history[historyIndex - 1].map(r => r.map(c => ({ ...c }))), historyIndex: historyIndex - 1 })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    set({ grid: history[historyIndex + 1].map(r => r.map(c => ({ ...c }))), historyIndex: historyIndex + 1 })
  },

  // Called from WorldGrid with 0-based col/row
  setMouseGridPosition: (col, row) => {
    set({
      mouseGridX: Math.max(0, Math.min(col, WORLD_COLS - 1)),
      mouseGridY: Math.max(0, Math.min(row, WORLD_ROWS - 1)),
    })
  },

  setZoom: (newZoom) => set({ zoom: Math.max(0.1, Math.min(newZoom, 10)) }),
  setCamera: (x, y) => set({ cameraX: x, cameraY: y }),

  startSelection: (row, col) => {
    set({ selection: { startRow: row, startCol: col, endRow: row, endCol: col }, selectedBlockCount: null })
  },

  updateSelection: (row, col) => {
    const { selection } = get()
    if (!selection) return
    set({
      selection: {
        startRow: Math.min(selection.startRow, row),
        startCol: Math.min(selection.startCol, col),
        endRow: Math.max(selection.startRow, row),
        endCol: Math.max(selection.startCol, col),
      }
    })
  },

  endSelection: () => {
    const { selection, grid } = get()
    if (!selection) return

    let total = 0
    let empty = 0

    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        total++
        const cell = grid[r][c]
        if (cell.fg === 0 && cell.bg === 0) empty++
      }
    }

    set({ selectedBlockCount: { total, empty, filled: total - empty } })
  },

  clearSelection: () => set({ selection: null, selectedBlockCount: null }),

  setSelectedItem: (id) => set({ selectedItemId: id }),
  setLayer: (layer) => set({ selectedLayer: layer }),
  setTool: (tool) => {
    set({ activeTool: tool })
    if (tool !== 'select') get().clearSelection()
  },

  clearGrid: () => {
    const empty = createEmptyGrid()
    set({
      grid: empty,
      history: [empty.map(r => r.map(c => ({ ...c })))],
      historyIndex: 0,
      selection: null,
      selectedBlockCount: null
    })
  },
}))