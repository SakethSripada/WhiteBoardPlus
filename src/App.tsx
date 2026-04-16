import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Editor, Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import './App.css'
import { FRAME_PRESETS } from './features/whiteboard/constants'
import { WorkspaceOverlay } from './features/whiteboard/components/WorkspaceOverlay'
import { CodeBlocksOverlay, TableShapesOverlay } from './features/whiteboard/components/ShapeOverlays'
import { usePyodideRuntime } from './features/whiteboard/hooks/usePyodideRuntime'
import { useRecording } from './features/whiteboard/hooks/useRecording'
import { RuntimeContext } from './features/whiteboard/runtime'
import { addArrow, addCodeBlock, addFlowBlock, addStickyNote, addTable, ensureInitialCodeBlock } from './features/whiteboard/shapeFactories'
import { CodeShapeUtil, TableShapeUtil } from './features/whiteboard/shapeUtils'
import type { FrameInteraction, FramePreset, FrameResizeHandle, RecordingFrame, RuntimeContextValue } from './features/whiteboard/types'
import { UI_COMPONENTS } from './features/whiteboard/uiComponents'

function App() {
  const editorRef = useRef<Editor | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const frameInteractionRef = useRef<FrameInteraction | null>(null)

  const [framePreset, setFramePreset] = useState<FramePreset>(FRAME_PRESETS[0])
  const [frame, setFrame] = useState<RecordingFrame>({ x: 80, y: 110, width: 405, height: 720 })
  const [showFrame, setShowFrame] = useState(false)
  const [lockFrameAspectRatio, setLockFrameAspectRatio] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)

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

  const { runtimeStatus, runtimeError, runCode } = usePyodideRuntime(editorRef)
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

  const toggleGrid = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.updateInstanceState({
      isGridMode: !editor.getInstanceState().isGridMode,
    })
  }, [])

  const handleAddCodeBlock = useCallback(() => {
    const editor = editorRef.current
    if (editor) addCodeBlock(editor)
  }, [])

  const handleAddTable = useCallback(() => {
    const editor = editorRef.current
    if (editor) addTable(editor)
  }, [])

  const handleAddStickyNote = useCallback(() => {
    const editor = editorRef.current
    if (editor) addStickyNote(editor)
  }, [])

  const handleAddFlowBlock = useCallback(() => {
    const editor = editorRef.current
    if (editor) addFlowBlock(editor)
  }, [])

  const handleAddArrow = useCallback(() => {
    const editor = editorRef.current
    if (editor) addArrow(editor)
  }, [])

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

  return (
    <RuntimeContext.Provider value={runtimeValue}>
      <div className="app-shell">
        <div className="workspace" ref={workspaceRef}>
          <Tldraw
            shapeUtils={[CodeShapeUtil, TableShapeUtil]}
            components={UI_COMPONENTS}
            inferDarkMode={false}
            hideUi={false}
            onMount={(editor) => {
              editorRef.current = editor
              editor.updateInstanceState({ isGridMode: true })
              ensureInitialCodeBlock(editor)
            }}
          >
            <CodeBlocksOverlay />
            <TableShapesOverlay />
            <WorkspaceOverlay
              framePreset={framePreset}
              frame={frame}
              showFrame={showFrame}
              isRecording={isRecording}
              panelOpen={panelOpen}
              lockFrameAspectRatio={lockFrameAspectRatio}
              onToggleGrid={toggleGrid}
              onAddCodeBlock={handleAddCodeBlock}
              onAddTable={handleAddTable}
              onAddStickyNote={handleAddStickyNote}
              onAddFlowBlock={handleAddFlowBlock}
              onAddArrow={handleAddArrow}
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
          </Tldraw>
        </div>

        <div className="workspace-footer">
          <span>Draw diagrams, drop Python blocks, and run code inline on one canvas.</span>
          <span>
            {runtimeStatus === 'error'
              ? runtimeError
              : 'The recording frame can be hidden, dragged, resized, and recorded on demand.'}
          </span>
        </div>
      </div>
    </RuntimeContext.Provider>
  )
}

export default App
