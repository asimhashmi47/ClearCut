/** Project identity. Rename the app or point it at your repository from here. */
export const APP_NAME = 'Clearcut'

/** Leave empty to hide every GitHub link. Example: https://github.com/you/clearcut */
export const REPO_URL = 'https://github.com/asimhashmi47/clear-cut'

export const APP_LICENSE = 'AGPL-3.0'

/** Contact details shown beside the copyright notice in the footer. */
export const CONTACT_EMAIL = 'asimhashmi47@gmail.com'
export const AUTHOR_URL = 'https://masimaziz.com'

/** What's in the photo. Each model is strong on one and weak on the other. */
export type Subject = 'person' | 'object'

export const MODELS: Record<Subject, { id: string; name: string; license: string; url: string }> = {
  person: {
    id: 'onnx-community/ormbg-ONNX',
    name: 'ormbg',
    license: 'Apache 2.0',
    url: 'https://huggingface.co/onnx-community/ormbg-ONNX',
  },
  object: {
    id: 'onnx-community/ISNet-ONNX',
    name: 'ISNet',
    license: 'AGPL-3.0',
    url: 'https://huggingface.co/onnx-community/ISNet-ONNX',
  },
}

/** Upper bound on the decoded image, to keep browsers from running out of canvas memory. */
export const MAX_IMAGE_EDGE = 8192
/** Checked from the file header, so an oversized image is never decoded at all. */
export const MAX_IMAGE_PIXELS = 120_000_000
export const MAX_FILE_BYTES = 40 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
