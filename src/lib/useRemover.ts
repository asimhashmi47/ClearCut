import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_IMAGE_EDGE, MODELS, type Subject } from '../config'
import { createCpuOnlyStore } from './cpuOnly'
import { describeFailure } from './failures'
import { dimensionProblem } from './imageSize'
import type { Device, WorkerRequest, WorkerResponse } from './removal.worker'

export type Phase = 'idle' | 'decoding' | 'downloading' | 'inferring' | 'finishing' | 'done' | 'error'

export type Result = {
  blob: Blob
  url: string
  milliseconds: number
}

export type RemoverState = {
  phase: Phase
  name: string
  originalUrl: string | null
  width: number
  height: number
  download: { loaded: number; total: number } | null
  device: Device | null
  result: Result | null
  error: string | null
  retryable: boolean
  subject: Subject
}

type Job = { id: number; bitmap: ImageBitmap; subject: Subject }

const initialState: RemoverState = {
  subject: 'person',
  phase: 'idle',
  name: '',
  originalUrl: null,
  width: 0,
  height: 0,
  download: null,
  device: null,
  result: null,
  error: null,
  retryable: true,
}

/** The model works at about 1024 pixels, so a larger copy would only cost memory. */
const INFERENCE_EDGE = 2048

const cpuOnly = createCpuOnlyStore(() => localStorage)

async function decode(blob: Blob) {
  const probe = await createImageBitmap(blob)
  const longest = Math.max(probe.width, probe.height)
  if (longest <= MAX_IMAGE_EDGE) return probe
  const scale = MAX_IMAGE_EDGE / longest
  const scaled = await createImageBitmap(blob, {
    resizeWidth: Math.round(probe.width * scale),
    resizeHeight: Math.round(probe.height * scale),
    resizeQuality: 'high',
  })
  probe.close()
  return scaled
}

async function cutOut(bitmap: ImageBitmap, mask: ImageBitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, 0, 0)
  context.globalCompositeOperation = 'destination-in'
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(mask, 0, 0, bitmap.width, bitmap.height)
  return canvas.convertToBlob({ type: 'image/png' })
}

