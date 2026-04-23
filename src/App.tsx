import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, FabricImage, PencilBrush, Point } from 'fabric'
import './App.css'
import { FRAME_PRESETS, createDefaultCodeBlockProps } from './features/whiteboard/constants'
import { WorkspaceOverlay } from './features/whiteboard/components/WorkspaceOverlay'
import { CodeShapeCard } from './features/whiteboard/components/CodeShapeCard'
import { usePyodideRuntime } from './features/whiteboard/hooks/usePyodideRuntime'
import { useRecording } from './features/whiteboard/hooks/useRecording'
import { RuntimeContext } from './features/whiteboard/runtime'
import type {
  CodeBlock,
  CodeBlockProps,
  FrameInteraction,
  FramePreset,
  FrameResizeHandle,
  RecordingFrame,
  RuntimeContextValue,
  ViewportState,
  WhiteboardTool,
} from './features/whiteboard/types'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 4
const MAX_HISTORY = 100
const DEFAULT_BRUSH_COLOR = '#2563eb'
const DEFAULT_BRUSH_WIDTH = 4

type HistorySnapshot = {
  canvasJson: string
  codeBlocks: CodeBlock[]
}

function createCodeBlock(x: number, y: number): CodeBlock {
  return {
    id: crypto.randomUUID(),
    x,
    y,
    props: createDefaultCodeBlockProps(),
  }
}

function cloneCodeBlocks(blocks: CodeBlock[]) {
  return blocks.map((block) => ({
    ...block,
    props: {
      ...block.props,
    },
  }))
}

