/* eslint-disable @typescript-eslint/no-explicit-any */

import { toRichText, type Editor } from 'tldraw'
import { createDefaultCodeShapeProps, createDefaultTableShapeProps } from './constants'

export function ensureInitialCodeBlock(editor: Editor) {
  if ((editor.getCurrentPageShapes() as any[]).some((shape) => shape.type === 'code')) return

  const center = editor.getViewportPageBounds().center
  editor.createShape({
    type: 'code',
    x: center.x - 260,
    y: center.y - 180,
    props: createDefaultCodeShapeProps(),
  } as any)
}

export function addCodeBlock(editor: Editor) {
  const center = editor.getViewportPageBounds().center
  editor.createShape({
    type: 'code',
    x: center.x - 260,
    y: center.y - 180,
    props: createDefaultCodeShapeProps(),
  } as any)
}

export function addTable(editor: Editor) {
  const center = editor.getViewportPageBounds().center
  editor.createShape({
    type: 'table',
    x: center.x - 260,
    y: center.y - 130,
    props: createDefaultTableShapeProps(),
  } as any)
}

export function addStickyNote(editor: Editor) {
  const center = editor.getViewportPageBounds().center
  editor.createShape({
    type: 'note',
    x: center.x - 90,
    y: center.y - 90,
    props: {
      richText: toRichText('Add takeaways, reminders, or narration beats'),
    },
  } as any)
}

export function addFlowBlock(editor: Editor) {
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
}

export function addArrow(editor: Editor) {
  const center = editor.getViewportPageBounds().center
  editor.createShape({
    type: 'arrow',
    x: center.x - 10,
    y: center.y - 10,
    props: {
      start: { x: 0, y: 0 },
      end: { x: 220, y: 0 },
      richText: toRichText(''),
    },
  } as any)
}
