/** Turns a raw runtime error into a message a person can act on. */
export function describeFailure(message: string) {
  if (/integrity/i.test(message)) {
    return 'The model failed a safety check and was not used. Reload the page to try again.'
  }
  if (/memory|allocation|std::bad_alloc/i.test(message)) {
    return 'This device ran out of memory while running the model. Close some tabs or try a computer with more RAM.'
  }
  if (/fetch|network|load|timeout/i.test(message)) {
    return 'The model could not be loaded. Check your connection and try again.'
  }
  return 'Something went wrong while processing this image. Try again, or try a different image.'
}

export function isGpuFailure(message: string) {
  return /webgpu|shader|gpu ?device|device (was )?lost/i.test(message)
}
