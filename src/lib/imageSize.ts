import { MAX_IMAGE_PIXELS } from '../config.ts'

type Size = { width: number; height: number }

const UNREADABLE = 'This file could not be read as an image. Try a JPEG, PNG, or WebP.'
const TOO_LARGE = `That image is too large. Choose one under ${MAX_IMAGE_PIXELS / 1_000_000} megapixels.`

function tagAt(file: Uint8Array, offset: number) {
  return String.fromCharCode(file[offset], file[offset + 1], file[offset + 2], file[offset + 3])
}

function matches(file: Uint8Array, signature: number[]) {
  return signature.every((value, index) => file[index] === value)
}

function readPng(file: Uint8Array, view: DataView): Size | null {
  if (file.length < 24 || tagAt(file, 12) !== 'IHDR') return null
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpeg(file: Uint8Array, view: DataView): Size | null {
  let offset = 2
  while (offset + 1 < file.length) {
    if (file[offset] !== 0xff) return null
    let marker = file[offset + 1]
    // Any number of 0xff bytes may pad the space before a marker.
    while (marker === 0xff && offset + 2 < file.length) {
      offset += 1
      marker = file[offset + 1]
    }
    offset += 2

    const hasNoLength = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)
    if (hasNoLength) continue
    if (marker === 0xd9 || marker === 0xda || offset + 2 > file.length) return null

    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      if (offset + 7 > file.length) return null
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) }
    }

    const length = view.getUint16(offset)
    if (length < 2) return null
    offset += length
  }
  return null
}

function readWebp(file: Uint8Array, view: DataView): Size | null {
  const chunk = tagAt(file, 12)
  if (chunk === 'VP8 ') {
    if (file.length < 30 || file[23] !== 0x9d || file[24] !== 0x01 || file[25] !== 0x2a) return null
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    if (file.length < 25 || file[20] !== 0x2f) return null
    const bits = view.getUint32(21, true)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    if (file.length < 30) return null
    const read24 = (offset: number) => file[offset] | (file[offset + 1] << 8) | (file[offset + 2] << 16)
    return { width: read24(24) + 1, height: read24(27) + 1 }
  }
  return null
}

type Box = { type: string; start: number; end: number }

function* boxesIn(file: Uint8Array, view: DataView, from: number, limit: number): Generator<Box> {
  let offset = from
  while (offset + 8 <= limit) {
    let size = view.getUint32(offset)
    let header = 8
    if (size === 0) {
      size = limit - offset
    } else if (size === 1) {
      if (offset + 16 > limit || view.getUint32(offset + 8) !== 0) return
      size = view.getUint32(offset + 12)
      header = 16
    }
    if (size < header || offset + size > limit) return
    yield { type: tagAt(file, offset + 4), start: offset + header, end: offset + size }
    offset += size
  }
}

function readAvif(file: Uint8Array, view: DataView): Size | null {
  const ftypEnd = view.getUint32(0)
  const brands: string[] = [tagAt(file, 8)]
  for (let offset = 16; offset + 4 <= Math.min(ftypEnd, file.length); offset += 4) brands.push(tagAt(file, offset))
  if (!brands.includes('avif') && !brands.includes('avis')) return null

  const child = (parent: Box, type: string, skip = 0) => [...boxesIn(file, view, parent.start + skip, parent.end)].find((box) => box.type === type)
  const everything = { type: '', start: 0, end: file.length }
  const meta = child(everything, 'meta')
  const properties = meta && child(meta, 'iprp', 4)
  const container = properties && child(properties, 'ipco')
  if (!container) return null

  // A file can list several sizes, so the largest decides. A small thumbnail
  // must not be able to hide the real dimensions.
  let largest: Size | null = null
  for (const box of boxesIn(file, view, container.start, container.end)) {
    if (box.type !== 'ispe' || box.end - box.start < 12) continue
    const candidate = { width: view.getUint32(box.start + 4), height: view.getUint32(box.start + 8) }
    if (!largest || candidate.width * candidate.height > largest.width * largest.height) largest = candidate
  }
  return largest
}

/** Reads dimensions from the file's own header, without decoding any pixels. */
export function readImageSize(file: Uint8Array): Size | null {
  if (file.length < 12) return null
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  if (matches(file, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return readPng(file, view)
  if (matches(file, [0xff, 0xd8])) return readJpeg(file, view)
  if (tagAt(file, 0) === 'RIFF' && tagAt(file, 8) === 'WEBP') return readWebp(file, view)
  if (tagAt(file, 4) === 'ftyp') return readAvif(file, view)
  return null
}

/** Explains why a file must not be decoded, or returns an empty string if it is safe to. */
export function dimensionProblem(file: Uint8Array) {
  const size = readImageSize(file)
  if (!size || size.width === 0 || size.height === 0) return UNREADABLE
  return size.width * size.height > MAX_IMAGE_PIXELS ? TOO_LARGE : ''
}
