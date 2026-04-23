import { useCallback, useContext, useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { indentUnit } from '@codemirror/language'
import { keymap } from '@codemirror/view'
import { RuntimeContext } from '../runtime'
import type { CodeBlock, CodeBlockProps } from '../types'

type CodeShapeCardProps = {
  block: CodeBlock
  style?: CSSProperties
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onUpdateProps: (partial: Partial<CodeBlockProps>) => void
  onDelete: () => void
  onFocus: () => void
}

export function CodeShapeCard({
  block,
  style,
  onDragStart,
  onResizeStart,
  onUpdateProps,
  onDelete,
  onFocus,
}: CodeShapeCardProps) {
  const runtime = useContext(RuntimeContext)
  const outputResizeRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
  } | null>(null)
  const extensions = useMemo(
    () => [python(), indentUnit.of('    '), keymap.of([indentWithTab])],
    [],
  )
  const panelChromeHeight = 52
  const editorMinHeight = 120
  const outputMinHeight = 72
  const availableBodyHeight = Math.max(0, block.props.h - panelChromeHeight)
  const outputVisible = Boolean(block.props.output || block.props.error || block.props.isRunning)
  const maxOutputHeight = Math.max(0, availableBodyHeight - editorMinHeight)
  const minOutputHeight = Math.min(outputMinHeight, maxOutputHeight)
  const outputHeight = outputVisible
    ? Math.min(Math.max(block.props.outputHeight ?? 96, minOutputHeight), maxOutputHeight)
    : 0
  const editorHeight = outputVisible
    ? availableBodyHeight - outputHeight
    : Math.max(180, availableBodyHeight)

  const updateProps = useCallback((partial: Partial<CodeBlockProps>) => {
    onUpdateProps(partial)
  }, [onUpdateProps])

  const clearOutput = useCallback(() => {
    updateProps({
      output: '',
      error: '',
      isRunning: false,
      outputHeight: 96,
    })
  }, [updateProps])

  const beginOutputResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      onFocus()
      outputResizeRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: outputHeight,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [onFocus, outputHeight],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = outputResizeRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return

      const delta = event.clientY - interaction.startY
      const nextHeight = Math.min(
        Math.max(interaction.startHeight - delta, minOutputHeight),
        maxOutputHeight,
      )

      updateProps({ outputHeight: nextHeight })
    }

    const onPointerUp = (event: PointerEvent) => {
      if (outputResizeRef.current?.pointerId === event.pointerId) {
        outputResizeRef.current = null
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [maxOutputHeight, minOutputHeight, updateProps])

  return (
    <div
      className="code-shape"
      style={{ width: block.props.w, height: block.props.h, ...style }}
      onPointerDown={onFocus}
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
            value={block.props.title}
            onChange={(event) => updateProps({ title: event.target.value })}
            aria-label="Code block title"
          />
        </div>
        <div className="code-shape__actions">
          <button
            type="button"
            className="app-button"
            data-stop-canvas-shortcuts="true"
            disabled={!block.props.output && !block.props.error && !block.props.isRunning}
            onClick={clearOutput}
          >
            Clear
          </button>
          <button
            type="button"
            className="app-button"
            data-stop-canvas-shortcuts="true"
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="app-button app-button--primary"
            data-stop-canvas-shortcuts="true"
            disabled={runtime.status !== 'ready' || block.props.isRunning}
            onClick={() => runtime.runCode(block.id, block.props.code)}
          >
            {block.props.isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      <div className="code-shape__editor" data-stop-canvas-shortcuts="true" style={{ height: editorHeight }}>
        <CodeMirror
          value={block.props.code}
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
          onChange={(value) => updateProps({ code: value })}
        />
      </div>

      {outputVisible ? (
        <div
          className={`code-shape__output ${block.props.error ? 'code-shape__output--error' : ''}`}
          data-stop-canvas-shortcuts="true"
          style={{ height: outputHeight }}
        >
          <button
            type="button"
            className="code-shape__output-resize-handle"
            data-stop-canvas-shortcuts="true"
            onPointerDown={beginOutputResize}
            aria-label="Resize output area"
          />
          <div className="code-shape__output-label">
            {block.props.isRunning ? 'Executing in Pyodide' : block.props.error ? 'Error' : 'Output'}
          </div>
          <pre>
            {block.props.isRunning
              ? 'Running Python in the browser...'
              : block.props.error || block.props.output || 'No output yet.'}
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
