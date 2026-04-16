/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useContext, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { indentUnit } from '@codemirror/language'
import { type EditorView, keymap } from '@codemirror/view'
import { stopEventPropagation, useEditor } from 'tldraw'
import { RuntimeContext } from '../runtime'
import type { CodeShape, CodeShapeProps } from '../types'

type CodeShapeCardProps = {
  shape: CodeShape
  style?: CSSProperties
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

export function CodeShapeCard({ shape, style, onDragStart, onResizeStart }: CodeShapeCardProps) {
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

      <div className="code-shape__editor" data-stop-canvas-shortcuts="true" style={{ height: editorHeight }}>
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
