import { useContext, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { FaCode, FaDrawPolygon, FaImage, FaMousePointer, FaRedo, FaUndo } from 'react-icons/fa'
import { FRAME_PRESETS } from '../constants'
import { RuntimeContext } from '../runtime'
import type { FramePreset, FrameResizeHandle, RecordingFrame, WhiteboardTool } from '../types'

const BRUSH_SWATCHES = [
  '#ef4444',
  '#22c55e',
  '#2563eb',
  '#f59e0b',
  '#a855f7',
  '#171717',
]

type WorkspaceOverlayProps = {
  framePreset: FramePreset
  frame: RecordingFrame
  showFrame: boolean
  isRecording: boolean
  panelOpen: boolean
  lockFrameAspectRatio: boolean
  showGrid: boolean
  tool: WhiteboardTool
  brushColor: string
  brushWidth: number
  zoomPercentage: number
  canUndo: boolean
  canRedo: boolean
  onToggleGrid: () => void
  onToolChange: (tool: WhiteboardTool) => void
  onBrushColorChange: (value: string) => void
  onBrushWidthChange: (value: number) => void
  onClearBoard: () => void
  onAddCodeBlock: () => void
  onAddImage: () => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onToggleFrameVisibility: () => void
  onToggleFrameAspectRatio: () => void
  onTogglePanel: () => void
  onFramePresetChange: (preset: FramePreset) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onRecenterFrame: () => void
  onFrameDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void
  onFrameResizeStart: (handle: FrameResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void
}

function ToolIcon({ children }: { children: ReactNode }) {
  return <span className="workspace-tool-icon">{children}</span>
}

export function WorkspaceOverlay({
  framePreset,
  frame,
  showFrame,
  isRecording,
  panelOpen,
  lockFrameAspectRatio,
  showGrid,
  tool,
  brushColor,
  brushWidth,
  zoomPercentage,
  canUndo,
  canRedo,
  onToggleGrid,
  onToolChange,
  onBrushColorChange,
  onBrushWidthChange,
  onClearBoard,
  onAddCodeBlock,
  onAddImage,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleFrameVisibility,
  onToggleFrameAspectRatio,
  onTogglePanel,
  onFramePresetChange,
  onStartRecording,
  onStopRecording,
  onRecenterFrame,
  onFrameDragStart,
  onFrameResizeStart,
}: WorkspaceOverlayProps) {
  const runtime = useContext(RuntimeContext)

  return (
    <>
      <div className="workspace-panel">
        <div className="workspace-panel__dock">
          <button type="button" className="workspace-panel__toggle" onClick={onTogglePanel}>
            {panelOpen ? 'Hide panel' : 'Show panel'}
          </button>
        </div>

        {panelOpen ? (
          <aside className="workspace-sidebar">
            <div className="workspace-sidebar__header">
              <div className="workspace-brand">
                <span className="workspace-brand__name">WhiteboardPlus</span>
                <span className="workspace-brand__meta">Pointer, drawing, code blocks, and pasted images in one board.</span>
              </div>
            </div>

            <section className="workspace-sidebar__section">
              <span className="workspace-toolbar__label">Canvas</span>
              <div className="workspace-sidebar__grid">
                <button type="button" className="app-button" onClick={onAddCodeBlock}>
                  Add code block
                </button>
                <button type="button" className="app-button" onClick={onAddImage}>
                  Upload image
                </button>
                <button type="button" className="app-button" onClick={onToggleGrid}>
                  {showGrid ? 'Hide grid' : 'Show grid'}
                </button>
                <button type="button" className="app-button" onClick={onClearBoard}>
                  Clear ink
                </button>
              </div>
            </section>

            <section className="workspace-sidebar__section">
              <span className="workspace-toolbar__label">Brush</span>
              <label className="workspace-field">
                <span>Thickness</span>
                <div className="workspace-slider-row">
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={brushWidth}
                    onChange={(event) => onBrushWidthChange(Number(event.target.value))}
                  />
                  <span>{brushWidth}px</span>
                </div>
              </label>
              <label className="workspace-field">
                <span>Custom color</span>
                <input
                  type="color"
                  className="workspace-color-input"
                  value={brushColor}
                  onChange={(event) => onBrushColorChange(event.target.value)}
                  aria-label="Brush color"
                />
              </label>
            </section>

            <section className="workspace-sidebar__section">
              <span className="workspace-toolbar__label">View</span>
              <div className="workspace-sidebar__grid">
                <button type="button" className="app-button" onClick={onZoomIn}>
                  Zoom in
                </button>
                <button type="button" className="app-button" onClick={onZoomOut}>
                  Zoom out
                </button>
                <button type="button" className="app-button" onClick={onResetView}>
                  Reset view
                </button>
                <button type="button" className="app-button" onClick={onRecenterFrame} disabled={!showFrame}>
                  Recenter frame
                </button>
              </div>
              <div className="workspace-sidebar__meta">
                <span>{zoomPercentage}% zoom</span>
                <span>
                  Runtime {runtime.status === 'ready' ? 'ready' : runtime.status === 'error' ? 'failed' : 'loading'}
                </span>
              </div>
            </section>

            <section className="workspace-sidebar__section">
              <span className="workspace-toolbar__label">Recording</span>
              <div className="workspace-sidebar__grid">
                <button
                  type="button"
                  className={`app-button ${showFrame ? 'app-button--selected' : ''}`}
                  onClick={onToggleFrameVisibility}
                >
                  {showFrame ? 'Frame on' : 'Frame off'}
                </button>
                <button
                  type="button"
                  className={`app-button ${lockFrameAspectRatio ? 'app-button--selected' : ''}`}
                  onClick={onToggleFrameAspectRatio}
                >
                  {lockFrameAspectRatio ? 'Lock ratio' : 'Free resize'}
                </button>
                <button
                  type="button"
                  className="app-button app-button--record"
                  onClick={isRecording ? onStopRecording : showFrame ? onStartRecording : onToggleFrameVisibility}
                >
                  {isRecording ? 'Stop recording' : showFrame ? 'Record frame' : 'Show frame'}
                </button>
              </div>
              <div className="workspace-preset-row">
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
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      <div className="workspace-bottom-toolbar" data-html2canvas-ignore="true">
        <div className="workspace-bottom-toolbar__group">
          <button
            type="button"
            className={`workspace-tool-button ${tool === 'select' ? 'workspace-tool-button--active' : ''}`}
            onClick={() => onToolChange('select')}
            aria-label="Pointer mode"
          >
            <ToolIcon><FaMousePointer /></ToolIcon>
            <span>Pointer</span>
          </button>
          <button
            type="button"
            className={`workspace-tool-button ${tool === 'draw' ? 'workspace-tool-button--active' : ''}`}
            onClick={() => onToolChange('draw')}
            aria-label="Draw mode"
          >
            <ToolIcon><FaDrawPolygon /></ToolIcon>
            <span>Draw</span>
          </button>
        </div>

        <div className="workspace-bottom-toolbar__group">
          {BRUSH_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`workspace-swatch ${brushColor === swatch ? 'workspace-swatch--active' : ''}`}
              style={{ backgroundColor: swatch }}
              onClick={() => onBrushColorChange(swatch)}
              aria-label={`Use ${swatch} color`}
            />
          ))}
        </div>

        <div className="workspace-bottom-toolbar__group">
          <button type="button" className="workspace-tool-button" onClick={onAddImage} aria-label="Upload image">
            <ToolIcon><FaImage /></ToolIcon>
            <span>Image</span>
          </button>
          <button type="button" className="workspace-tool-button" onClick={onAddCodeBlock} aria-label="Add code block">
            <ToolIcon><FaCode /></ToolIcon>
            <span>Code</span>
          </button>
          <button type="button" className="workspace-tool-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <ToolIcon><FaUndo /></ToolIcon>
            <span>Undo</span>
          </button>
          <button type="button" className="workspace-tool-button" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
            <ToolIcon><FaRedo /></ToolIcon>
            <span>Redo</span>
          </button>
        </div>
      </div>

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
