/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, type CSSProperties } from 'react'
import { stopEventPropagation, useEditor, useValue } from 'tldraw'
import { CodeShapeCard } from './CodeShapeCard'
import { TableShapeCard } from './TableShapeCard'
import type { CodeShape, TableShape } from '../types'

export function CodeBlocksOverlay() {
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

export function TableShapesOverlay() {
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
