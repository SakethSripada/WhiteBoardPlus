/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { stopEventPropagation, useEditor } from 'tldraw'
import type { TableShape, TableShapeProps } from '../types'

type TableShapeCardProps = {
  shape: TableShape
  style?: CSSProperties
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

export function TableShapeCard({ shape, style, onDragStart, onResizeStart }: TableShapeCardProps) {
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
