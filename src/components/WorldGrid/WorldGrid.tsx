import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, extend, useApplication } from '@pixi/react'
import { Graphics, Assets, Texture, Sprite, Container, Rectangle } from 'pixi.js'

import { useGridStore, TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '../../stores/gridStore'
import { getItemById } from '../../data/items'

extend({ Graphics, Sprite, Container })


const ATLAS_BASE = '/assets/'
const atlasTextureCache = new Map<string, Texture>()
const frameTextureCache = new Map<number, Texture>()

async function getItemTexture(id: number): Promise<Texture | null> {
  if (frameTextureCache.has(id)) return frameTextureCache.get(id) as Texture

  const item = getItemById(id)
  if (!item) return null

  let atlasTexture = atlasTextureCache.get(item.atlas)
  if (!atlasTexture) {
    atlasTexture = await Assets.load<Texture>(`${ATLAS_BASE}${item.atlas}`)
    atlasTextureCache.set(item.atlas, atlasTexture)
  }

  const resolvedAtlas = atlasTexture!
  const flippedY = resolvedAtlas.height - item.y - item.h

  const frame = new Texture({
    source: resolvedAtlas.source,
    frame: new Rectangle(item.x, flippedY, item.w, item.h),
  })

  frameTextureCache.set(id, frame)
  return frame
}

export default function WorldGrid() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
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

function placeSpriteInTile(
  sprite: Sprite,
  cellX: number,
  cellY: number,
  tileW: number,
  tileH: number,
) {
  const naturalW = sprite.texture.width
  const naturalH = sprite.texture.height
  const scale = Math.min(tileW / naturalW, tileH / naturalH)
  const drawW = naturalW * scale
  const drawH = naturalH * scale
  sprite.width = drawW
  sprite.height = drawH
  sprite.x = cellX + (tileW - drawW) / 2
  sprite.y = cellY + (tileH - drawH)
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

  // ── Sync zoom FROM store — zoom toward canvas center ──────────────────────
  const prevStoreZoomRef = useRef(storeZoom)

  // Keep a stable ref to current offset/zoom so the effect below can read
  // them without being re-triggered on every render.
  const offsetRef = useRef(offset)
  const zoomRef = useRef(zoom)
  useEffect(() => { offsetRef.current = offset }, [offset])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    if (Math.abs(storeZoom - prevStoreZoomRef.current) < 0.001) return

    const prevZoom = prevStoreZoomRef.current
    prevStoreZoomRef.current = storeZoom

    // Zoom toward the centre of the canvas
    const cx = canvasWidth / 2
    const cy = canvasHeight / 2
    const prev = offsetRef.current

    setOffset({
      x: cx - (cx - prev.x) * (storeZoom / prevZoom),
      y: cy - (cy - prev.y) * (storeZoom / prevZoom),
    })
    setZoom(storeZoom)
  }, [storeZoom, canvasWidth, canvasHeight])

  // ── Texture loading ───────────────────────────────────────────────────────
  useEffect(() => {
    const itemIds = new Set<number>()
    for (const row of grid) {
      for (const cell of row) {
        if (cell.fg !== 0) itemIds.add(cell.fg)
        if (cell.bg !== 0) itemIds.add(cell.bg)
      }
    }
    if (duplicateGhost) {
      for (const { cell } of duplicateGhost) {
        if (cell.fg !== 0) itemIds.add(cell.fg)
        if (cell.bg !== 0) itemIds.add(cell.bg)
      }
    }

    Promise.all(
      [...itemIds].map(async id => {
        const texture = await getItemTexture(id)
        return texture ? [id, texture] as [number, Texture] : null
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
        const cellX = offset.x + col * tileW
        const cellY = offset.y + row * tileH

        if (cellX + tileW < 0 || cellX > canvasWidth || cellY + tileH < 0 || cellY > canvasHeight) continue

        for (const id of [cell.bg, cell.fg]) {
          if (id === 0) continue
          const texture = textures.get(id)
          if (!texture) continue
          const sprite = new Sprite(texture)
          sprite.roundPixels = true
          placeSpriteInTile(sprite, cellX, cellY, tileW, tileH)
          c.addChild(sprite)
        }
      }
    }
  }, [grid, offset, zoom, canvasWidth, canvasHeight, textures])

  // ── Ghost sprite rendering ────────────────────────────────────────────────
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
      const cellX = offset.x + col * tileW
      const cellY = offset.y + row * tileH

      if (cellX + tileW < 0 || cellX > canvasWidth || cellY + tileH < 0 || cellY > canvasHeight) continue

      for (const id of [cell.bg, cell.fg]) {
        if (id === 0) continue
        const texture = textures.get(id)
        if (!texture) continue
        const sprite = new Sprite(texture)
        sprite.roundPixels = true
        placeSpriteInTile(sprite, cellX, cellY, tileW, tileH)
        c.addChild(sprite)
      }
    }
  }, [duplicateGhost, offset, zoom, canvasWidth, canvasHeight, textures])

  // ── Selection overlay ─────────────────────────────────────────────────────
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

  // ── Pointer / touch state ─────────────────────────────────────────────────
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const isDrawing = useRef(false)
  const isSelecting = useRef(false)

  // Pinch state
  const isPinching = useRef(false)
  const lastPinchDist = useRef(0)
  const lastPinchMid = useRef({ x: 0, y: 0 })

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

  // ── Apply a zoom step around an arbitrary canvas point ───────────────────
  const applyZoom = useCallback((newZoom: number, pivotX: number, pivotY: number) => {
    const clamped = Math.min(8, Math.max(minZoomRef.current, newZoom))
    const prevZoom = stateRef.current.zoom
    const prev = stateRef.current.offset

    setOffset({
      x: pivotX - (pivotX - prev.x) * (clamped / prevZoom),
      y: pivotY - (pivotY - prev.y) * (clamped / prevZoom),
    })
    setZoom(clamped)
    setStoreZoom(clamped)
    prevStoreZoomRef.current = clamped
  }, [setStoreZoom])

  // ── Pointer events ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = app?.canvas
    if (!canvas) return

    // ── Pointer (mouse / stylus) ──────────────────────────────────────────

    const onPointerDown = (e: PointerEvent) => {
      // Ignore pointer events that are part of a pinch gesture
      if (e.pointerType === 'touch') return

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
      } else if (activeTool === 'fill') {
        fillGrid(row, col)
      } else if (activeTool === 'draw') {
        isDrawing.current = true
        setCell(row, col)
      } else if (activeTool === 'erase') {
        isDrawing.current = true
        eraseCell(row, col)
      } else if (activeTool === 'picker') {
        pickItem(row, col)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return

      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { row, col } = screenToCell(sx, sy)

      if (isMovingSelection.current) {
        if (inBounds(row, col)) moveSelectionUpdate(row, col)
        return
      }

      if (inBounds(row, col)) setMouseGridPosition(col, row)

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

      if (!isDrawing.current || !inBounds(row, col)) return

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

    // ── Touch events (mobile) ─────────────────────────────────────────────

    const getTouchPos = (t: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }

    const getPinchDist = (t0: Touch, t1: Touch) => {
      const dx = t1.clientX - t0.clientX
      const dy = t1.clientY - t0.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getPinchMid = (t0: Touch, t1: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (t0.clientX + t1.clientX) / 2 - rect.left,
        y: (t0.clientY + t1.clientY) / 2 - rect.top,
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Two fingers — begin pinch; cancel any ongoing draw/pan
        e.preventDefault()
        isPinching.current = true
        isDrawing.current = false
        isPanning.current = false
        isSelecting.current = false

        const t0 = e.touches[0]
        const t1 = e.touches[1]
        lastPinchDist.current = getPinchDist(t0, t1)
        lastPinchMid.current = getPinchMid(t0, t1)
        return
      }

      if (e.touches.length === 1 && !isPinching.current) {
        // Single finger — mirror pointer-down logic
        e.preventDefault()
        const touch = e.touches[0]
        const pos = getTouchPos(touch)
        const { row, col } = screenToCell(pos.x, pos.y)
        const { activeTool } = stateRef.current

        const { selection } = useGridStore.getState()
        if (activeTool === 'select' && selection &&
            row >= selection.startRow && row <= selection.endRow &&
            col >= selection.startCol && col <= selection.endCol) {
          isMovingSelection.current = true
          moveSelectionStart(row, col)
          return
        }

        if (activeTool === 'move') {
          isPanning.current = true
          lastMouse.current = { x: touch.clientX, y: touch.clientY }
          return
        }

        if (!inBounds(row, col)) return

        if (activeTool === 'select') {
          isSelecting.current = true
          startSelection(row, col)
        } else if (activeTool === 'fill') {
          fillGrid(row, col)
        } else if (activeTool === 'draw') {
          isDrawing.current = true
          setCell(row, col)
        } else if (activeTool === 'erase') {
          isDrawing.current = true
          eraseCell(row, col)
        } else if (activeTool === 'picker') {
          pickItem(row, col)
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 2 && isPinching.current) {
        const t0 = e.touches[0]
        const t1 = e.touches[1]
        const newDist = getPinchDist(t0, t1)
        const newMid = getPinchMid(t0, t1)

        const factor = newDist / lastPinchDist.current
        const newZoom = Math.min(8, Math.max(minZoomRef.current, stateRef.current.zoom * factor))

        // Pan by midpoint delta
        const dx = newMid.x - lastPinchMid.current.x
        const dy = newMid.y - lastPinchMid.current.y
        const prev = stateRef.current.offset
        const prevZoom = stateRef.current.zoom

        const newOffset = {
          x: newMid.x - (newMid.x - prev.x) * (newZoom / prevZoom) + dx,
          y: newMid.y - (newMid.y - prev.y) * (newZoom / prevZoom) + dy,
        }

        setOffset(newOffset)
        setZoom(newZoom)
        setStoreZoom(newZoom)
        prevStoreZoomRef.current = newZoom

        lastPinchDist.current = newDist
        lastPinchMid.current = newMid
        return
      }

      if (e.touches.length === 1 && !isPinching.current) {
        const touch = e.touches[0]
        const pos = getTouchPos(touch)
        const { row, col } = screenToCell(pos.x, pos.y)

        if (isMovingSelection.current) {
          if (inBounds(row, col)) moveSelectionUpdate(row, col)
          return
        }

        if (inBounds(row, col)) setMouseGridPosition(col, row)

        if (isPanning.current) {
          const dx = touch.clientX - lastMouse.current.x
          const dy = touch.clientY - lastMouse.current.y
          lastMouse.current = { x: touch.clientX, y: touch.clientY }
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
          return
        }

        if (isSelecting.current) {
          if (inBounds(row, col)) updateSelection(row, col)
          return
        }

        if (!isDrawing.current || !inBounds(row, col)) return
        const { activeTool } = stateRef.current
        if (activeTool === 'draw') setCell(row, col)
        else if (activeTool === 'erase') eraseCell(row, col)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        // Released one or both fingers from a pinch
        if (isPinching.current) {
          isPinching.current = false
          // Small delay so the remaining finger doesn't accidentally draw
          setTimeout(() => {
            isDrawing.current = false
            isPanning.current = false
          }, 50)
          return
        }
      }

      if (e.touches.length === 0) {
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
    }

    // ── Wheel (desktop scroll-to-zoom) ────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      applyZoom(stateRef.current.zoom * factor, mx, my)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    // Touch listeners on canvas with { passive: false } so we can preventDefault
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [
    app, applyZoom,
    setCell, eraseCell, fillGrid, pickItem,
    startSelection, updateSelection, endSelection,
    setMouseGridPosition, setStoreZoom,
    moveSelectionStart, moveSelectionUpdate, moveSelectionCommit,
  ])

  // ── Cursor style ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = app?.canvas
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