import { useContext, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditor, useValue } from 'tldraw'
import { FRAME_PRESETS } from '../constants'
import { RuntimeContext } from '../runtime'
import type { FramePreset, FrameResizeHandle, RecordingFrame } from '../types'

type WorkspaceOverlayProps = {
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
}

export function WorkspaceOverlay({
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
}: WorkspaceOverlayProps) {
  const editor = useEditor()
  const runtime = useContext(RuntimeContext)
  const isGridMode = useValue('grid-mode', () => editor.getInstanceState().isGridMode, [editor])
  const currentTool = useValue('tool-id', () => editor.getCurrentToolId(), [editor])
  const zoom = useValue('zoom', () => Math.round(editor.getZoomLevel() * 100), [editor])

  return (
    <>
      <div className="workspace-panel">
        <div className="workspace-panel__topbar">
          <button type="button" className="workspace-panel__toggle" onClick={onTogglePanel}>
            {panelOpen ? 'Hide tools' : 'Show tools'}
          </button>
          {isRecording ? (
            <button type="button" className="recording-stop" onClick={onStopRecording}>
              Stop recording
            </button>
          ) : null}
        </div>

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
                  onClick={isRecording ? onStopRecording : showFrame ? onStartRecording : onToggleFrameVisibility}
                >
                  {isRecording ? 'Stop recording' : showFrame ? 'Record frame' : 'Show frame'}
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
                <span>Recording {isRecording ? 'on' : 'off'}</span>
              </div>
            </div>
          </div>
        ) : null}
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
