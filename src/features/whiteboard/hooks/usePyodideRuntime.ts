import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { loadPyodide } from 'pyodide'
import type { CodeBlock, PyodideStatus } from '../types'

type PyodideInstance = Awaited<ReturnType<typeof loadPyodide>>

export function usePyodideRuntime(
  codeBlocksRef: MutableRefObject<CodeBlock[]>,
  setCodeBlocks: Dispatch<SetStateAction<CodeBlock[]>>,
) {
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

  const updateBlock = useCallback((blockId: string, updater: (block: CodeBlock) => CodeBlock) => {
    setCodeBlocks((current) => current.map((block) => (block.id === blockId ? updater(block) : block)))
  }, [setCodeBlocks])

  const runCode = useCallback(async (blockId: string, code: string) => {
    const pyodide = pyodideRef.current
    if (!pyodide) return

    const block = codeBlocksRef.current.find((candidate) => candidate.id === blockId)
    if (!block) return

    updateBlock(blockId, (current) => ({
      ...current,
      props: {
        ...current.props,
        isRunning: true,
        output: '',
        error: '',
      },
    }))

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

      const latestBlock = codeBlocksRef.current.find((candidate) => candidate.id === blockId)
      if (!latestBlock) return

      const output = [parsed.stdout, parsed.stderr].filter(Boolean).join(parsed.stdout && parsed.stderr ? '\n' : '')

      updateBlock(blockId, (current) => ({
        ...current,
        props: {
          ...current.props,
          isRunning: false,
          output: output || 'Code executed successfully, but produced no output.',
          error: parsed.error,
        },
      }))
    } catch (error) {
      const latestBlock = codeBlocksRef.current.find((candidate) => candidate.id === blockId)
      if (!latestBlock) return

      updateBlock(blockId, (current) => ({
        ...current,
        props: {
          ...current.props,
          isRunning: false,
          error: error instanceof Error ? error.message : 'Execution failed.',
        },
      }))
    }
  }, [codeBlocksRef, updateBlock])

  return {
    runtimeStatus,
    runtimeError,
    runCode,
  }
}
