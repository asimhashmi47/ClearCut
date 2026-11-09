import { expectedModelHash } from './modelIntegrity.ts'

const CHUNK_BYTES = 6 * 1024 * 1024
const CHUNK_TIMEOUT_MS = 30_000
const PROBE_TIMEOUT_MS = 20_000
const MAX_CHUNK_ATTEMPTS = 4
const MAX_PROBE_ATTEMPTS = 3

type Options = {
  fetch?: typeof fetch
  wait?: (milliseconds: number) => Promise<unknown>
  /** When set, every model file must have a hash and match it. */
  expectedHash?: (url: string) => string | undefined
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function sha256(chunks: Uint8Array<ArrayBuffer>[]) {
  const whole = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    whole.set(chunk, offset)
    offset += chunk.length
  }
  const digest = await crypto.subtle.digest('SHA-256', whole)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Passes bytes straight through so progress keeps working, then fails the stream
 * at the very end if the file doesn't match. A reader that sees the failure never
 * gets a complete file, so a bad model can't be loaded or cached.
 */
function verifyResponse(response: Response, expected: string) {
  if (!response.ok || !response.body) return response
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
      transform(chunk, controller) {
        chunks.push(chunk)
        controller.enqueue(chunk)
      },
      async flush() {
        const actual = await sha256(chunks)
        chunks.length = 0
        if (actual !== expected) throw new Error('Model integrity check failed')
      },
    }),
  )
  return new Response(body, { status: response.status, headers: response.headers })
}

/**
 * Downloads large model files in small ranges, retrying each one. A single long
 * request can stall or drop on an unreliable connection and lose everything;
 * this way only the current chunk is ever retried.
 */
export function createResilientFetch({ fetch: request = (...args) => fetch(...args), wait = sleep, expectedHash }: Options = {}) {
  async function fetchRange(url: string, start: number, end: number) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await request(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
        })
        if (response.status !== 206) throw new Error(`Unexpected status ${response.status}`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.length !== end - start + 1) throw new Error(`Incomplete chunk: ${bytes.length} bytes`)
        return bytes
      } catch (reason) {
        if (attempt >= MAX_CHUNK_ATTEMPTS) throw reason
        await wait(Math.min(8000, 500 * 2 ** attempt))
      }
    }
  }

  /** Reads a file's size from a one-byte request. Returns 0 if the host can't serve ranges. */
  async function probeSize(url: string) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const probe = await request(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
        const total = Number(probe.headers.get('content-range')?.split('/')[1])
        await probe.body?.cancel()
        return probe.status === 206 && Number.isSafeInteger(total) && total > 0 ? total : 0
      } catch (reason) {
        if (attempt >= MAX_PROBE_ATTEMPTS) throw reason
        await wait(1000 * attempt)
      }
    }
  }

  return async function resilientFetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = String(input)
    const isModel = /\.onnx(_data)?(\?|$)/.test(url)
    const expected = expectedHash?.(url)
    if (expectedHash && isModel && !expected) throw new Error('Model integrity check failed: unknown file')
    const checked = (response: Response) => (expected ? verifyResponse(response, expected) : response)

    if (!isModel) return checked(await request(input, init))

    const total = await probeSize(url)
    if (!total) return checked(await request(input, init))

    let offset = 0
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      async pull(controller) {
        const end = Math.min(offset + CHUNK_BYTES, total) - 1
        try {
          controller.enqueue(await fetchRange(url, offset, end))
          offset = end + 1
          if (offset >= total) controller.close()
        } catch (reason) {
          controller.error(reason)
        }
      },
    })

    return checked(
      new Response(body, {
        status: 200,
        headers: { 'content-length': String(total), 'content-type': 'application/octet-stream' },
      }),
    )
  }
}

export const resilientFetch = createResilientFetch({ expectedHash: expectedModelHash })
