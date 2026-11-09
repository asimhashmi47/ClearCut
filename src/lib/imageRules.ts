import { ACCEPTED_TYPES, MAX_FILE_BYTES } from '../config.ts'

/** Returns a message explaining why an image can't be used, or an empty string if it can. */
export function imageProblem(image: { type: string; size: number }) {
  if (!ACCEPTED_TYPES.includes(image.type)) return 'Choose a JPEG, PNG, WebP, or AVIF image.'
  if (image.size === 0) return 'That file is empty. Choose another image.'
  if (image.size > MAX_FILE_BYTES) return 'Choose an image smaller than 40 MB.'
  return ''
}

/** Parses a pasted or typed link. Only http and https are allowed. */
export function parseImageLink(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

export function fileNameFromLink(url: URL) {
  const segment = url.pathname.split('/').pop() || 'image'
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
