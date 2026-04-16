import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import html2canvas from 'html2canvas'
import type { FramePreset, RecordingFrame } from '../types'

type UseRecordingOptions = {
  workspaceRef: MutableRefObject<HTMLDivElement | null>
  frame: RecordingFrame
  framePreset: FramePreset
  showFrame: boolean
  clampFrame: (frame: RecordingFrame) => RecordingFrame
}

export function useRecording({
  workspaceRef,
  frame,
  framePreset,
  showFrame,
  clampFrame,
}: UseRecordingOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recordingMimeTypeRef = useRef('video/webm')
  const recordingLoopRef = useRef<{ active: boolean }>({ active: false })
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const stopRecording = useCallback(() => {
    recordingLoopRef.current.active = false
    recorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!workspaceRef.current || !bounds || isRecording || !showFrame) return

    const crop = clampFrame(frame)
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    const recorderCanvas = document.createElement('canvas')
    recorderCanvas.width = Math.floor(crop.width * scale)
    recorderCanvas.height = Math.floor(crop.height * scale)

    const ctx = recorderCanvas.getContext('2d')
    if (!ctx) return

    recorderCanvasRef.current = recorderCanvas
    chunksRef.current = []
    setIsRecording(true)

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))

    const mimeType = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm',
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? 'video/webm'

    const recorder = new MediaRecorder(recorderCanvas.captureStream(10), { mimeType })
    recorderRef.current = recorder
    recordingMimeTypeRef.current = mimeType

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const actualMimeType = recorder.mimeType || recordingMimeTypeRef.current || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: actualMimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const extension = actualMimeType.includes('mp4') ? 'mp4' : 'webm'
      anchor.download = `whiteboardplus-${framePreset.label.replace(':', 'x')}.${extension}`
      anchor.click()
      URL.revokeObjectURL(url)
      recorderRef.current = null
      recorderCanvasRef.current = null
      recordingMimeTypeRef.current = 'video/webm'
    }

    recorder.start(250)
    recordingLoopRef.current.active = true

    const renderRecordingFrame = async () => {
      if (!recordingLoopRef.current.active || !workspaceRef.current || !recorderCanvasRef.current) return

      const snapshot = await html2canvas(workspaceRef.current, {
        backgroundColor: '#f3f1eb',
        width: crop.width,
        height: crop.height,
        x: crop.x,
        y: crop.y,
        scale,
        logging: false,
        useCORS: true,
      })

      ctx.clearRect(0, 0, recorderCanvas.width, recorderCanvas.height)
      ctx.drawImage(snapshot, 0, 0, recorderCanvas.width, recorderCanvas.height)

      if (recordingLoopRef.current.active) {
        window.setTimeout(() => {
          void renderRecordingFrame()
        }, 100)
      }
    }

    void renderRecordingFrame()
  }, [clampFrame, frame, framePreset.label, isRecording, showFrame, workspaceRef])

  return {
    isRecording,
    startRecording,
    stopRecording,
  }
}
