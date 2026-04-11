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

  // selectionSnapshot: frozen copy of selected cells captured the moment the
  // selection drag ends (endSelection). All move/delete/clone ops read from this,
  // never from the live grid, so tiles painted after the selection is drawn can
  // never retroactively join the selection.
  selectionSnapshot: { row: number; col: number; cell: GridCell }[] | null

  // selectionUnderGrid: what the grid had at each snapshot position BEFORE the
  // selection was dropped there. Used to restore those cells when the user starts
  // a second move, so tiles beneath the selection are never permanently erased.
  selectionUnderGrid: { row: number; col: number; cell: GridCell }[] | null

  // selectionClipboard: original cells lifted from the grid at move-start.
  // selectionMoveAnchor: the grid cell the user first clicked to begin the move.
  // selectionMoveDelta: current (dr, dc) offset from anchor.
  // selectionBaseGrid: snapshot of the grid with the selection area blanked out,
  //   used as the stable base during a move so we never corrupt non-selected tiles.
  selectionClipboard: { row: number; col: number; cell: GridCell }[] | null
  selectionMoveAnchor: { row: number; col: number } | null
  selectionMoveDelta: { dr: number; dc: number }
  selectionBaseGrid: Grid | null

  // duplicateGhost is used for the Clone flow (separate from move).
  // During a move, duplicateGhost holds the in-flight ghost so the renderer
  // can draw the floating tiles without touching the real grid.
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

