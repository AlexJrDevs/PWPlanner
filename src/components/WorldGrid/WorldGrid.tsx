import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, extend, useApplication } from '@pixi/react'
import { Graphics, Assets, Texture, Sprite, Container } from 'pixi.js'

import { useGridStore, TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '../../stores/gridStore'
import { getItemById } from '../../data/items'

extend({ Graphics, Sprite, Container })

const textureCache = new Map<string, Texture>()

async function loadTexture(spritePath: string): Promise<Texture> {
  if (textureCache.has(spritePath)) return textureCache.get(spritePath)!
  const texture = await Assets.load(spritePath)
  textureCache.set(spritePath, texture)
  return texture
}

export default function WorldGrid() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      setSize({ width, height })
    }

    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)

    return () => obs.disconnect()
  }, [])

  if (size.width === 0 || size.height === 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <Application
        width={size.width}
        height={size.height}
        backgroundColor={0x1a1a2e}
        antialias={false}
      >
        <GridRenderer canvasWidth={size.width} canvasHeight={size.height} />
      </Application>
    </div>
  )
}

function GridRenderer({
  canvasWidth,
  canvasHeight,
}: {
  canvasWidth: number
  canvasHeight: number
}) {
  const {
    grid,
    activeTool,
    setCell,
    eraseCell,
    fillGrid,
    pickItem,
    startSelection,
    updateSelection,
    endSelection,
    setMouseGridPosition,
    moveSelectionStart,
    moveSelectionUpdate,
    moveSelectionCommit,
    zoom: storeZoom,
    setZoom: setStoreZoom,
    selection,
    duplicateGhost,
  } = useGridStore()

  const { app } = useApplication()

  const isMovingSelection = useRef(false)

  const fillZoom = useCallback(
    () => ({
      x: canvasWidth / (WORLD_COLS * TILE_SIZE),
      y: canvasHeight / (WORLD_ROWS * TILE_SIZE),
    }),
    [canvasWidth, canvasHeight]
  )

  const [zoom, setZoom] = useState(() => {
    const fz = fillZoom()
    return Math.min(fz.x, fz.y)
  })

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [textures, setTextures] = useState<Map<number, Texture>>(new Map())
  const spriteContainerRef = useRef<Container | null>(null)
  const ghostContainerRef = useRef<Container | null>(null)
  const selectionGfxRef = useRef<Graphics | null>(null)

  // ── Initial fit ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fz = fillZoom()
    const z = Math.min(fz.x, fz.y)
    setZoom(z)
    setStoreZoom(z)
    setOffset({
      x: (canvasWidth - WORLD_COLS * TILE_SIZE * z) / 2,
      y: (canvasHeight - WORLD_ROWS * TILE_SIZE * z) / 2,
    })
  }, [canvasWidth, canvasHeight, fillZoom, setStoreZoom])

  // ── Sync zoom FROM store (toolbar zoom in/out buttons) ────────────────────
  const prevStoreZoomRef = useRef(storeZoom)
  useEffect(() => {
    if (Math.abs(storeZoom - prevStoreZoomRef.current) > 0.001) {
      prevStoreZoomRef.current = storeZoom
      setZoom(storeZoom)
    }
  }, [storeZoom])

  // ── Texture loading ───────────────────────────────────────────────────────
  useEffect(() => {
    const itemIds = new Set<number>()
    for (const row of grid) {
      for (const cell of row) {
        if (cell.fg !== 0) itemIds.add(cell.fg)
        if (cell.bg !== 0) itemIds.add(cell.bg)
      }
    }
    // Also load textures for ghost cells
    if (duplicateGhost) {
      for (const { cell } of duplicateGhost) {
        if (cell.fg !== 0) itemIds.add(cell.fg)
        if (cell.bg !== 0) itemIds.add(cell.bg)
      }
    }

    Promise.all(
      [...itemIds].map(async id => {
        const item = getItemById(id)
        if (!item) return null
        const texture = await loadTexture(item.sprite)
        return [id, texture] as [number, Texture]
      })
    ).then(results => {
      setTextures(prev => {
        const next = new Map(prev)
        for (const r of results) {
          if (r) next.set(r[0], r[1])
        }
        return next
      })
    })
  }, [grid, duplicateGhost])

  // ── Sprite rendering ──────────────────────────────────────────────────────
  useEffect(() => {
    const c = spriteContainerRef.current
    if (!c) return
    c.removeChildren()

    const tileW = TILE_SIZE * zoom
    const tileH = TILE_SIZE * zoom

    for (let row = 0; row < WORLD_ROWS; row++) {
      for (let col = 0; col < WORLD_COLS; col++) {
        const cell = grid[row][col]
        const x = offset.x + col * tileW
        const y = offset.y + row * tileH

        if (x + tileW < 0 || x > canvasWidth || y + tileH < 0 || y > canvasHeight) continue

        for (const id of [cell.bg, cell.fg]) {
          if (id === 0) continue
          const texture = textures.get(id)
          if (!texture) continue
          const sprite = new Sprite(texture)
          sprite.x = x
          sprite.y = y
          sprite.width = tileW
          sprite.height = tileH
          sprite.roundPixels = true
          c.addChild(sprite)
        }
      }
    }
  }, [grid, offset, zoom, canvasWidth, canvasHeight, textures])

  // ── Ghost sprite rendering (duplicate preview) ────────────────────────────
  useEffect(() => {
    const c = ghostContainerRef.current
    if (!c) return
    c.removeChildren()

    if (!duplicateGhost) {
      c.alpha = 1
      return
    }

    const tileW = TILE_SIZE * zoom
    const tileH = TILE_SIZE * zoom

    for (const { row, col, cell } of duplicateGhost) {
      const x = offset.x + col * tileW
      const y = offset.y + row * tileH

      if (x + tileW < 0 || x > canvasWidth || y + tileH < 0 || y > canvasHeight) continue

      for (const id of [cell.bg, cell.fg]) {
        if (id === 0) continue
        const texture = textures.get(id)
        if (!texture) continue
        const sprite = new Sprite(texture)
        sprite.x = x
        sprite.y = y
        sprite.width = tileW
        sprite.height = tileH
        sprite.roundPixels = true
        c.addChild(sprite)
      }
    }
  }, [duplicateGhost, offset, zoom, canvasWidth, canvasHeight, textures])

  // ── Selection overlay rendering ───────────────────────────────────────────
  const drawSelection = useCallback((g: Graphics) => {
    g.clear()
    if (!selection) return

    const tileW = TILE_SIZE * zoom
    const tileH = TILE_SIZE * zoom

    const x = offset.x + selection.startCol * tileW
    const y = offset.y + selection.startRow * tileH
    const w = (selection.endCol - selection.startCol + 1) * tileW
    const h = (selection.endRow - selection.startRow + 1) * tileH

    g.rect(x, y, w, h)
    g.fill({ color: 0x4488ff, alpha: 0.2 })

    g.setStrokeStyle({ width: 2, color: 0x4488ff, alpha: 0.9 })
    g.rect(x, y, w, h)
    g.stroke()
  }, [selection, offset, zoom])

  // ── Pointer events ────────────────────────────────────────────────────────
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const isDrawing = useRef(false)
  const isSelecting = useRef(false)
  const stateRef = useRef({ offset, zoom, activeTool })
  const minZoomRef = useRef(Math.min(
    canvasWidth / (WORLD_COLS * TILE_SIZE),
    canvasHeight / (WORLD_ROWS * TILE_SIZE)
  ))

  useEffect(() => {
    stateRef.current = { offset, zoom, activeTool }
  }, [offset, zoom, activeTool])

  useEffect(() => {
    minZoomRef.current = Math.min(
      canvasWidth / (WORLD_COLS * TILE_SIZE),
      canvasHeight / (WORLD_ROWS * TILE_SIZE)
    )
  }, [canvasWidth, canvasHeight])

  const screenToCell = (sx: number, sy: number) => {
    const { offset, zoom } = stateRef.current
    return {
      row: Math.floor((sy - offset.y) / (TILE_SIZE * zoom)),
      col: Math.floor((sx - offset.x) / (TILE_SIZE * zoom)),
    }
  }

  const inBounds = (row: number, col: number) =>
    row >= 0 && row < WORLD_ROWS && col >= 0 && col < WORLD_COLS

  useEffect(() => {
    const canvas = app?.canvas
    if (!canvas) return

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { row, col } = screenToCell(sx, sy)
      const { activeTool } = stateRef.current

      const { selection } = useGridStore.getState()
      if (activeTool === 'select' && selection &&
          row >= selection.startRow && row <= selection.endRow &&
          col >= selection.startCol && col <= selection.endCol) {
        isMovingSelection.current = true
        moveSelectionStart(row, col)
        return
      }

      if (e.button === 1 || e.button === 2 || activeTool === 'move') {
        isPanning.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
        return
      }

      if (!inBounds(row, col)) return

      if (activeTool === 'select') {
        isSelecting.current = true
        startSelection(row, col)
      }
      else if (activeTool === 'fill') {
        fillGrid(row, col)
      }
      else if (activeTool === 'draw') {
        isDrawing.current = true
        setCell(row, col)
      }
      else if (activeTool === 'erase') {
        isDrawing.current = true
        eraseCell(row, col)
      }
      else if (activeTool === 'picker') {
        pickItem(row, col)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { row, col } = screenToCell(sx, sy)

      if (isMovingSelection.current) {
        if (inBounds(row, col)) moveSelectionUpdate(row, col)
        return
      }

      if (inBounds(row, col)) {
        setMouseGridPosition(col, row)
      }

      if (isPanning.current) {
        const dx = e.clientX - lastMouse.current.x
        const dy = e.clientY - lastMouse.current.y
        lastMouse.current = { x: e.clientX, y: e.clientY }
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
        return
      }

      if (isSelecting.current) {
        if (inBounds(row, col)) updateSelection(row, col)
        return
      }

      if (!isDrawing.current) return
      if (!inBounds(row, col)) return

      const { activeTool } = stateRef.current
      if (activeTool === 'draw') setCell(row, col)
      else if (activeTool === 'erase') eraseCell(row, col)
    }

    const onPointerUp = () => {
      if (isSelecting.current) {
        endSelection()
        isSelecting.current = false
      }
      if (isMovingSelection.current) {
        moveSelectionCommit()
        isMovingSelection.current = false
      }
      isPanning.current = false
      isDrawing.current = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newZoom = Math.min(8, Math.max(minZoomRef.current, stateRef.current.zoom * factor))

      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      setOffset(prev => ({
        x: mx - (mx - prev.x) * (newZoom / stateRef.current.zoom),
        y: my - (my - prev.y) * (newZoom / stateRef.current.zoom),
      }))
      setZoom(newZoom)
      setStoreZoom(newZoom)
      prevStoreZoomRef.current = newZoom
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', e => e.preventDefault())

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [app, setCell, eraseCell, fillGrid, pickItem, startSelection, updateSelection, endSelection, setMouseGridPosition, setStoreZoom])

  // ── Cursor style ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = app.canvas
    if (!canvas) return
    const cursors: Record<string, string> = {
      move: 'grab',
      select: 'crosshair',
      draw: 'cell',
      erase: 'not-allowed',
      picker: 'copy',
      fill: 'cell',
    }
    canvas.style.cursor = cursors[activeTool] ?? 'default'
  }, [activeTool, app])

  // ── Grid lines ────────────────────────────────────────────────────────────
  const drawGridLines = useCallback((g: Graphics) => {
    g.clear()

    const tileW = TILE_SIZE * zoom
    const tileH = TILE_SIZE * zoom

    const startCol = Math.max(0, Math.floor(-offset.x / tileW))
    const endCol   = Math.min(WORLD_COLS, Math.ceil((canvasWidth - offset.x) / tileW))
    const startRow = Math.max(0, Math.floor(-offset.y / tileH))
    const endRow   = Math.min(WORLD_ROWS, Math.ceil((canvasHeight - offset.y) / tileH))

    g.setStrokeStyle({ width: 1, color: 0x333355, alpha: 0.75, alignment: 0.5 })

    for (let col = startCol; col <= endCol; col++) {
      const x = offset.x + col * tileW
      g.moveTo(x, offset.y + startRow * tileH)
      g.lineTo(x, offset.y + endRow * tileH)
    }
    for (let row = startRow; row <= endRow; row++) {
      const y = offset.y + row * tileH
      g.moveTo(offset.x + startCol * tileW, y)
      g.lineTo(offset.x + endCol * tileW, y)
    }
    g.stroke()

    g.setStrokeStyle({ width: 2.5, color: 0xff6600, alpha: 1, alignment: 0.5 })
    g.rect(offset.x, offset.y, WORLD_COLS * tileW, WORLD_ROWS * tileH)
    g.stroke()
  }, [offset, zoom, canvasWidth, canvasHeight])

  return (
    <>
      <pixiContainer ref={spriteContainerRef} />
      <pixiContainer ref={ghostContainerRef} />
      <pixiGraphics draw={drawGridLines} />
      <pixiGraphics ref={selectionGfxRef} draw={drawSelection} />
    </>
  )
}