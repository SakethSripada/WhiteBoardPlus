export type FramePresetId = 'portrait' | 'landscape' | 'square'
export type FrameResizeHandle = 'nw' | 'ne' | 'se' | 'sw'
export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error'
export type WhiteboardTool = 'select' | 'draw' | 'pan'

export type FramePreset = {
  id: FramePresetId
  label: string
  width: number
  height: number
}

export type RuntimeContextValue = {
  status: PyodideStatus
  error: string | null
  runCode: (blockId: string, code: string) => Promise<void>
}

export type CodeBlockProps = {
  w: number
  h: number
  code: string
  output: string
  error: string
  title: string
  isRunning: boolean
  outputHeight: number
}

export type CodeBlock = {
  id: string
  x: number
  y: number
  props: CodeBlockProps
}

export type RecordingFrame = {
  x: number
  y: number
  width: number
  height: number
}

export type FrameInteraction =
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

export type ViewportState = {
  zoom: number
  panX: number
  panY: number
}