function App() {
  const initialCodeBlocks = useMemo<CodeBlock[]>(() => [createCodeBlock(120, 120)], [])
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const codeBlocksRef = useRef<CodeBlock[]>(initialCodeBlocks)
  const toolRef = useRef<WhiteboardTool>('draw')
  const brushColorRef = useRef(DEFAULT_BRUSH_COLOR)
  const brushWidthRef = useRef(DEFAULT_BRUSH_WIDTH)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const frameInteractionRef = useRef<FrameInteraction | null>(null)
  const historyDebounceRef = useRef<number | null>(null)
  const undoStackRef = useRef<HistorySnapshot[]>([])
  const redoStackRef = useRef<HistorySnapshot[]>([])
  const isRestoringHistoryRef = useRef(false)
  const codeBlockInteractionRef = useRef<
    | {
        kind: 'move'
        pointerId: number
        startX: number
        startY: number
        block: CodeBlock
      }
    | {
        kind: 'resize'
        pointerId: number
        startX: number
        startY: number
        block: CodeBlock
      }
    | null
  >(null)

  const [framePreset, setFramePreset] = useState<FramePreset>(FRAME_PRESETS[0])
  const [frame, setFrame] = useState<RecordingFrame>({ x: 80, y: 110, width: 405, height: 720 })
  const [showFrame, setShowFrame] = useState(false)
  const [lockFrameAspectRatio, setLockFrameAspectRatio] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [tool, setTool] = useState<WhiteboardTool>('draw')
  const [showGrid, setShowGrid] = useState(true)
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR)
  const [brushWidth, setBrushWidth] = useState(DEFAULT_BRUSH_WIDTH)
  const [viewport, setViewport] = useState<ViewportState>({ zoom: 1, panX: 0, panY: 0 })
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>(initialCodeBlocks)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    codeBlocksRef.current = codeBlocks
  }, [codeBlocks])

  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    brushColorRef.current = brushColor
  }, [brushColor])

  useEffect(() => {
    brushWidthRef.current = brushWidth
  }, [brushWidth])

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 1,
      canRedo: redoStackRef.current.length > 0,
    })
  }, [])

  const createSnapshot = useCallback((): HistorySnapshot | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    return {
      canvasJson: JSON.stringify(canvas.toDatalessJSON()),
      codeBlocks: cloneCodeBlocks(codeBlocksRef.current),
    }
  }, [])

  const pushSnapshot = useCallback((snapshot: HistorySnapshot | null) => {
    if (!snapshot || isRestoringHistoryRef.current) return

    const lastSnapshot = undoStackRef.current.at(-1)
    const sameCanvas = lastSnapshot?.canvasJson === snapshot.canvasJson
    const sameBlocks = JSON.stringify(lastSnapshot?.codeBlocks ?? []) === JSON.stringify(snapshot.codeBlocks)
    if (sameCanvas && sameBlocks) return

    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-MAX_HISTORY)
    redoStackRef.current = []
    syncHistoryState()
  }, [syncHistoryState])

  const captureHistorySnapshot = useCallback(() => {
    pushSnapshot(createSnapshot())
  }, [createSnapshot, pushSnapshot])

  const scheduleHistorySnapshot = useCallback(() => {
    if (isRestoringHistoryRef.current) return
    if (historyDebounceRef.current) {
      window.clearTimeout(historyDebounceRef.current)
    }
    historyDebounceRef.current = window.setTimeout(() => {
      historyDebounceRef.current = null
      captureHistorySnapshot()
    }, 250)
  }, [captureHistorySnapshot])

  const syncViewportState = useCallback((canvas: Canvas) => {
    const transform = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    setViewport({
      zoom: canvas.getZoom(),
      panX: transform[4],
      panY: transform[5],
    })
  }, [])

  const getViewportCenterInScene = useCallback(() => {
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 320, y: 240 }

    return {
      x: (bounds.width / 2 - viewport.panX) / viewport.zoom,
      y: (bounds.height / 2 - viewport.panY) / viewport.zoom,
    }
  }, [viewport.panX, viewport.panY, viewport.zoom])

  const applyCanvasMode = useCallback((canvas: Canvas, nextTool: WhiteboardTool) => {
    const isSelectMode = nextTool === 'select'
    canvas.isDrawingMode = nextTool === 'draw'
    canvas.selection = isSelectMode
    canvas.skipTargetFind = !isSelectMode

    canvas.forEachObject((object) => {
      const isImage = object.type === 'image'
      object.selectable = isSelectMode && isImage
      object.evented = isSelectMode && isImage
      object.hoverCursor = isSelectMode && isImage ? 'move' : 'default'
      object.lockRotation = true
    })

    if (!isSelectMode) {
      canvas.discardActiveObject()
    }

    canvas.requestRenderAll()
  }, [])

  const resetViewport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.requestRenderAll()
    syncViewportState(canvas)
  }, [syncViewportState])

  const zoomByFactor = useCallback((factor: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const centerPoint = canvas.getCenterPoint()
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * factor))
    canvas.zoomToPoint(new Point(centerPoint.x, centerPoint.y), nextZoom)
    syncViewportState(canvas)
  }, [syncViewportState])

  const restoreSnapshot = useCallback(async (snapshot: HistorySnapshot) => {
    const canvas = canvasRef.current
    if (!canvas) return

    isRestoringHistoryRef.current = true
    await canvas.loadFromJSON(JSON.parse(snapshot.canvasJson))
    canvas.backgroundColor = '#f7f3ea'
    applyCanvasMode(canvas, tool)
    canvas.requestRenderAll()
    setCodeBlocks(cloneCodeBlocks(snapshot.codeBlocks))

    queueMicrotask(() => {
      isRestoringHistoryRef.current = false
      syncHistoryState()
    })
  }, [applyCanvasMode, syncHistoryState, tool])

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length < 2) return

    const currentSnapshot = undoStackRef.current.at(-1)
    const previousSnapshot = undoStackRef.current.at(-2)
    if (!currentSnapshot || !previousSnapshot) return

    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current, currentSnapshot]
    void restoreSnapshot(previousSnapshot)
  }, [restoreSnapshot])

  const handleRedo = useCallback(() => {
    const nextSnapshot = redoStackRef.current.at(-1)
    if (!nextSnapshot) return

    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current, nextSnapshot]
    void restoreSnapshot(nextSnapshot)
  }, [restoreSnapshot])

  const addImageToCanvas = useCallback(async (src: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const image = await FabricImage.fromURL(src)
    const center = getViewportCenterInScene()
    const width = image.width ?? 320
    const height = image.height ?? 240
    const maxWidth = 520
    const maxHeight = 420
    const scale = Math.min(maxWidth / width, maxHeight / height, 1)

    image.set({
      left: center.x - (width * scale) / 2,
      top: center.y - (height * scale) / 2,
      selectable: tool === 'select',
      evented: tool === 'select',
      lockRotation: true,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#2563eb',
      cornerColor: '#2563eb',
    })
    image.scale(scale)
    canvas.add(image)
    canvas.setActiveObject(image)
    applyCanvasMode(canvas, tool)
    canvas.requestRenderAll()
    captureHistorySnapshot()
  }, [applyCanvasMode, captureHistorySnapshot, getViewportCenterInScene, tool])

  const handleImageFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    for (const file of imageFiles) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      await addImageToCanvas(dataUrl)
    }
  }, [addImageToCanvas])

  useEffect(() => {
    const canvasElement = canvasElementRef.current
    const workspace = workspaceRef.current
    if (!canvasElement || !workspace) return

    const canvas = new Canvas(canvasElement, {
      backgroundColor: '#f7f3ea',
      preserveObjectStacking: true,
      selection: false,
    })
    canvasRef.current = canvas

    const brush = new PencilBrush(canvas)
    brush.color = brushColorRef.current
    brush.width = brushWidthRef.current
    canvas.freeDrawingBrush = brush

    const interactionSurface = canvas.upperCanvasEl

    const resizeCanvas = () => {
      const bounds = workspace.getBoundingClientRect()
      canvas.setDimensions({ width: bounds.width, height: bounds.height })
      canvas.requestRenderAll()
      syncViewportState(canvas)
    }

    const handlePathCreated = ({ path }: { path?: { selectable?: boolean; evented?: boolean; lockRotation?: boolean } }) => {
      if (path) {
        path.selectable = false
        path.evented = false
        path.lockRotation = true
      }
      captureHistorySnapshot()
    }

    const handleObjectModified = () => {
      captureHistorySnapshot()
    }

    resizeCanvas()
    applyCanvasMode(canvas, toolRef.current)
    canvas.on('path:created', handlePathCreated)
    canvas.on('object:modified', handleObjectModified)
    captureHistorySnapshot()

    let isPanning = false
    let lastClientX = 0
    let lastClientY = 0

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const pointer = canvas.getScenePoint(event)
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * (0.9985 ** event.deltaY)))
      canvas.zoomToPoint(new Point(pointer.x, pointer.y), nextZoom)
      syncViewportState(canvas)
    }

    const handlePointerDown = (event: PointerEvent) => {
      const shouldPan = event.button === 1
      if (!shouldPan) return

      event.preventDefault()
      isPanning = true
      lastClientX = event.clientX
      lastClientY = event.clientY
      applyCanvasMode(canvas, 'pan')
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPanning) return

      const transform = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      transform[4] += event.clientX - lastClientX
      transform[5] += event.clientY - lastClientY
      lastClientX = event.clientX
      lastClientY = event.clientY
      canvas.setViewportTransform(transform)
      canvas.requestRenderAll()
      syncViewportState(canvas)
    }

    const stopPanning = () => {
      if (!isPanning) return
      isPanning = false
      applyCanvasMode(canvas, toolRef.current)
    }

    interactionSurface.addEventListener('wheel', handleWheel, { passive: false })
    interactionSurface.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopPanning)
    window.addEventListener('resize', resizeCanvas)

    return () => {
      if (historyDebounceRef.current) {
        window.clearTimeout(historyDebounceRef.current)
      }
      canvas.off('path:created', handlePathCreated)
      canvas.off('object:modified', handleObjectModified)
      interactionSurface.removeEventListener('wheel', handleWheel)
      interactionSurface.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopPanning)
      window.removeEventListener('resize', resizeCanvas)
      canvas.dispose()
      canvasRef.current = null
    }
  }, [applyCanvasMode, captureHistorySnapshot, syncViewportState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.freeDrawingBrush) return

    canvas.freeDrawingBrush.color = brushColor
    canvas.freeDrawingBrush.width = brushWidth
    applyCanvasMode(canvas, tool)
  }, [applyCanvasMode, brushColor, brushWidth, tool])

  useEffect(() => {
    if (undoStackRef.current.length === 0 || isRestoringHistoryRef.current) return
    scheduleHistorySnapshot()
  }, [codeBlocks, scheduleHistorySnapshot])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest('input, textarea, [contenteditable="true"], .cm-editor, .cm-content'))
    }

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items || items.length === 0) return

      const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'))
      if (imageItems.length === 0) return

      event.preventDefault()
      void handleImageFiles(imageItems.map((item) => item.getAsFile()).filter((file): file is File => Boolean(file)))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      if (key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('paste', handlePaste)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleImageFiles, handleRedo, handleUndo])

  const clampFrame = useCallback((next: RecordingFrame) => {
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return next

    const width = Math.max(160, Math.min(next.width, bounds.width))
    const height = Math.max(120, Math.min(next.height, bounds.height))
    const maxX = Math.max(0, bounds.width - width)
    const maxY = Math.max(0, bounds.height - height)

    return {
      ...next,
      width,
      height,
      x: Math.min(Math.max(0, next.x), maxX),
      y: Math.min(Math.max(60, next.y), Math.max(60, maxY)),
    }
  }, [])

  const fitFrameToWorkspace = useCallback((preset: FramePreset) => {
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return

    const usableWidth = bounds.width * 0.42
    const usableHeight = bounds.height * 0.7
    const ratio = preset.width / preset.height

    let width = usableWidth
    let height = width / ratio

    if (height > usableHeight) {
      height = usableHeight
      width = height * ratio
    }

    setFrame({
      x: (bounds.width - width) / 2,
      y: Math.max(96, (bounds.height - height) / 2),
      width,
      height,
    })
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (showFrame && lockFrameAspectRatio) {
        fitFrameToWorkspace(framePreset)
      } else {
        setFrame((current) => clampFrame(current))
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampFrame, fitFrameToWorkspace, framePreset, lockFrameAspectRatio, showFrame])

  const { runtimeStatus, runtimeError, runCode } = usePyodideRuntime(codeBlocksRef, setCodeBlocks)
  const runtimeValue = useMemo<RuntimeContextValue>(
    () => ({
      status: runtimeStatus,
      error: runtimeError,
      runCode,
    }),
    [runCode, runtimeError, runtimeStatus],
  )

  const { isRecording, startRecording, stopRecording } = useRecording({
    workspaceRef,
    frame,
    framePreset,
    showFrame,
    clampFrame,
  })

  const bringCodeBlockToFront = useCallback((blockId: string) => {
    setCodeBlocks((current) => {
      const block = current.find((candidate) => candidate.id === blockId)
      if (!block) return current
      return [...current.filter((candidate) => candidate.id !== blockId), block]
    })
  }, [])

  const handleAddCodeBlock = useCallback(() => {
    const center = getViewportCenterInScene()
    setCodeBlocks((current) => [...current, createCodeBlock(center.x - 260, center.y - 180)])
  }, [getViewportCenterInScene])

  const updateCodeBlockProps = useCallback((blockId: string, partial: Partial<CodeBlockProps>) => {
    setCodeBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              props: {
                ...block.props,
                ...partial,
              },
            }
          : block,
      ),
    )
  }, [])

  const deleteCodeBlock = useCallback((blockId: string) => {
    setCodeBlocks((current) => current.filter((block) => block.id !== blockId))
  }, [])

  const clearInk = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const inkObjects = canvas.getObjects().filter((object) => object.type !== 'image')
    inkObjects.forEach((object) => canvas.remove(object))
    canvas.requestRenderAll()
    captureHistorySnapshot()
  }, [captureHistorySnapshot])

  const handleImageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return
    void handleImageFiles(event.target.files)
    event.target.value = ''
  }, [handleImageFiles])

  const handleToggleFrameVisibility = useCallback(() => {
    if (!showFrame && lockFrameAspectRatio) {
      fitFrameToWorkspace(framePreset)
    }
    setShowFrame((value) => !value)
  }, [fitFrameToWorkspace, framePreset, lockFrameAspectRatio, showFrame])

  const handleToggleFrameAspectRatio = useCallback(() => {
    const nextValue = !lockFrameAspectRatio
    setLockFrameAspectRatio(nextValue)
    if (nextValue && showFrame) {
      fitFrameToWorkspace(framePreset)
    }
  }, [fitFrameToWorkspace, framePreset, lockFrameAspectRatio, showFrame])

  const handleFrameDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.recording-frame__handle')) return

    event.preventDefault()
    frameInteractionRef.current = {
      kind: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originFrame: frame,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [frame])

  const handleFrameResizeStart = useCallback((handle: FrameResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    frameInteractionRef.current = {
      kind: 'resize',
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originFrame: frame,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [frame])

  const handleFramePointerMove = useCallback((event: PointerEvent) => {
    const interaction = frameInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (interaction.kind === 'move') {
      setFrame(
        clampFrame({
          ...interaction.originFrame,
          x: interaction.originFrame.x + (event.clientX - interaction.startX),
          y: interaction.originFrame.y + (event.clientY - interaction.startY),
        }),
      )
      return
    }

    const dx = event.clientX - interaction.startX
    const dy = event.clientY - interaction.startY
    const origin = interaction.originFrame
    const ratio = framePreset.width / framePreset.height

    if (lockFrameAspectRatio) {
      const widthDelta = interaction.handle.includes('w') ? -dx : dx
      const heightDelta = interaction.handle.includes('n') ? -dy : dy
      const widthFromX = Math.max(160, origin.width + widthDelta)
      const widthFromY = Math.max(160, (origin.height + heightDelta) * ratio)
      const width = Math.abs(dx) >= Math.abs(dy) ? widthFromX : widthFromY
      const height = width / ratio

      setFrame(
        clampFrame({
          width,
          height,
          x: interaction.handle.includes('w') ? origin.x + (origin.width - width) : origin.x,
          y: interaction.handle.includes('n') ? origin.y + (origin.height - height) : origin.y,
        }),
      )
      return
    }

    let x = origin.x
    let y = origin.y
    let width = origin.width
    let height = origin.height

    if (interaction.handle.includes('e')) width = origin.width + dx
    if (interaction.handle.includes('s')) height = origin.height + dy
    if (interaction.handle.includes('w')) {
      width = origin.width - dx
      x = origin.x + dx
    }
    if (interaction.handle.includes('n')) {
      height = origin.height - dy
      y = origin.y + dy
    }

    setFrame(clampFrame({ x, y, width, height }))
  }, [clampFrame, framePreset.height, framePreset.width, lockFrameAspectRatio])

  const handleFramePointerUp = useCallback((event: PointerEvent) => {
    if (frameInteractionRef.current?.pointerId === event.pointerId) {
      frameInteractionRef.current = null
    }
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', handleFramePointerMove)
    window.addEventListener('pointerup', handleFramePointerUp)

    return () => {
      window.removeEventListener('pointermove', handleFramePointerMove)
      window.removeEventListener('pointerup', handleFramePointerUp)
    }
  }, [handleFramePointerMove, handleFramePointerUp])

  const handleCodeBlockPointerMove = useCallback((event: PointerEvent) => {
    const interaction = codeBlockInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    const dx = (event.clientX - interaction.startX) / viewport.zoom
    const dy = (event.clientY - interaction.startY) / viewport.zoom

    setCodeBlocks((current) =>
      current.map((block) => {
        if (block.id !== interaction.block.id) return block

        if (interaction.kind === 'move') {
          return {
            ...block,
            x: interaction.block.x + dx,
            y: interaction.block.y + dy,
          }
        }

        return {
          ...block,
          props: {
            ...block.props,
            w: Math.max(340, interaction.block.props.w + dx),
            h: Math.max(220, interaction.block.props.h + dy),
          },
        }
      }),
    )
  }, [viewport.zoom])

  const handleCodeBlockPointerUp = useCallback((event: PointerEvent) => {
    if (codeBlockInteractionRef.current?.pointerId === event.pointerId) {
      codeBlockInteractionRef.current = null
      captureHistorySnapshot()
    }
  }, [captureHistorySnapshot])

  useEffect(() => {
    window.addEventListener('pointermove', handleCodeBlockPointerMove)
    window.addEventListener('pointerup', handleCodeBlockPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleCodeBlockPointerMove)
      window.removeEventListener('pointerup', handleCodeBlockPointerUp)
    }
  }, [handleCodeBlockPointerMove, handleCodeBlockPointerUp])

  const gridStyle = useMemo(
    () => ({
      backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
      backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
    }),
    [viewport.panX, viewport.panY, viewport.zoom],
  )

  return (
    <RuntimeContext.Provider value={runtimeValue}>
      <div className="app-shell">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="workspace-hidden-input"
          onChange={handleImageInputChange}
        />

        <div className="workspace" ref={workspaceRef}>
          <div className="whiteboard-surface">
            <div
              className={`whiteboard-grid ${showGrid ? 'whiteboard-grid--visible' : ''}`}
              style={showGrid ? gridStyle : undefined}
            />
            <canvas ref={canvasElementRef} className={`whiteboard-canvas whiteboard-canvas--${tool}`} />

            <div className="code-blocks-overlay">
              {codeBlocks.map((block) => {
                const screenLeft = viewport.panX + block.x * viewport.zoom
                const screenTop = viewport.panY + block.y * viewport.zoom

                return (
                  <CodeShapeCard
                    key={block.id}
                    block={block}
                    style={{
                      left: screenLeft,
                      top: screenTop,
                      width: block.props.w,
                      height: block.props.h,
                      transform: `scale(${viewport.zoom})`,
                      transformOrigin: 'top left',
                    }}
                    onFocus={() => bringCodeBlockToFront(block.id)}
                    onDelete={() => deleteCodeBlock(block.id)}
                    onUpdateProps={(partial) => updateCodeBlockProps(block.id, partial)}
                    onDragStart={(event) => {
                      event.preventDefault()
                      bringCodeBlockToFront(block.id)
                      codeBlockInteractionRef.current = {
                        kind: 'move',
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        block,
                      }
                    }}
                    onResizeStart={(event) => {
                      event.preventDefault()
                      bringCodeBlockToFront(block.id)
                      codeBlockInteractionRef.current = {
                        kind: 'resize',
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        block,
                      }
                    }}
                  />
                )
              })}
            </div>

            <WorkspaceOverlay
              framePreset={framePreset}
              frame={frame}
              showFrame={showFrame}
              isRecording={isRecording}
              panelOpen={panelOpen}
              lockFrameAspectRatio={lockFrameAspectRatio}
              showGrid={showGrid}
              tool={tool}
              brushColor={brushColor}
              brushWidth={brushWidth}
              zoomPercentage={Math.round(viewport.zoom * 100)}
              canUndo={historyState.canUndo}
              canRedo={historyState.canRedo}
              onToggleGrid={() => setShowGrid((value) => !value)}
              onToolChange={setTool}
              onBrushColorChange={setBrushColor}
              onBrushWidthChange={setBrushWidth}
              onClearBoard={clearInk}
              onAddCodeBlock={handleAddCodeBlock}
              onAddImage={() => imageInputRef.current?.click()}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onZoomIn={() => zoomByFactor(1.12)}
              onZoomOut={() => zoomByFactor(1 / 1.12)}
              onResetView={resetViewport}
              onToggleFrameVisibility={handleToggleFrameVisibility}
              onToggleFrameAspectRatio={handleToggleFrameAspectRatio}
              onTogglePanel={() => setPanelOpen((value) => !value)}
              onFramePresetChange={(preset) => {
                setFramePreset(preset)
                setShowFrame(true)
                if (lockFrameAspectRatio) {
                  fitFrameToWorkspace(preset)
                }
              }}
              onStartRecording={() => {
                void startRecording()
              }}
              onStopRecording={stopRecording}
              onRecenterFrame={() => fitFrameToWorkspace(framePreset)}
              onFrameDragStart={handleFrameDragStart}
              onFrameResizeStart={handleFrameResizeStart}
            />
          </div>
        </div>

        <div className="workspace-footer">
          <span>Wheel zooms, middle-mouse drag pans, pointer mode edits images, and you can paste or upload images onto the board.</span>
          <span>
            {runtimeStatus === 'error'
              ? runtimeError
              : 'Undo and redo support Ctrl/Cmd+Z, Ctrl/Cmd+Y, and Ctrl/Cmd+Shift+Z.'}
          </span>
        </div>
      </div>
    </RuntimeContext.Provider>
  )
}

export default App
