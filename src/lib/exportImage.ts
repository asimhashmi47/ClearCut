export type ExportFormat = 'png' | 'webp'

const MAX_NAME_LENGTH = 100

/** Flattens the cutout over a color, or returns it as is when the background stays transparent. */
export async function renderExport(cutout: Blob, color: string | null, format: ExportFormat) {
  if (!color && format === 'png') return cutout

  const bitmap = await createImageBitmap(cutout)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  if (color) {
    context.fillStyle = color
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: `image/${format}`, quality: 0.95 })
}

export function cutoutFileName(sourceName: string, blobType: string) {
  // Splitting by code point keeps an emoji whole when the name is shortened.
  const base = Array.from(sourceName.replace(/\.[^.]*$/, '').trim()).slice(0, MAX_NAME_LENGTH).join('')
  const extension = blobType === 'image/webp' ? 'webp' : 'png'
  return `${base || 'image'}-cutout.${extension}`
}

export function saveBlob(blob: Blob, sourceName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = cutoutFileName(sourceName, blob.type)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}
