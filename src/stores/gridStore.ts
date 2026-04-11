import { getItemById } from '../data/items'

import { create } from 'zustand'

export const WORLD_COLS = 80
export const WORLD_ROWS = 60
export const TILE_SIZE = 256

export interface GridCell {
  fg: number
  bg: number
}

type Grid = GridCell[][]

export const ITEM_BEDROCK_ID = 3
export const ITEM_LAVA_ID = 344

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

export interface GhostCell {
  row: number
  col: number
  cell: GridCell
}

interface GridStore {
  grid: Grid
  history: Grid[]
  historyIndex: number

  selectedItemId: number
  selectedLayer: Layer
  activeTool: Tool

  mouseGridX: number
  mouseGridY: number

  zoom: number
  cameraX: number
  cameraY: number

  selection: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  selectedBlockCount: { total: number; empty: number; filled: number } | null
  anchorRow: number
  anchorCol: number

  selectionClipboard: { row: number; col: number; cell: GridCell }[] | null
  selectionMoveAnchor: { row: number; col: number } | null
  selectionMoveDelta: { dr: number; dc: number }

  duplicateGhost: GhostCell[] | null
  duplicateGhostSelection: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  duplicateGhostLayer: Layer | null

  setCell: (row: number, col: number) => void
  eraseCell: (row: number, col: number) => void
  fillGrid: (row: number, col: number) => void
  pickItem: (row: number, col: number) => void

  setSelectedItem: (id: number) => void
  setLayer: (layer: Layer) => void
  setTool: (tool: Tool) => void

  undo: () => void
  redo: () => void
  saveToHistory: () => void

  setMouseGridPosition: (col: number, row: number) => void
  setZoom: (newZoom: number) => void
  setCamera: (x: number, y: number) => void

  startSelection: (row: number, col: number) => void
  updateSelection: (row: number, col: number) => void
  endSelection: () => void
  clearSelection: () => void

  deleteSelection: () => void
  duplicateSelection: () => void
  commitDuplicate: () => void
  cancelDuplicate: () => void
  moveSelectionStart: (row: number, col: number) => void
  moveSelectionUpdate: (row: number, col: number) => void
  moveSelectionCommit: () => void

  clearGrid: () => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const cloneGrid = (g: Grid): Grid => g.map(r => r.map(c => ({ ...c })))

const applyGhost = (grid: Grid, ghost: GhostCell[]): Grid => {
  const next = cloneGrid(grid)
  for (const { row, col, cell } of ghost) {
    if (row < 0 || row >= WORLD_ROWS || col < 0 || col >= WORLD_COLS) continue
    if (cell.fg !== 0) next[row][col].fg = cell.fg
    if (cell.bg !== 0) next[row][col].bg = cell.bg
  }
  return next
}

// ─── store ───────────────────────────────────────────────────────────────────

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
  anchorRow: 0,
  anchorCol: 0,

  selectionClipboard: null,
  selectionMoveAnchor: null,
  selectionMoveDelta: { dr: 0, dc: 0 },

  duplicateGhost: null,
  duplicateGhostSelection: null,
  duplicateGhostLayer: null,

  // ── History ────────────────────────────────────────────────────────────────

