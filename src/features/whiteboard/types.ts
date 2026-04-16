export type FramePresetId = 'portrait' | 'landscape' | 'square'
export type FrameResizeHandle = 'nw' | 'ne' | 'se' | 'sw'
export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error'

export type FramePreset = {
  id: FramePresetId
  label: string
  width: number
  height: number
}

export type RuntimeContextValue = {
  status: PyodideStatus
  error: string | null
  runCode: (shapeId: string, code: string) => Promise<void>
}

export type CodeShapeProps = {
  w: number
  h: number
  code: string
  output: string
  error: string
  title: string
  isRunning: boolean
}

export type CodeShape = {
  id: string
  type: 'code'
  x: number
  y: number
  rotation: number
  index: string
  props: CodeShapeProps
}

export type TableShapeProps = {
  w: number
  h: number
  title: string
  headers: string[]
  rows: string[][]
}

export type TableShape = {
  id: string
  type: 'table'
  x: number
  y: number
  rotation: number
  index: string
  props: TableShapeProps
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
