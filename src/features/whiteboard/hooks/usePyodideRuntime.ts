/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { loadPyodide } from 'pyodide'
import type { Editor } from 'tldraw'
import type { CodeShape, PyodideStatus } from '../types'

type PyodideInstance = Awaited<ReturnType<typeof loadPyodide>>

export function usePyodideRuntime(editorRef: MutableRefObject<Editor | null>) {
  const pyodideRef = useRef<PyodideInstance | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<PyodideStatus>('loading')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const bootPyodide = async () => {
      try {
        setRuntimeStatus('loading')
        const pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        })
        if (cancelled) return
        pyodideRef.current = pyodide
        setRuntimeStatus('ready')
      } catch (error) {
        if (cancelled) return
        setRuntimeStatus('error')
        setRuntimeError(error instanceof Error ? error.message : 'Failed to load Pyodide.')
      }
    }

    void bootPyodide()
    return () => {
      cancelled = true
    }
  }, [])

  const runCode = useCallback(async (shapeId: string, code: string) => {
    const editor = editorRef.current
    const pyodide = pyodideRef.current
    if (!editor || !pyodide) return

    const shape = editor.getShape(shapeId as any) as CodeShape | undefined
    if (!shape || shape.type !== 'code') return

    editor.updateShape({
      id: shapeId,
      type: 'code',
      props: {
        ...shape.props,
        isRunning: true,
        output: '',
        error: '',
      },
    } as any)

    try {
      const serialized = await pyodide.runPythonAsync(`
import io
import json
import traceback
from contextlib import redirect_stdout, redirect_stderr

_stdout = io.StringIO()
_stderr = io.StringIO()
_error = ""

try:
    with redirect_stdout(_stdout), redirect_stderr(_stderr):
        exec(${JSON.stringify(code)}, globals())
except Exception:
    _error = traceback.format_exc()

json.dumps({
    "stdout": _stdout.getvalue(),
    "stderr": _stderr.getvalue(),
    "error": _error,
})
`)

      const parsed = JSON.parse(String(serialized)) as {
        stdout: string
        stderr: string
        error: string
      }

      const latestShape = editor.getShape(shapeId as any) as CodeShape | undefined
      if (!latestShape || latestShape.type !== 'code') return

      const output = [parsed.stdout, parsed.stderr].filter(Boolean).join(parsed.stdout && parsed.stderr ? '\n' : '')

      editor.updateShape({
        id: shapeId,
        type: 'code',
        props: {
          ...latestShape.props,
          isRunning: false,
          output: output || 'Code executed successfully, but produced no output.',
          error: parsed.error,
        },
      } as any)
    } catch (error) {
      const latestShape = editor.getShape(shapeId as any) as CodeShape | undefined
      if (!latestShape || latestShape.type !== 'code') return

      editor.updateShape({
        id: shapeId,
        type: 'code',
        props: {
          ...latestShape.props,
          isRunning: false,
          error: error instanceof Error ? error.message : 'Execution failed.',
        },
      } as any)
    }
  }, [editorRef])

  return {
    runtimeStatus,
    runtimeError,
    runCode,
  }
}