  saveToHistory: () => {
    const { grid, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(cloneGrid(grid))
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  // ── Cell ops ───────────────────────────────────────────────────────────────

  setCell: (row, col) => {
    const { grid, selectedItemId } = get()
    const item = getItemById(selectedItemId)
    const layer = item?.category === 'background' ? 'bg' : 'fg'
    const next = cloneGrid(grid)
    next[row][col][layer] = selectedItemId
    set({ grid: next })
    get().saveToHistory()
  },

  eraseCell: (row, col) => {
    const { grid } = get()
    const next = cloneGrid(grid)
    const cell = next[row][col]
    if (cell.fg !== 0) {
      cell.fg = 0
    } else {
      cell.bg = 0
    }
    set({ grid: next })
    get().saveToHistory()
  },

  pickItem: (row, col) => {
    const { grid } = get()
    const cell = grid[row][col]
    const id = cell.fg !== 0 ? cell.fg : cell.bg
    if (id !== 0) set({ selectedItemId: id, activeTool: 'draw' })
  },

  fillGrid: (startRow, startCol) => {
    const { grid, selectedItemId } = get()
    const item = getItemById(selectedItemId)
    const layer = item?.category === 'background' ? 'bg' : 'fg'
    const targetId = grid[startRow][startCol][layer]

    if (targetId === selectedItemId) return

    const next = cloneGrid(grid)
    const stack: [number, number][] = [[startRow, startCol]]
    while (stack.length) {
      const [r, c] = stack.pop()!
      if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
      if (next[r][c][layer] !== targetId) continue
      next[r][c][layer] = selectedItemId
      stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
    }

    set({ grid: next })
    get().saveToHistory()
  },

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    set({ grid: cloneGrid(history[historyIndex - 1]), historyIndex: historyIndex - 1 })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    set({ grid: cloneGrid(history[historyIndex + 1]), historyIndex: historyIndex + 1 })
  },

  // ── Mouse / Camera ─────────────────────────────────────────────────────────

  setMouseGridPosition: (col, row) => {
    set({
      mouseGridX: Math.max(0, Math.min(col, WORLD_COLS - 1)),
      mouseGridY: Math.max(0, Math.min(row, WORLD_ROWS - 1)),
    })
  },

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(z, 10)) }),
  setCamera: (x, y) => set({ cameraX: x, cameraY: y }),

  // ── Selection ──────────────────────────────────────────────────────────────

  startSelection: (row, col) => {
    // FIX: commit any pending ghost and fully reset selection state before
    // starting a new selection, so old clipboard/ghost never bleeds through.
    const { duplicateGhost, grid } = get()

    let baseGrid = grid
    if (duplicateGhost) {
      // Commit ghost into grid silently (no history — user is starting fresh)
      baseGrid = applyGhost(grid, duplicateGhost)
    }

    set({
      grid: baseGrid,
      anchorRow: row,
      anchorCol: col,
      selection: { startRow: row, startCol: col, endRow: row, endCol: col },
      selectedBlockCount: null,
      // Reset all move/ghost state so nothing from the previous selection lingers
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
      duplicateGhost: null,
      duplicateGhostSelection: null,
      duplicateGhostLayer: null,
    })
  },

  updateSelection: (row, col) => {
    const { anchorRow, anchorCol } = get()
    set({
      selection: {
        startRow: Math.min(anchorRow, row),
        startCol: Math.min(anchorCol, col),
        endRow: Math.max(anchorRow, row),
        endCol: Math.max(anchorCol, col),
      },
    })
  },

  endSelection: () => {
    const { selection, grid } = get()
    if (!selection) return

    let total = 0, empty = 0
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

  // Commits any pending ghost then clears selection state.
  clearSelection: () => {
    const { duplicateGhost, grid } = get()
    if (duplicateGhost) {
      const next = applyGhost(grid, duplicateGhost)
      get().saveToHistory()
      set({
        grid: next,
        duplicateGhost: null,
        duplicateGhostSelection: null,
        duplicateGhostLayer: null,
      })
    }
    set({
      selection: null,
      selectedBlockCount: null,
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
    })
  },

  // ── Selection actions ──────────────────────────────────────────────────────

  deleteSelection: () => {
    const { duplicateGhost, selection, grid } = get()

    if (duplicateGhost) {
      // FIX: discard the ghost without touching the real grid, then save so
      // undo can restore the state before the duplicate was started.
      set({
        duplicateGhost: null,
        duplicateGhostSelection: null,
        duplicateGhostLayer: null,
      })
      get().saveToHistory()
      return
    }

    if (!selection) return

    const next = cloneGrid(grid)
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        next[r][c].fg = 0
        next[r][c].bg = 0
      }
    }

    set({ grid: next })
    get().saveToHistory()
  },

  duplicateSelection: () => {
    const { duplicateGhost, selection: selectionBeforeCommit } = get()
    if (duplicateGhost) get().commitDuplicate()
    if (!selectionBeforeCommit) return

    const { grid } = get()
    const selection = selectionBeforeCommit
    const ghost: GhostCell[] = []

    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        const nr = r + 1
        const nc = c + 1
        if (nr < 0 || nr >= WORLD_ROWS || nc < 0 || nc >= WORLD_COLS) continue
        const src = grid[r][c]
        ghost.push({ row: nr, col: nc, cell: { fg: src.fg, bg: src.bg } })
      }
    }

    set({
      duplicateGhost: ghost,
      duplicateGhostLayer: 'fg',
      selection: {
        startRow: selection.startRow + 1, startCol: selection.startCol + 1,
        endRow: selection.endRow + 1,     endCol: selection.endCol + 1,
      },
      duplicateGhostSelection: {
        startRow: selection.startRow + 1, startCol: selection.startCol + 1,
        endRow: selection.endRow + 1,     endCol: selection.endCol + 1,
      },
      selectedBlockCount: null,
    })
  },

  commitDuplicate: () => {
    const { grid, duplicateGhost, duplicateGhostSelection } = get()
    if (!duplicateGhost) return
    const next = applyGhost(grid, duplicateGhost)
    set({
      grid: next,
      duplicateGhost: null,
      duplicateGhostLayer: null,
      selection: duplicateGhostSelection,
      duplicateGhostSelection: null,
    })
    get().saveToHistory()
  },

  cancelDuplicate: () => {
    set({ duplicateGhost: null, duplicateGhostSelection: null, duplicateGhostLayer: null })
  },

  // ── Selection move ─────────────────────────────────────────────────────────

  moveSelectionStart: (row, col) => {
    const { duplicateGhost, selection, grid } = get()

    if (duplicateGhost) {
      set({
        selectionClipboard: duplicateGhost.map(g => ({ ...g, cell: { ...g.cell } })),
        selectionMoveAnchor: { row, col },
        selectionMoveDelta: { dr: 0, dc: 0 },
        duplicateGhost: null,
        selectedBlockCount: null,
      })
      return
    }

    if (!selection) return

    const clipboard: { row: number; col: number; cell: GridCell }[] = []
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        clipboard.push({ row: r, col: c, cell: { ...grid[r][c] } })
      }
    }

    const next = cloneGrid(grid)
    for (const { row: r, col: c } of clipboard) {
      next[r][c].fg = 0
      next[r][c].bg = 0
    }

    set({
      selectionClipboard: clipboard,
      selectionMoveAnchor: { row, col },
      selectionMoveDelta: { dr: 0, dc: 0 },
      grid: next,
    })
  },

  moveSelectionUpdate: (row, col) => {
    const { selectionClipboard, selectionMoveAnchor, selectionMoveDelta, grid, duplicateGhostLayer } = get()
    if (!selectionClipboard || !selectionMoveAnchor) return

    const newDr = row - selectionMoveAnchor.row
    const newDc = col - selectionMoveAnchor.col
    const { dr: prevDr, dc: prevDc } = selectionMoveDelta

    if (newDr === prevDr && newDc === prevDc) return

    const origRows = selectionClipboard.map(e => e.row)
    const origCols = selectionClipboard.map(e => e.col)
    const newStartRow = Math.min(...origRows) + newDr
    const newStartCol = Math.min(...origCols) + newDc
    const newEndRow   = Math.max(...origRows) + newDr
    const newEndCol   = Math.max(...origCols) + newDc

    if (duplicateGhostLayer) {
      const ghost: GhostCell[] = selectionClipboard
        .map(({ row: r, col: c, cell }) => ({
          row: r + newDr,
          col: c + newDc,
          cell: { ...cell },
        }))
        .filter(g => g.row >= 0 && g.row < WORLD_ROWS && g.col >= 0 && g.col < WORLD_COLS)

      set({
        selectionMoveDelta: { dr: newDr, dc: newDc },
        duplicateGhost: ghost,
        duplicateGhostSelection: { startRow: newStartRow, startCol: newStartCol, endRow: newEndRow, endCol: newEndCol },
        selection: { startRow: newStartRow, startCol: newStartCol, endRow: newEndRow, endCol: newEndCol },
        anchorRow: newStartRow,
        anchorCol: newStartCol,
      })
      return
    }

    const next = cloneGrid(grid)

    for (const { row: r, col: c } of selectionClipboard) {
      const pr = r + prevDr, pc = c + prevDc
      if (pr < 0 || pr >= WORLD_ROWS || pc < 0 || pc >= WORLD_COLS) continue
      next[pr][pc].fg = 0
      next[pr][pc].bg = 0
    }

    for (const { row: r, col: c, cell } of selectionClipboard) {
      const nr = r + newDr, nc = c + newDc
      if (nr < 0 || nr >= WORLD_ROWS || nc < 0 || nc >= WORLD_COLS) continue
      next[nr][nc].fg = cell.fg
      next[nr][nc].bg = cell.bg
    }

    set({
      grid: next,
      selectionMoveDelta: { dr: newDr, dc: newDc },
      selection: { startRow: newStartRow, startCol: newStartCol, endRow: newEndRow, endCol: newEndCol },
      anchorRow: newStartRow,
      anchorCol: newStartCol,
    })
  },

  moveSelectionCommit: () => {
    const { selectionClipboard, duplicateGhostLayer } = get()

    if (duplicateGhostLayer && selectionClipboard) {
      set({
        selectionClipboard: null,
        selectionMoveAnchor: null,
        selectionMoveDelta: { dr: 0, dc: 0 },
      })
      return
    }

    set({
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
    })
    get().saveToHistory()
  },

  // ── Misc ───────────────────────────────────────────────────────────────────

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
      history: [cloneGrid(empty)],
      historyIndex: 0,
      selection: null,
      selectedBlockCount: null,
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
      duplicateGhost: null,
      duplicateGhostSelection: null,
      duplicateGhostLayer: null,
    })
  },
}))