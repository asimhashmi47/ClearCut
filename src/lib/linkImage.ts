import { MAX_FILE_BYTES } from '../config.ts'
import { imageProblem } from './imageRules.ts'

export type LinkImageResult = { status: 'ok'; blob: Blob } | { status: 'problem'; message: string } | { status: 'cancelled' }

type Options = {
  signal: AbortSignal
  fetch?: typeof fetch
  createTimeout?: (milliseconds: number) => AbortSignal
}

const TIME_LIMIT_MS = 30_000
const BLOCKED = "That site doesn't allow other apps to load its images. Save the image, then drop it here."
const FAILED = 'That image could not be downloaded. Save it, then drop it here.'
const TOO_SLOW = 'That site took too long to respond. Save the image, then drop it here.'

const problem = (message: string): LinkImageResult => ({ status: 'problem', message })
const CANCELLED: LinkImageResult = { status: 'cancelled' }

/** Downloads an image from a link, reading no more than the size and time limits allow. */
export async function loadImageFromLink(url: URL, { signal, fetch: request = (...args) => fetch(...args), createTimeout = (milliseconds) => AbortSignal.timeout(milliseconds) }: Options): Promise<LinkImageResult> {
  const timeout = createTimeout(TIME_LIMIT_MS)
  // A person cancelling takes priority over the time limit.
  const interrupted = (otherwise: string) => (signal.aborted ? CANCELLED : problem(timeout.aborted ? TOO_SLOW : otherwise))

  let response: Response
  try {
    response = await request(url.href, { signal: AbortSignal.any([signal, timeout]) })
  } catch {
    return interrupted(BLOCKED)
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    return problem(`That link didn't return an image (error ${response.status}). Check the address and try again.`)
  }

  // Checked first, so an unusable response is refused without downloading it.
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const declaredSize = Number(response.headers.get('content-length')) || 1
  const refusal = imageProblem({ type, size: declaredSize })
  if (refusal) {
    await response.body?.cancel().catch(() => undefined)
    return problem(refusal)
  }

  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  try {
    const reader = response.body?.getReader()
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      // The declared size can't be trusted, so the limit is enforced while reading.
      if (received > MAX_FILE_BYTES) {
        await reader.cancel()
        return problem(imageProblem({ type, size: received }))
      }
      chunks.push(value)
    }
  } catch {
    return interrupted(FAILED)
  }

  const blob = new Blob(chunks, { type })
  const finalRefusal = imageProblem(blob)
  return finalRefusal ? problem(finalRefusal) : { status: 'ok', blob }
}
