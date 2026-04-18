import type { CodeShapeProps, FramePreset, TableShapeProps } from './types'

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'portrait', label: '9:16', width: 9, height: 16 },
  { id: 'landscape', label: '16:9', width: 16, height: 9 },
  { id: 'square', label: '1:1', width: 1, height: 1 },
]

export const DEFAULT_CODE = `print("WhiteboardPlus ready")\n\nfor step in range(1, 4):\n    print(f"Step {step}: draw, explain, run")`
export const DEFAULT_TABLE_HEADERS = ['Step', 'Owner', 'Status']
export const DEFAULT_TABLE_ROWS = [
  ['Design canvas flow', 'You', 'In progress'],
  ['Write example code', 'Pairing', 'Queued'],
  ['Record tutorial clip', 'Whiteboard', 'Next'],
]

export function createDefaultCodeShapeProps(): CodeShapeProps {
  return {
    w: 520,
    h: 360,
    title: 'Python block',
    code: DEFAULT_CODE,
    output: '',
    error: '',
    isRunning: false,
    outputHeight: 96,
  }
}

export function createDefaultTableShapeProps(): TableShapeProps {
  return {
    w: 520,
    h: 260,
    title: 'Planning table',
    headers: [...DEFAULT_TABLE_HEADERS],
    rows: DEFAULT_TABLE_ROWS.map((row) => [...row]),
  }
}
