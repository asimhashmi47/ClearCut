import { AutoModel, AutoProcessor, RawImage, env, type PreTrainedModel, type Processor, type Tensor } from '@huggingface/transformers'
import { isGpuFailure } from './failures'
import { resilientFetch } from './resilientFetch'

export type WorkerRequest = {
  type: 'remove'
  id: number
  bitmap: ImageBitmap
  modelId: string
  cpuOnly: boolean
  modelHost: string
  runtimeHost: string
}

export type Device = 'webgpu' | 'wasm'

export type WorkerResponse =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'ready'; device: Device }
  | { type: 'inferring'; id: number }
  | { type: 'gpu-failed'; id: number }
  | { type: 'done'; id: number; mask: ImageBitmap; milliseconds: number }
  | { type: 'error'; id: number; message: string }

type Engine = { model: PreTrainedModel & { sessions: { model: { inputNames: string[] } } }; processor: Processor; device: Device }
// PreTrainedModel declares no tensor-level call signature for this architecture.
type ModelCall = (inputs: Record<string, Tensor>) => Promise<Record<string, Tensor>>

env.allowLocalModels = false
env.fetch = resilientFetch
env.remotePathTemplate = '{model}/'

const post = (message: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(message, { transfer })

async function hasWebGPU() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
  if (!gpu) return false
  try {
    const adapter = await gpu.requestAdapter()
    return Boolean(adapter?.features.has('shader-f16'))
  } catch {
    return false
  }
}

let engine: { modelId: string; ready: Promise<Engine> } | null = null

async function loadEngine(modelId: string, cpuOnly: boolean) {
  // Only one model stays in memory, since each one takes hundreds of megabytes.
  if (engine && engine.modelId !== modelId) {
    const previous = engine.ready
    engine = null
    await previous.then(({ model }) => model.dispose()).catch(() => undefined)
  }
  if (engine) return engine.ready

  const ready = createEngine(modelId, cpuOnly)
  const entry = { modelId, ready }
  engine = entry
  ready.catch(() => {
    if (engine === entry) engine = null
  })
  return ready
}

async function createEngine(modelId: string, cpuOnly: boolean): Promise<Engine> {
    const files = new Map<string, { loaded: number; total: number }>()
    const device: Device = !cpuOnly && (await hasWebGPU()) ? 'webgpu' : 'wasm'

    const model = await AutoModel.from_pretrained(modelId, {
      device,
      // GPUs run 16-bit floats fastest; the CPU build is quantized to use less memory.
      dtype: device === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: (event: { status: string; file?: string; loaded?: number; total?: number }) => {
        // Only the model weights are large enough to be worth reporting.
        if (event.status !== 'progress' || !event.file?.includes('.onnx') || !event.total) return
        files.set(event.file, { loaded: event.loaded ?? 0, total: event.total })
        let loaded = 0
        let total = 0
        for (const file of files.values()) {
          loaded += file.loaded
          total += file.total
        }
        post({ type: 'download', loaded, total })
      },
    })
    const processor = await AutoProcessor.from_pretrained(modelId, {})

    post({ type: 'ready', device })
    return { model: model as Engine['model'], processor, device }
}

/** Runs the model and returns a mask at the model's own size. The app scales it to fit. */
async function createMask({ model, processor }: Engine, bitmap: ImageBitmap) {
  const { width, height } = bitmap
  const inputCanvas = new OffscreenCanvas(width, height)
  const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true })
  if (!inputContext) throw new Error('canvas')
  inputContext.drawImage(bitmap, 0, 0)
  const pixels = inputContext.getImageData(0, 0, width, height)

  const image = new RawImage(pixels.data, width, height, 4).rgb()
  const { pixel_values } = await processor(image)
  const output = await (model as unknown as ModelCall)({ [model.sessions.model.inputNames[0]]: pixel_values })
  const logits = Object.values(output).at(-1)
  if (!logits) throw new Error('The model returned no output.')
  // A Tensor indexes by batch at runtime, which its type declaration doesn't describe.
  const [first] = logits as unknown as Tensor[]
  const maskImage = RawImage.fromTensor(first.mul(255).round().clamp(0, 255).to('uint8'))

  const maskData = new ImageData(maskImage.width, maskImage.height)
  for (let index = 0; index < maskImage.data.length; index += 1) {
    maskData.data[index * 4 + 3] = maskImage.data[index]
  }
  const maskCanvas = new OffscreenCanvas(maskImage.width, maskImage.height)
  maskCanvas.getContext('2d')?.putImageData(maskData, 0, 0)
  return maskCanvas.transferToImageBitmap()
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    env.remoteHost = data.modelHost
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = data.runtimeHost
    post({ type: 'download', loaded: 0, total: 0 })
    const loaded = await loadEngine(data.modelId, data.cpuOnly)
    post({ type: 'inferring', id: data.id })
    const started = performance.now()
    const mask = await createMask(loaded, data.bitmap)
    post({ type: 'done', id: data.id, mask, milliseconds: performance.now() - started }, [mask])
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    // Some GPUs can't run a given model. The runtime keeps its first backend for
    // the life of a worker, so the app answers this by starting a CPU-only one.
    if (!data.cpuOnly && isGpuFailure(message)) {
      console.warn('[removal] WebGPU failed', message)
      post({ type: 'gpu-failed', id: data.id })
    } else {
      post({ type: 'error', id: data.id, message })
    }
  } finally {
    data.bitmap.close()
  }
}