/**
 * Composites a ghost array onto a base grid and returns a new grid.
 * Non-zero fg/bg values in the ghost overwrite the base; zero values are
 * transparent (they leave whatever was already in the base intact).
 */
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

  selectionSnapshot: null,
  selectionUnderGrid: null,

  selectionClipboard: null,
  selectionMoveAnchor: null,
  selectionMoveDelta: { dr: 0, dc: 0 },
  selectionBaseGrid: null,

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
    // Commit any pending ghost/move before starting a fresh selection.
    const { duplicateGhost, selectionClipboard, selectionBaseGrid, selectionMoveDelta, grid } = get()

    let baseGrid = grid

    if (selectionClipboard && selectionBaseGrid) {
      // A move was in progress — commit it by applying the ghost to the base.
      const ghost: GhostCell[] = selectionClipboard.map(({ row: r, col: c, cell }) => ({
        row: r + selectionMoveDelta.dr,
        col: c + selectionMoveDelta.dc,
        cell,
      }))
      baseGrid = applyGhost(selectionBaseGrid, ghost)
    } else if (duplicateGhost) {
      baseGrid = applyGhost(grid, duplicateGhost)
    }

    set({
      grid: baseGrid,
      anchorRow: row,
      anchorCol: col,
      selection: { startRow: row, startCol: col, endRow: row, endCol: col },
      selectedBlockCount: null,
      selectionSnapshot: null,
      selectionUnderGrid: null,
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
      selectionBaseGrid: null,
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
    const snapshot: { row: number; col: number; cell: GridCell }[] = []

    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        total++
        const cell = grid[r][c]
        if (cell.fg === 0 && cell.bg === 0) empty++
        // Freeze a copy of each cell — this snapshot never changes after this point.
        snapshot.push({ row: r, col: c, cell: { ...cell } })
      }
    }

    set({
      selectedBlockCount: { total, empty, filled: total - empty },
      selectionSnapshot: snapshot,
    })
  },

  // Commits any pending ghost/move then clears selection state.
  clearSelection: () => {
    const { duplicateGhost, selectionClipboard, selectionBaseGrid, selectionMoveDelta, grid } = get()

    let finalGrid = grid

    if (selectionClipboard && selectionBaseGrid) {
      // Commit in-progress move
      const ghost: GhostCell[] = selectionClipboard.map(({ row: r, col: c, cell }) => ({
        row: r + selectionMoveDelta.dr,
        col: c + selectionMoveDelta.dc,
        cell,
      }))
      finalGrid = applyGhost(selectionBaseGrid, ghost)
      get().saveToHistory()
    } else if (duplicateGhost) {
      finalGrid = applyGhost(grid, duplicateGhost)
      get().saveToHistory()
    }

    set({
      grid: finalGrid,
      selection: null,
      selectedBlockCount: null,
      selectionSnapshot: null,
      selectionUnderGrid: null,
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
      selectionBaseGrid: null,
      duplicateGhost: null,
      duplicateGhostSelection: null,
      duplicateGhostLayer: null,
    })
  },

  // ── Selection actions ──────────────────────────────────────────────────────

  deleteSelection: () => {
    const { duplicateGhost, selectionClipboard, selectionBaseGrid, selection, grid, selectionSnapshot } = get()

    if (selectionClipboard && selectionBaseGrid) {
      // Cancel the in-progress move — restore the base grid (cells stay erased)
      set({
        grid: selectionBaseGrid,
        selectionClipboard: null,
        selectionMoveAnchor: null,
        selectionMoveDelta: { dr: 0, dc: 0 },
        selectionBaseGrid: null,
        duplicateGhost: null,
      })
      get().saveToHistory()
      return
    }

    if (duplicateGhost) {
      // Discard the clone ghost without committing
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


      if (selectionSnapshot) {
        // Only erase the exact cells that were snapshotted — never touches tiles
        // that happened to fall inside the bounding rect but weren't selected.
        for (const { row: r, col: c, cell } of selectionSnapshot) {
          if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
          // Only erase layers that the snapshot actually had content on.
          // Skipping empty snapshot cells prevents wiping tiles painted
          // beneath the selection after it was drawn.
          if (cell.fg !== 0) next[r][c].fg = 0
          if (cell.bg !== 0) next[r][c].bg = 0
        }
      } else {
        // Fallback: no snapshot yet (selection just started), erase the rect
        for (let r = selection.startRow; r <= selection.endRow; r++) {
          for (let c = selection.startCol; c <= selection.endCol; c++) {
            if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
            next[r][c].fg = 0
            next[r][c].bg = 0
          }
        }
      }

      set({ grid: next })
      get().saveToHistory()
    },

  duplicateSelection: () => {
    const { duplicateGhost, selectionClipboard, selectionBaseGrid, selectionMoveDelta } = get()

    // Commit any in-progress move first
    if (selectionClipboard && selectionBaseGrid) {
      const ghost: GhostCell[] = selectionClipboard.map(({ row: r, col: c, cell }) => ({
        row: r + selectionMoveDelta.dr,
        col: c + selectionMoveDelta.dc,
        cell,
      }))
      const committed = applyGhost(selectionBaseGrid, ghost)
      set({
        grid: committed,
        selectionClipboard: null,
        selectionMoveAnchor: null,
        selectionMoveDelta: { dr: 0, dc: 0 },
        selectionBaseGrid: null,
        duplicateGhost: null,
      })
      get().saveToHistory()
    } else if (duplicateGhost) {
      get().commitDuplicate()
    }

    const { selection, selectionSnapshot } = get()
    if (!selection) return

    // Build clone from the frozen snapshot — tiles drawn after selection are excluded.
    const cloneGhost: GhostCell[] = (selectionSnapshot ?? [])
      .map(({ row: r, col: c, cell }) => {
        const nr = r + 1
        const nc = c + 1
        if (nr < 0 || nr >= WORLD_ROWS || nc < 0 || nc >= WORLD_COLS) return null
        return { row: nr, col: nc, cell: { fg: cell.fg, bg: cell.bg } }
      })
      .filter((g): g is GhostCell => g !== null)

    set({
      duplicateGhost: cloneGhost,
      duplicateGhostLayer: 'fg',
      selection: {
        startRow: selection.startRow + 1, startCol: selection.startCol + 1,
        endRow: selection.endRow + 1,     endCol: selection.endCol + 1,
      },
      duplicateGhostSelection: {
        startRow: selection.startRow + 1, startCol: selection.startCol + 1,
        endRow: selection.endRow + 1,     endCol: selection.endCol + 1,
      },
      selectedBlockCount: (() => {
        const total = cloneGhost.length
        const empty = cloneGhost.filter(g => g.cell.fg === 0 && g.cell.bg === 0).length
        return { total, empty, filled: total - empty }
      })(),
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
  //
  // KEY DESIGN: we never write moved tiles back into `grid` until commit.
  //
  // On moveSelectionStart:
  //   1. Snapshot the grid with the selection cells blanked → selectionBaseGrid.
  //   2. Save the original cell data           → selectionClipboard.
  //   3. Set duplicateGhost to the initial (delta=0) ghost so the renderer
  //      draws the tiles in their original position as a floating ghost.
  //
  // On moveSelectionUpdate:
  //   Recompute the ghost at (clipboard[i].row + dr, clipboard[i].col + dc).
  //   Only selectionBaseGrid + ghost changes — the real grid never changes.
  //
  // On moveSelectionCommit:
  //   Apply ghost onto selectionBaseGrid → new grid. Save to history. Done.

  moveSelectionStart: (row, col) => {
    const { duplicateGhost, duplicateGhostLayer, selection, grid } = get()

    // ── Case A: moving a duplicate ghost ─────────────────────────────────
    if (duplicateGhost && duplicateGhostLayer) {
      // The ghost cells are already floating (not in the real grid), so
      // selectionBaseGrid is just the current grid unchanged.
      set({
        selectionClipboard: duplicateGhost.map(g => ({ row: g.row, col: g.col, cell: { ...g.cell } })),
        selectionBaseGrid: cloneGrid(grid),
        selectionMoveAnchor: { row, col },
        selectionMoveDelta: { dr: 0, dc: 0 },
        duplicateGhost: duplicateGhost, // keep ghost so renderer shows it
        duplicateGhostLayer: duplicateGhostLayer,
        // selectedBlockCount intentionally NOT reset
      })
      return
    }

    // ── Case B: moving a normal selection ─────────────────────────────────
    if (!selection) return

    // Use the frozen snapshot for the tiles being lifted — never the live grid.
    const { selectionSnapshot, selectionUnderGrid } = get()
    const clipboard: { row: number; col: number; cell: GridCell }[] =
      selectionSnapshot
        ? selectionSnapshot.map(s => ({ ...s, cell: { ...s.cell } }))
        : (() => {
            const result: { row: number; col: number; cell: GridCell }[] = []
            for (let r = selection.startRow; r <= selection.endRow; r++) {
              for (let c = selection.startCol; c <= selection.endCol; c++) {
                if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
                result.push({ row: r, col: c, cell: { ...grid[r][c] } })
              }
            }
            return result
          })()

    // Build the base grid by restoring whatever was beneath the selection when
    // it was last dropped. This prevents erasing tiles the selection sat on top of.
    const baseGrid = cloneGrid(grid)
    if (selectionUnderGrid) {
      // Restore the cells that were underneath the selection at its last commit.
      for (const { row: r, col: c, cell } of selectionUnderGrid) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        baseGrid[r][c] = { ...cell }
      }
    } else {
      // First move after a fresh selection drag — just blank the snapshot positions.
      for (const { row: r, col: c } of clipboard) {
        if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) continue
        baseGrid[r][c].fg = 0
        baseGrid[r][c].bg = 0
      }
    }

    // Initial ghost sits exactly where the tiles were (dr=0, dc=0)
    const initialGhost: GhostCell[] = clipboard.map(({ row: r, col: c, cell }) => ({
      row: r,
      col: c,
      cell: { ...cell },
    }))

    set({
      selectionClipboard: clipboard,
      selectionBaseGrid: baseGrid,
      selectionMoveAnchor: { row, col },
      selectionMoveDelta: { dr: 0, dc: 0 },
      // Use duplicateGhost so the existing ghost renderer draws the floating tiles
      duplicateGhost: initialGhost,
      duplicateGhostLayer: null, // null = this is a move ghost, not a clone ghost
      // Switch displayed grid to base (holes visible while dragging)
      grid: baseGrid,
      // selectedBlockCount intentionally NOT reset — keep the frozen count from endSelection
    })
  },

  moveSelectionUpdate: (row, col) => {
    const { selectionClipboard, selectionMoveAnchor, selectionBaseGrid } = get()
    if (!selectionClipboard || !selectionMoveAnchor || !selectionBaseGrid) return

    const newDr = row - selectionMoveAnchor.row
    const newDc = col - selectionMoveAnchor.col
    const { dr: prevDr, dc: prevDc } = get().selectionMoveDelta

    if (newDr === prevDr && newDc === prevDc) return

    // Build the new ghost at the updated offset
    const newGhost: GhostCell[] = selectionClipboard
      .map(({ row: r, col: c, cell }) => ({
        row: r + newDr,
        col: c + newDc,
        cell: { ...cell },
      }))
      .filter(g => g.row >= 0 && g.row < WORLD_ROWS && g.col >= 0 && g.col < WORLD_COLS)

    const origRows = selectionClipboard.map(e => e.row)
    const origCols = selectionClipboard.map(e => e.col)
    const newStartRow = Math.min(...origRows) + newDr
    const newStartCol = Math.min(...origCols) + newDc
    const newEndRow   = Math.max(...origRows) + newDr
    const newEndCol   = Math.max(...origCols) + newDc

    set({
      selectionMoveDelta: { dr: newDr, dc: newDc },
      duplicateGhost: newGhost,
      selection: { startRow: newStartRow, startCol: newStartCol, endRow: newEndRow, endCol: newEndCol },
      duplicateGhostSelection: { startRow: newStartRow, startCol: newStartCol, endRow: newEndRow, endCol: newEndCol },
      anchorRow: newStartRow,
      anchorCol: newStartCol,
      // grid stays as selectionBaseGrid — never modified during drag
    })
  },

  moveSelectionCommit: () => {
    const { selectionClipboard, selectionBaseGrid, selectionMoveDelta } = get()

    if (!selectionClipboard || !selectionBaseGrid) {
      set({
        selectionClipboard: null,
        selectionMoveAnchor: null,
        selectionMoveDelta: { dr: 0, dc: 0 },
        selectionBaseGrid: null,
      })
      return
    }

    // Apply the ghost at the final delta onto the base grid
    const { dr, dc } = selectionMoveDelta
    const ghost: GhostCell[] = selectionClipboard.map(({ row: r, col: c, cell }) => ({
      row: r + dr,
      col: c + dc,
      cell,
    }))

    // Record what the base grid has at the new drop positions BEFORE applying
    // the ghost — these are the tiles that will be "under" the selection after
    // this commit, and must be restored if the user moves the selection again.
    const newUnderGrid = selectionClipboard
      .map(({ row: r, col: c }) => {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nr >= WORLD_ROWS || nc < 0 || nc >= WORLD_COLS) return null
        return { row: nr, col: nc, cell: { ...selectionBaseGrid[nr][nc] } }
      })
      .filter((s): s is { row: number; col: number; cell: GridCell } => s !== null)

    const committed = applyGhost(selectionBaseGrid, ghost)

    // Rebuild snapshot at new positions for any subsequent move.
    const newSnapshot = selectionClipboard
      .map(({ row: r, col: c, cell }) => {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nr >= WORLD_ROWS || nc < 0 || nc >= WORLD_COLS) return null
        return { row: nr, col: nc, cell: { ...cell } }
      })
      .filter((s): s is { row: number; col: number; cell: GridCell } => s !== null)

    set({
      grid: committed,
      selectionClipboard: null,
      selectionMoveAnchor: null,
      selectionMoveDelta: { dr: 0, dc: 0 },
      selectionBaseGrid: null,
      duplicateGhost: null,
      duplicateGhostSelection: null,
      duplicateGhostLayer: null,
      selectionSnapshot: newSnapshot,
      selectionUnderGrid: newUnderGrid,
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
      selectionBaseGrid: null,
      selectionSnapshot: null,
      selectionUnderGrid: null,
      duplicateGhost: null,
      duplicateGhostSelection: null,
      duplicateGhostLayer: null,
    })
  },
}))