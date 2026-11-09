type CpuOnlyStorage = Pick<Storage, 'getItem' | 'setItem'>

const storageKey = (modelId: string) => `clearcut-cpu-only:${modelId}`

/**
 * Remembers which models a GPU can't run. Tracked per model, because a different
 * model may run fine on the same GPU. The set keeps the fallback working during
 * this visit when browser storage is blocked.
 */
export function createCpuOnlyStore(getStorage: () => CpuOnlyStorage) {
  const models = new Set<string>()

  return {
    isCpuOnly(modelId: string) {
      if (models.has(modelId)) return true
      try {
        return getStorage().getItem(storageKey(modelId)) === '1'
      } catch {
        return false
      }
    },
    remember(modelId: string) {
      models.add(modelId)
      try {
        getStorage().setItem(storageKey(modelId), '1')
      } catch {
        // Without storage, the next visit simply tries the GPU again.
      }
    },
  }
}
