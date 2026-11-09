import { MODEL_HASHES } from './modelHashes.ts'

/** Finds the pinned hash for a model file, whichever host it is served from. */
export function expectedModelHash(url: string) {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return undefined
  }
  const file = Object.keys(MODEL_HASHES).find((name) => pathname.endsWith(`/${name}`))
  return file ? MODEL_HASHES[file] : undefined
}
