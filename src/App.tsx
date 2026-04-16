import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import html2canvas from 'html2canvas'
import { loadPyodide } from 'pyodide'
import {
  indentUnit,
} from '@codemirror/language'
import {
  type EditorView,
  keymap,
} from '@codemirror/view'
import {
  BaseBoxShapeUtil,
  DefaultNavigationPanel,
  DefaultStylePanel,
  DefaultToolbar,
  Editor,
  HTMLContainer,
  Rectangle2d,
  Tldraw,
  type TLUiComponents,
  toRichText,
  resizeBox,
  stopEventPropagation,
  useEditor,
  useValue,
} from 'tldraw'
import 'tldraw/tldraw.css'
import './App.css'

type FramePresetId = 'portrait' | 'landscape' | 'square'
type FrameResizeHandle = 'nw' | 'ne' | 'se' | 'sw'
type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error'

type FramePreset = {
  id: FramePresetId
  label: string
  width: number
  height: number
}

type RuntimeContextValue = {
  status: PyodideStatus
  error: string | null
  runCode: (shapeId: string, code: string) => Promise<void>
}

type CodeShapeProps = {
  w: number
  h: number
  code: string
  output: string
  error: string
  title: string
  isRunning: boolean
}

type CodeShape = {
  id: string
  type: 'code'
  x: number
  y: number
  rotation: number
  index: string
  props: CodeShapeProps
}

type TableShapeProps = {
  w: number
  h: number
  title: string
  headers: string[]
  rows: string[][]
}

type TableShape = {
  id: string
  type: 'table'
  x: number
  y: number
  rotation: number
  index: string
  props: TableShapeProps
}

type RecordingFrame = {
  x: number
  y: number
  width: number
  height: number
}

type FrameInteraction =
  | {
      kind: 'move'
      pointerId: number
      startX: number
      startY: number
      originFrame: RecordingFrame
    }
  | {
      kind: 'resize'
      pointerId: number
      startX: number
      startY: number
      originFrame: RecordingFrame
      handle: FrameResizeHandle
    }

type PyodideInstance = Awaited<ReturnType<typeof loadPyodide>>

const FRAME_PRESETS: FramePreset[] = [
  { id: 'portrait', label: '9:16', width: 9, height: 16 },
  { id: 'landscape', label: '16:9', width: 16, height: 9 },
  { id: 'square', label: '1:1', width: 1, height: 1 },
]

const DEFAULT_CODE = `print("WhiteboardPlus ready")\n\nfor step in range(1, 4):\n    print(f"Step {step}: draw, explain, run")`
const DEFAULT_TABLE_HEADERS = ['Step', 'Owner', 'Status']
const DEFAULT_TABLE_ROWS = [
  ['Design canvas flow', 'You', 'In progress'],
  ['Write example code', 'Pairing', 'Queued'],
  ['Record tutorial clip', 'Whiteboard', 'Next'],
]

const RuntimeContext = createContext<RuntimeContextValue>({
  status: 'idle',
  error: null,
  runCode: async () => undefined,
})

class CodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'code' as const

  override getDefaultProps(): CodeShapeProps {
    return {
      w: 520,
      h: 360,
      title: 'Python block',
      code: DEFAULT_CODE,
      output: '',
      error: '',
      isRunning: false,
    }
  }

  override canEdit() {
    return true
  }

  override hideResizeHandles() {
    return false
  }

  override getGeometry(shape: CodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: CodeShape, info: Parameters<typeof resizeBox>[1]) {
    return resizeBox(shape as any, info, {
      minWidth: 340,
      minHeight: 220,
    })
  }

  override component(shape: CodeShape) {
    return (
      <HTMLContainer
        className="code-shape-shell"
        style={{ pointerEvents: 'none' }}
      >
        <div className="code-shape-proxy" style={{ width: shape.props.w, height: shape.props.h }} />
      </HTMLContainer>
    )
  }

  override indicator(shape: CodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />
  }
}

class TableShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'table' as const

  override getDefaultProps(): TableShapeProps {
    return {
      w: 520,
      h: 260,
      title: 'Planning table',
      headers: DEFAULT_TABLE_HEADERS,
      rows: DEFAULT_TABLE_ROWS,
    }
  }

  override canEdit() {
    return true
  }

  override hideResizeHandles() {
    return false
  }

  override getGeometry(shape: TableShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: TableShape, info: Parameters<typeof resizeBox>[1]) {
    return resizeBox(shape as any, info, {
      minWidth: 360,
      minHeight: 220,
    })
  }

  override component(shape: TableShape) {
    return (
      <HTMLContainer
        className="table-shape-shell"
        style={{ pointerEvents: 'none' }}
      >
        <div className="table-shape-proxy" style={{ width: shape.props.w, height: shape.props.h }} />
      </HTMLContainer>
    )
  }

  override indicator(shape: TableShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />
  }
}

function CodeShapeCard({
  shape,
  style,
  onDragStart,
  onResizeStart,
}: {
  shape: CodeShape
  style?: CSSProperties
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const editor = useEditor()
  const runtime = useContext(RuntimeContext)
  const editorViewRef = useRef<EditorView | null>(null)
  const extensions = useMemo(
    () => [python(), indentUnit.of('    '), keymap.of([indentWithTab])],
    [],
  )
  const panelChromeHeight = 52
  const preferredOutputHeight = 96
  const outputVisible = Boolean(shape.props.output || shape.props.error || shape.props.isRunning)
  const editorHeight = outputVisible
    ? Math.max(120, shape.props.h - panelChromeHeight - preferredOutputHeight)
    : Math.max(180, shape.props.h - panelChromeHeight)
  const outputHeight = outputVisible
    ? Math.max(72, shape.props.h - panelChromeHeight - editorHeight)
    : 0

  const updateProps = useCallback(
    (partial: Partial<CodeShapeProps>) => {
      editor.updateShape({
        id: shape.id,
        type: 'code',
        props: {
          ...shape.props,
          ...partial,
        },
      } as any)
    },
    [editor, shape.id, shape.props],
  )

  const beginEditing = useCallback(() => {
    editor.select(shape.id as any)
    editor.setEditingShape(shape.id as any)
  }, [editor, shape.id])

  const endEditing = useCallback(() => {
    if (editor.getEditingShapeId() === (shape.id as any)) {
      editor.setEditingShape(null)
    }
  }, [editor, shape.id])

  return (
    <div
      className="code-shape"
      style={{ width: shape.props.w, height: shape.props.h, ...style }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('[data-stop-canvas-shortcuts="true"]')) {
          beginEditing()
          stopEventPropagation(event)
        }
      }}
    >
      <div
        className="code-shape__header"
        onPointerDown={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('input, button, .cm-editor')) return
          onDragStart?.(event)
        }}
      >
        <div className="code-shape__meta">
          <input
            data-stop-canvas-shortcuts="true"
            className="code-shape__title"
            value={shape.props.title}
            onFocus={beginEditing}
            onBlur={endEditing}
            onChange={(event) => updateProps({ title: event.target.value })}
            aria-label="Code block title"
          />
        </div>
        <button
          type="button"
          className="app-button app-button--primary"
          data-stop-canvas-shortcuts="true"
          disabled={runtime.status !== 'ready' || shape.props.isRunning}
          onMouseDown={stopEventPropagation}
          onClick={() => runtime.runCode(shape.id, shape.props.code)}
        >
          {shape.props.isRunning ? 'Running...' : 'Run'}
        </button>
      </div>

      <div
        className="code-shape__editor"
        data-stop-canvas-shortcuts="true"
        style={{ height: editorHeight }}
      >
        <CodeMirror
          value={shape.props.code}
          height={`${editorHeight}px`}
          extensions={extensions}
          basicSetup={{
            foldGutter: false,
            highlightActiveLine: false,
            bracketMatching: true,
            lineNumbers: true,
            indentOnInput: true,
          }}
          theme="light"
          onCreateEditor={(view) => {
            editorViewRef.current = view
          }}
          onFocus={beginEditing}
          onBlur={endEditing}
          onChange={(value) => updateProps({ code: value })}
        />
      </div>

      {outputVisible ? (
        <div
          className={`code-shape__output ${shape.props.error ? 'code-shape__output--error' : ''}`}
          data-stop-canvas-shortcuts="true"
          style={{ height: outputHeight }}
        >
          <div className="code-shape__output-label">
            {shape.props.isRunning ? 'Executing in Pyodide' : shape.props.error ? 'Error' : 'Output'}
          </div>
          <pre>
            {shape.props.isRunning
              ? 'Running Python in the browser...'
              : shape.props.error || shape.props.output || 'No output yet.'}
          </pre>
        </div>
      ) : null}

      {onResizeStart ? (
        <button
          type="button"
          className="code-shape__resize-handle"
          data-stop-canvas-shortcuts="true"
          onPointerDown={onResizeStart}
          aria-label="Resize code block"
        />
      ) : null}
    </div>
  )
}