export function useRemover() {
  const [state, setState] = useState<RemoverState>(initialState)
  const worker = useRef<Worker | null>(null)
  // Holds the image being processed, and is cleared once it has finished.
  const job = useRef<Job | null>(null)
  const nextId = useRef(0)
  // The last input, so the same image can be reprocessed with the other model.
  const input = useRef<{ source: Blob; name: string } | null>(null)
  const preferredSubject = useRef<Subject>('person')
  const handlers = useRef<{ message: (event: MessageEvent<WorkerResponse>) => void; crash: () => void }>({ message: () => {}, crash: () => {} })

  const patch = useCallback((next: Partial<RemoverState>) => setState((current) => ({ ...current, ...next })), [])

  const stopWorker = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
  }, [])

  const closeJob = useCallback(() => {
    job.current?.bitmap.close()
    job.current = null
  }, [])

  // A failed run can leave the runtime unusable, so the next attempt gets a new worker.
  const fail = useCallback(
    (error: string, retryable = true) => {
      stopWorker()
      patch({ phase: 'error', download: null, error, retryable })
    },
    [patch, stopWorker],
  )

  const getWorker = useCallback(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./removal.worker.ts', import.meta.url), { type: 'module' })
      worker.current.onmessage = (event) => handlers.current.message(event)
      worker.current.onerror = () => handlers.current.crash()
      worker.current.onmessageerror = () => handlers.current.crash()
    }
    return worker.current
  }, [])

  const send = useCallback(
    async (id: number) => {
      const current = job.current
      if (current?.id !== id) return
      try {
        const scale = Math.min(1, INFERENCE_EDGE / Math.max(current.bitmap.width, current.bitmap.height))
        const forWorker = await createImageBitmap(current.bitmap, {
          resizeWidth: Math.round(current.bitmap.width * scale),
          resizeHeight: Math.round(current.bitmap.height * scale),
          resizeQuality: 'high',
        })
        if (job.current?.id !== id) {
          forWorker.close()
          return
        }
        const modelId = MODELS[current.subject].id
        const request: WorkerRequest = {
          type: 'remove',
          id,
          bitmap: forWorker,
          modelId,
          cpuOnly: cpuOnly.isCpuOnly(modelId),
          modelHost: (import.meta.env.VITE_MODEL_HOST as string | undefined) ?? new URL('models/', document.baseURI).href,
          runtimeHost: new URL('ort/', document.baseURI).href,
        }
        getWorker().postMessage(request, [forWorker])
      } catch {
        if (job.current?.id === id) fail('This image could not be prepared. Try a smaller image.')
      }
    },
    [fail, getWorker],
  )

  const handleMessage = useCallback(
    async ({ data }: MessageEvent<WorkerResponse>) => {
      if ('id' in data && data.id !== job.current?.id) {
        if (data.type === 'done') data.mask.close()
        return
      }

      switch (data.type) {
        case 'download':
          setState((current) => (current.phase === 'downloading' || current.phase === 'decoding' ? { ...current, phase: 'downloading', download: { loaded: data.loaded, total: data.total } } : current))
          break
        case 'ready':
          patch({ device: data.device })
          break
        case 'inferring':
          patch({ phase: 'inferring', download: null })
          break
        case 'gpu-failed':
          stopWorker()
          if (job.current) cpuOnly.remember(MODELS[job.current.subject].id)
          patch({ phase: 'inferring', device: 'wasm' })
          void send(data.id)
          break
        case 'done': {
          const current = job.current
          if (!current) {
            data.mask.close()
            break
          }
          patch({ phase: 'finishing' })
          try {
            const blob = await cutOut(current.bitmap, data.mask)
            if (job.current?.id !== current.id) break
            patch({ phase: 'done', result: { blob, url: URL.createObjectURL(blob), milliseconds: data.milliseconds } })
            closeJob()
          } catch {
            if (job.current?.id === current.id) fail('The result could not be assembled. This image may be too large for this browser.')
          } finally {
            data.mask.close()
          }
          break
        }
        case 'error':
          console.error('[removal]', data.message)
          fail(describeFailure(data.message))
          break
      }
    },
    [closeJob, fail, patch, send, stopWorker],
  )

  useEffect(() => {
    handlers.current = {
      message: (event) => void handleMessage(event),
      crash: () => {
        if (job.current) fail('The image processor stopped unexpectedly. Try again.')
      },
    }
  }, [fail, handleMessage])

  const releaseUrls = useCallback(() => {
    setState((current) => {
      if (current.originalUrl) URL.revokeObjectURL(current.originalUrl)
      if (current.result) URL.revokeObjectURL(current.result.url)
      return current
    })
  }, [])

  // A job only exists while work is in flight, so an idle worker keeps its loaded model.
  const cancelActiveJob = useCallback(() => {
    if (job.current) stopWorker()
    closeJob()
  }, [closeJob, stopWorker])

  const start = useCallback(
    async (source: Blob, name: string, chosen?: Subject) => {
      const id = (nextId.current += 1)
      const subject = chosen ?? preferredSubject.current
      preferredSubject.current = subject
      input.current = { source, name }
      cancelActiveJob()
      releaseUrls()
      setState((current) => ({ ...initialState, device: current.device, subject, phase: 'decoding', name, originalUrl: URL.createObjectURL(source) }))

      let bitmap: ImageBitmap
      try {
        // Decoding is what costs memory, so the header is checked before it starts.
        const problem = dimensionProblem(new Uint8Array(await source.arrayBuffer()))
        if (problem) {
          if (id === nextId.current) fail(problem, false)
          return
        }
        bitmap = await decode(source)
      } catch {
        if (id === nextId.current) fail('This file could not be read as an image. Try a JPEG, PNG, or WebP.', false)
        return
      }
      if (id !== nextId.current) {
        bitmap.close()
        return
      }
      patch({ width: bitmap.width, height: bitmap.height })
      job.current = { id, bitmap, subject }
      await send(id)
    },
    [cancelActiveJob, fail, patch, releaseUrls, send],
  )

  const changeSubject = useCallback(
    (subject: Subject) => {
      if (input.current) void start(input.current.source, input.current.name, subject)
    },
    [start],
  )

  const retry = useCallback(() => {
    const current = job.current
    if (!current) return
    patch({ phase: 'decoding', error: null })
    void send(current.id)
  }, [patch, send])

  const reset = useCallback(() => {
    nextId.current += 1
    input.current = null
    cancelActiveJob()
    releaseUrls()
    setState((current) => ({ ...initialState, device: current.device }))
  }, [cancelActiveJob, releaseUrls])

  useEffect(() => stopWorker, [stopWorker])

  return { state, start, retry, reset, changeSubject }
}