function TableShapeCard({
  shape,
  style,
  onDragStart,
  onResizeStart,
}: {
  shape: TableShape
  style?: CSSProperties
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const editor = useEditor()

  const updateProps = useCallback(
    (partial: Partial<TableShapeProps>) => {
      editor.updateShape({
        id: shape.id,
        type: 'table',
        props: {
          ...shape.props,
          ...partial,
        },
      } as any)
    },
    [editor, shape.id, shape.props],
  )

  const beginEditing = useCallback(() => {
    editor.select(shape.id as any)
    editor.setEditingShape(shape.id as any)
  }, [editor, shape.id])

  const endEditing = useCallback(() => {
    if (editor.getEditingShapeId() === (shape.id as any)) {
      editor.setEditingShape(null)
    }
  }, [editor, shape.id])

  const updateHeader = useCallback(
    (index: number, value: string) => {
      updateProps({
        headers: shape.props.headers.map((header, headerIndex) => (headerIndex === index ? value : header)),
      })
    },
    [shape.props.headers, updateProps],
  )

  const updateCell = useCallback(
    (rowIndex: number, columnIndex: number, value: string) => {
      updateProps({
        rows: shape.props.rows.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? value : cell))
            : row,
        ),
      })
    },
    [shape.props.rows, updateProps],
  )

  const addRow = useCallback(() => {
    updateProps({
      rows: [...shape.props.rows, shape.props.headers.map(() => '')],
    })
  }, [shape.props.headers, shape.props.rows, updateProps])

  const addColumn = useCallback(() => {
    const nextColumnIndex = shape.props.headers.length + 1
    updateProps({
      headers: [...shape.props.headers, `Column ${nextColumnIndex}`],
      rows: shape.props.rows.map((row) => [...row, '']),
    })
  }, [shape.props.headers, shape.props.rows, updateProps])

  return (
    <div
      className="table-shape"
      style={{ width: shape.props.w, height: shape.props.h, ...style }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('[data-stop-canvas-shortcuts="true"]')) {
          beginEditing()
          stopEventPropagation(event)
        }
      }}
    >
      <div
        className="table-shape__header"
        onPointerDown={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('input, button, textarea')) return
          onDragStart?.(event)
        }}
      >
        <input
          data-stop-canvas-shortcuts="true"
          className="table-shape__title"
          value={shape.props.title}
          onFocus={beginEditing}
          onBlur={endEditing}
          onChange={(event) => updateProps({ title: event.target.value })}
          aria-label="Table title"
        />
        <div className="table-shape__actions">
          <button type="button" className="app-button" data-stop-canvas-shortcuts="true" onClick={addRow}>
            Add row
          </button>
          <button type="button" className="app-button" data-stop-canvas-shortcuts="true" onClick={addColumn}>
            Add column
          </button>
        </div>
      </div>

      <div className="table-shape__scroller" data-stop-canvas-shortcuts="true">
        <table className="table-shape__grid">
          <thead>
            <tr>
              {shape.props.headers.map((header, index) => (
                <th key={`${shape.id}-header-${index}`}>
                  <input
                    data-stop-canvas-shortcuts="true"
                    className="table-shape__cell table-shape__cell--header"
                    value={header}
                    onFocus={beginEditing}
                    onBlur={endEditing}
                    onChange={(event) => updateHeader(index, event.target.value)}
                    aria-label={`Column ${index + 1} heading`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shape.props.rows.map((row, rowIndex) => (
              <tr key={`${shape.id}-row-${rowIndex}`}>
                {shape.props.headers.map((_, columnIndex) => (
                  <td key={`${shape.id}-cell-${rowIndex}-${columnIndex}`}>
                    <textarea
                      data-stop-canvas-shortcuts="true"
                      className="table-shape__cell"
                      rows={1}
                      value={row[columnIndex] ?? ''}
                      onFocus={beginEditing}
                      onBlur={endEditing}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      aria-label={`Row ${rowIndex + 1} column ${columnIndex + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onResizeStart ? (
        <button
          type="button"
          className="table-shape__resize-handle"
          data-stop-canvas-shortcuts="true"
          onPointerDown={onResizeStart}
          aria-label="Resize table"
        />
      ) : null}
    </div>
  )
}

function CodeBlocksOverlay() {
  const editor = useEditor()
  const interactionRef = useRef<
    | {
        kind: 'move'
        pointerId: number
        startX: number
        startY: number
        shape: CodeShape
      }
    | {
        kind: 'resize'
        pointerId: number
        startX: number
        startY: number
        shape: CodeShape
      }
    | null
  >(null)

  const codeShapes = useValue(
    'code-shape-overlays',
    () => {
      editor.getZoomLevel()
      editor.getViewportPageBounds()
      return (editor.getCurrentPageShapes() as any[])
        .filter((shape) => shape.type === 'code')
        .map((shape) => {
          const codeShape = shape as CodeShape
          const screenPoint = editor.pageToScreen({ x: codeShape.x, y: codeShape.y })
          const zoom = editor.getZoomLevel()

          return {
            shape: codeShape,
            screenStyle: {
              left: screenPoint.x,
              top: screenPoint.y,
              width: codeShape.props.w,
              height: codeShape.props.h,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            } as CSSProperties,
          }
        })
    },
    [editor],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return

      const zoom = editor.getZoomLevel()
      const dx = (event.clientX - interaction.startX) / zoom
      const dy = (event.clientY - interaction.startY) / zoom

      if (interaction.kind === 'move') {
        editor.updateShape({
          id: interaction.shape.id,
          type: 'code',
          x: interaction.shape.x + dx,
          y: interaction.shape.y + dy,
          props: interaction.shape.props,
        } as any)
        return
      }

      editor.updateShape({
        id: interaction.shape.id,
        type: 'code',
        x: interaction.shape.x,
        y: interaction.shape.y,
        props: {
          ...interaction.shape.props,
          w: Math.max(340, interaction.shape.props.w + dx),
          h: Math.max(220, interaction.shape.props.h + dy),
        },
      } as any)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (interactionRef.current?.pointerId === event.pointerId) {
        interactionRef.current = null
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [editor])

  return (
    <div className="code-blocks-overlay">
      {codeShapes.map(({ shape, screenStyle }) => (
        <CodeShapeCard
          key={shape.id}
          shape={shape}
          style={screenStyle}
          onDragStart={(event) => {
            event.preventDefault()
            stopEventPropagation(event)
            interactionRef.current = {
              kind: 'move',
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              shape,
            }
          }}
          onResizeStart={(event) => {
            event.preventDefault()
            stopEventPropagation(event)
            interactionRef.current = {
              kind: 'resize',
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              shape,
            }
          }}
        />
      ))}
    </div>
  )
}

function TableShapesOverlay() {
  const editor = useEditor()
  const interactionRef = useRef<
    | {
        kind: 'move'
        pointerId: number
        startX: number
        startY: number
        shape: TableShape
      }
    | {
        kind: 'resize'
        pointerId: number
        startX: number
        startY: number
        shape: TableShape
      }
    | null
  >(null)

  const tableShapes = useValue(
    'table-shape-overlays',
    () => {
      editor.getZoomLevel()
      editor.getViewportPageBounds()
      return (editor.getCurrentPageShapes() as any[])
        .filter((shape) => shape.type === 'table')
        .map((shape) => {
          const tableShape = shape as TableShape
          const screenPoint = editor.pageToScreen({ x: tableShape.x, y: tableShape.y })
          const zoom = editor.getZoomLevel()

          return {
            shape: tableShape,
            screenStyle: {
              left: screenPoint.x,
              top: screenPoint.y,
              width: tableShape.props.w,
              height: tableShape.props.h,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            } as CSSProperties,
          }
        })
    },
    [editor],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return

      const zoom = editor.getZoomLevel()
      const dx = (event.clientX - interaction.startX) / zoom
      const dy = (event.clientY - interaction.startY) / zoom

      if (interaction.kind === 'move') {
        editor.updateShape({
          id: interaction.shape.id,
          type: 'table',
          x: interaction.shape.x + dx,
          y: interaction.shape.y + dy,
          props: interaction.shape.props,
        } as any)
        return
      }

      editor.updateShape({
        id: interaction.shape.id,
        type: 'table',
        x: interaction.shape.x,
        y: interaction.shape.y,
        props: {
          ...interaction.shape.props,
          w: Math.max(360, interaction.shape.props.w + dx),
          h: Math.max(220, interaction.shape.props.h + dy),
        },
      } as any)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (interactionRef.current?.pointerId === event.pointerId) {
        interactionRef.current = null
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [editor])

  return (
    <div className="code-blocks-overlay">
      {tableShapes.map(({ shape, screenStyle }) => (
        <TableShapeCard
          key={shape.id}
          shape={shape}
          style={screenStyle}
          onDragStart={(event) => {
            event.preventDefault()
            stopEventPropagation(event)
            interactionRef.current = {
              kind: 'move',
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              shape,
            }
          }}
          onResizeStart={(event) => {
            event.preventDefault()
            stopEventPropagation(event)
            interactionRef.current = {
              kind: 'resize',
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              shape,
            }
          }}
        />
      ))}
    </div>
  )
}

const UI_COMPONENTS: TLUiComponents = {
  MainMenu: null,
  SharePanel: null,
  Toolbar: DefaultToolbar,
  NavigationPanel: DefaultNavigationPanel,
  StylePanel: DefaultStylePanel,
}

function WorkspaceOverlay({
  framePreset,
  frame,
  showFrame,
  isRecording,
  panelOpen,
  lockFrameAspectRatio,
  onToggleGrid,
  onAddCodeBlock,
  onAddTable,
  onAddStickyNote,
  onAddFlowBlock,
  onAddArrow,
  onToggleFrameVisibility,
  onToggleFrameAspectRatio,
  onTogglePanel,
  onFramePresetChange,
  onStartRecording,
  onStopRecording,
  onRecenterFrame,
  onFrameDragStart,
  onFrameResizeStart,
}: {
  framePreset: FramePreset
  frame: RecordingFrame
  showFrame: boolean
  isRecording: boolean
  panelOpen: boolean
  lockFrameAspectRatio: boolean
  onToggleGrid: () => void
  onAddCodeBlock: () => void
  onAddTable: () => void
  onAddStickyNote: () => void
  onAddFlowBlock: () => void
  onAddArrow: () => void
  onToggleFrameVisibility: () => void
  onToggleFrameAspectRatio: () => void
  onTogglePanel: () => void
  onFramePresetChange: (preset: FramePreset) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onRecenterFrame: () => void
  onFrameDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void
  onFrameResizeStart: (handle: FrameResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const editor = useEditor()
  const runtime = useContext(RuntimeContext)
  const isGridMode = useValue('grid-mode', () => editor.getInstanceState().isGridMode, [editor])
  const currentTool = useValue('tool-id', () => editor.getCurrentToolId(), [editor])
  const zoom = useValue('zoom', () => Math.round(editor.getZoomLevel() * 100), [editor])

  return (
    <>
      {!isRecording ? (
        <div className="workspace-panel">
          <button type="button" className="workspace-panel__toggle" onClick={onTogglePanel}>
            {panelOpen ? 'Hide tools' : 'Show tools'}
          </button>

          {panelOpen ? (
            <div className="workspace-toolbar workspace-toolbar--panel">
              <div className="workspace-toolbar__section">
                <div className="workspace-brand">
                  <span className="workspace-brand__name">WhiteboardPlus</span>
                  <span className="workspace-brand__meta">Canvas for code tutorials</span>
                </div>
              </div>

              <div className="workspace-toolbar__section">
                <span className="workspace-toolbar__label">Insert</span>
                <div className="workspace-toolbar__cluster">
                  <button type="button" className="app-button app-button--primary" onClick={onAddCodeBlock}>
                    Code block
                  </button>
                  <button type="button" className="app-button" onClick={onAddTable}>
                    Table
                  </button>
                  <button type="button" className="app-button" onClick={onAddStickyNote}>
                    Sticky note
                  </button>
                  <button type="button" className="app-button" onClick={onAddFlowBlock}>
                    Flow box
                  </button>
                  <button type="button" className="app-button" onClick={onAddArrow}>
                    Arrow
                  </button>
                </div>
              </div>

              <div className="workspace-toolbar__section">
                <span className="workspace-toolbar__label">Canvas</span>
                <div className="workspace-toolbar__cluster">
                  <button type="button" className="app-button" onClick={onToggleGrid}>
                    {isGridMode ? 'Hide grid' : 'Show grid'}
                  </button>
                </div>
              </div>

              <div className="workspace-toolbar__section">
                <span className="workspace-toolbar__label">Recording frame</span>
                <div className="workspace-toolbar__cluster">
                  <button
                    type="button"
                    className={`app-button ${showFrame ? 'app-button--selected' : ''}`}
                    onClick={onToggleFrameVisibility}
                  >
                    {showFrame ? 'Frame on' : 'Frame off'}
                  </button>
                  {FRAME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`app-button ${framePreset.id === preset.id && showFrame ? 'app-button--selected' : ''}`}
                      onClick={() => onFramePresetChange(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`app-button ${lockFrameAspectRatio ? 'app-button--selected' : ''}`}
                    onClick={onToggleFrameAspectRatio}
                  >
                    {lockFrameAspectRatio ? 'Lock ratio' : 'Free resize'}
                  </button>
                  <button type="button" className="app-button" onClick={onRecenterFrame} disabled={!showFrame}>
                    Recenter
                  </button>
                  <button
                    type="button"
                    className="app-button app-button--record"
                    onClick={showFrame ? onStartRecording : onToggleFrameVisibility}
                  >
                    {showFrame ? 'Record frame' : 'Show frame'}
                  </button>
                </div>
              </div>

              <div className="workspace-toolbar__section workspace-toolbar__section--status">
                <div className="workspace-status">
                  <span>Tool {currentTool}</span>
                  <span>Zoom {zoom}%</span>
                  <span>
                    Runtime{' '}
                    {runtime.status === 'ready'
                      ? 'ready'
                      : runtime.status === 'error'
                        ? 'failed'
                        : 'loading'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" className="recording-stop" onClick={onStopRecording}>
          Stop recording
        </button>
      )}

      {showFrame ? (
        <div className="recording-frame-layer" data-html2canvas-ignore="true">
          <div className="recording-mask recording-mask--top" style={{ height: frame.y }} />
          <div className="recording-mask recording-mask--left" style={{ top: frame.y, width: frame.x, height: frame.height }} />
          <div
            className="recording-mask recording-mask--right"
            style={{
              top: frame.y,
              left: frame.x + frame.width,
              width: `calc(100% - ${frame.x + frame.width}px)`,
              height: frame.height,
            }}
          />
          <div
            className="recording-mask recording-mask--bottom"
            style={{ top: frame.y + frame.height, height: `calc(100% - ${frame.y + frame.height}px)` }}
          />

          <div
            className="recording-frame"
            style={{
              left: frame.x,
              top: frame.y,
              width: frame.width,
              height: frame.height,
            }}
          >
            <div className="recording-frame__badge" onPointerDown={onFrameDragStart}>
              {framePreset.label} capture
            </div>
            {(['nw', 'ne', 'se', 'sw'] as FrameResizeHandle[]).map((handle) => (
              <button
                key={handle}
                type="button"
                className={`recording-frame__handle recording-frame__handle--${handle}`}
                onPointerDown={(event) => onFrameResizeStart(handle, event)}
                aria-label={`Resize frame from ${handle}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function App() {
  const editorRef = useRef<Editor | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const pyodideRef = useRef<PyodideInstance | null>(null)
  const runtimeRef = useRef<RuntimeContextValue['runCode']>(async () => undefined)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recordingLoopRef = useRef<{ active: boolean }>({ active: false })
  const chunksRef = useRef<Blob[]>([])
  const frameInteractionRef = useRef<FrameInteraction | null>(null)

  const [runtimeStatus, setRuntimeStatus] = useState<PyodideStatus>('loading')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [framePreset, setFramePreset] = useState<FramePreset>(FRAME_PRESETS[0])
  const [frame, setFrame] = useState<RecordingFrame>({ x: 80, y: 110, width: 405, height: 720 })
  const [showFrame, setShowFrame] = useState(false)
  const [lockFrameAspectRatio, setLockFrameAspectRatio] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

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

  const fitFrameToWorkspace = useCallback(
    (preset: FramePreset) => {
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
    },
    [],
  )

  useEffect(() => {
    if (showFrame && lockFrameAspectRatio) {
      fitFrameToWorkspace(framePreset)
    }
  }, [fitFrameToWorkspace, framePreset, lockFrameAspectRatio, showFrame])

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

  useEffect(() => {
    let cancelled = false

    const bootPyodide = async () => {
      try {
        setRuntimeStatus('loading')
        const pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        })
        if (cancelled) return
        pyodideRef.current = pyodide
        setRuntimeStatus('ready')
      } catch (error) {
        if (cancelled) return
        setRuntimeStatus('error')
        setRuntimeError(error instanceof Error ? error.message : 'Failed to load Pyodide.')
      }
    }

    void bootPyodide()
    return () => {
      cancelled = true
    }
  }, [])

  const runCode = useCallback(async (shapeId: string, code: string) => {
    const editor = editorRef.current
    const pyodide = pyodideRef.current
    if (!editor || !pyodide) return

    const shape = editor.getShape(shapeId as any) as CodeShape | undefined
    if (!shape || shape.type !== 'code') return

    editor.updateShape({
      id: shapeId,
      type: 'code',
      props: {
        ...shape.props,
        isRunning: true,
        output: '',
        error: '',
      },
    } as any)

    try {
      const serialized = await pyodide.runPythonAsync(`
import io
import json
import traceback
from contextlib import redirect_stdout, redirect_stderr

_stdout = io.StringIO()
_stderr = io.StringIO()
_error = ""

try:
    with redirect_stdout(_stdout), redirect_stderr(_stderr):
        exec(${JSON.stringify(code)}, globals())
except Exception:
    _error = traceback.format_exc()

json.dumps({
    "stdout": _stdout.getvalue(),
    "stderr": _stderr.getvalue(),
    "error": _error,
})
`)

      const parsed = JSON.parse(String(serialized)) as {
        stdout: string
        stderr: string
        error: string
      }

      const latestShape = editor.getShape(shapeId as any) as CodeShape | undefined
      if (!latestShape || latestShape.type !== 'code') return

      editor.updateShape({
        id: shapeId,
        type: 'code',
        props: {
          ...latestShape.props,
          isRunning: false,
          output: [parsed.stdout, parsed.stderr].filter(Boolean).join(parsed.stdout && parsed.stderr ? '\n' : ''),
          error: parsed.error,
        },
      } as any)
    } catch (error) {
      const latestShape = editor.getShape(shapeId as any) as CodeShape | undefined
      if (!latestShape || latestShape.type !== 'code') return

      editor.updateShape({
        id: shapeId,
        type: 'code',
        props: {
          ...latestShape.props,
          isRunning: false,
          error: error instanceof Error ? error.message : 'Execution failed.',
        },
      } as any)
    }
  }, [])

  runtimeRef.current = runCode

  const runtimeValue = useMemo<RuntimeContextValue>(
    () => ({
      status: runtimeStatus,
      error: runtimeError,
      runCode: async (shapeId: string, code: string) => runtimeRef.current(shapeId, code),
    }),
    [runtimeError, runtimeStatus],
  )

  const toggleGrid = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.updateInstanceState({
      isGridMode: !editor.getInstanceState().isGridMode,
    })
  }, [])

  const addCodeBlock = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'code',
      x: center.x - 260,
      y: center.y - 180,
      props: {
        w: 520,
        h: 360,
        title: 'Python block',
        code: DEFAULT_CODE,
        output: '',
        error: '',
        isRunning: false,
      },
    } as any)
  }, [])

  const addTable = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'table',
      x: center.x - 260,
      y: center.y - 130,
      props: {
        w: 520,
        h: 260,
        title: 'Planning table',
        headers: DEFAULT_TABLE_HEADERS,
        rows: DEFAULT_TABLE_ROWS,
      },
    } as any)
  }, [])

  const addStickyNote = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'note',
      x: center.x - 90,
      y: center.y - 90,
      props: {
        richText: toRichText('Add takeaways, reminders, or narration beats'),
      },
    } as any)
  }, [])

  const addFlowBlock = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'geo',
      x: center.x - 120,
      y: center.y - 60,
      props: {
        geo: 'rectangle',
        w: 240,
        h: 120,
        richText: toRichText('Explain this step'),
      },
    } as any)
  }, [])

  const addArrow = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'arrow',
      x: center.x - 10,
      y: center.y - 10,
      props: {
        start: { x: 0, y: 0 },
        end: { x: 220, y: 0 },
        text: '',
      },
    } as any)
  }, [])

  const stopRecording = useCallback(() => {
    recordingLoopRef.current.active = false
    recorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!workspaceRef.current || !bounds || isRecording || !showFrame) return

    const crop = clampFrame(frame)
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    const recorderCanvas = document.createElement('canvas')
    recorderCanvas.width = Math.floor(crop.width * scale)
    recorderCanvas.height = Math.floor(crop.height * scale)

    const ctx = recorderCanvas.getContext('2d')
    if (!ctx) return

    recorderCanvasRef.current = recorderCanvas
    chunksRef.current = []
    setIsRecording(true)

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'

    const recorder = new MediaRecorder(recorderCanvas.captureStream(10), { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `whiteboardplus-${framePreset.label.replace(':', 'x')}.webm`
      anchor.click()
      URL.revokeObjectURL(url)
      recorderRef.current = null
      recorderCanvasRef.current = null
    }

    recorder.start(250)
    recordingLoopRef.current.active = true

    const renderRecordingFrame = async () => {
      if (!recordingLoopRef.current.active || !workspaceRef.current || !recorderCanvasRef.current) return

      const snapshot = await html2canvas(workspaceRef.current, {
        backgroundColor: '#f3f1eb',
        width: crop.width,
        height: crop.height,
        x: crop.x,
        y: crop.y,
        scale,
        logging: false,
        useCORS: true,
      })

      ctx.clearRect(0, 0, recorderCanvas.width, recorderCanvas.height)
      ctx.drawImage(snapshot, 0, 0, recorderCanvas.width, recorderCanvas.height)

      if (recordingLoopRef.current.active) {
        window.setTimeout(() => {
          void renderRecordingFrame()
        }, 100)
      }
    }

    void renderRecordingFrame()
  }, [clampFrame, frame, framePreset.label, isRecording, showFrame])

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
            hideUi={isRecording}
            onMount={(editor) => {
              editorRef.current = editor
              editor.updateInstanceState({ isGridMode: true })
              if (!(editor.getCurrentPageShapes() as any[]).some((shape) => shape.type === 'code')) {
                const center = editor.getViewportPageBounds().center
                editor.createShape({
                  type: 'code',
                  x: center.x - 260,
                  y: center.y - 180,
                  props: {
                    w: 520,
                    h: 360,
                    title: 'Python block',
                    code: DEFAULT_CODE,
                    output: '',
                    error: '',
                    isRunning: false,
                  },
                } as any)
              }
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
              onAddCodeBlock={addCodeBlock}
              onAddTable={addTable}
              onAddStickyNote={addStickyNote}
              onAddFlowBlock={addFlowBlock}
              onAddArrow={addArrow}
              onToggleFrameVisibility={() => setShowFrame((value) => !value)}
              onToggleFrameAspectRatio={() => setLockFrameAspectRatio((value) => !value)}
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
