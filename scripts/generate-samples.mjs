// Regenerates the showcase images in public/samples from the photos in .samples-src.
// The cutouts on the landing page are real output from the same models the app runs.
//
//   node scripts/generate-samples.mjs            all samples
//   node scripts/generate-samples.mjs animal car only those
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers'
import sharp from 'sharp'

// Uses a local copy of the models when one exists, otherwise downloads them.
env.localModelPath = '.samples-src/models/'

const PERSON_MODEL = 'onnx-community/ormbg-ONNX'
const OBJECT_MODEL = 'onnx-community/ISNet-ONNX'
const PERSON_SAMPLES = new Set(['people'])
const SOURCE_DIR = process.env.SOURCE_DIR ?? '.samples-src'
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? 'public/samples'
const MAX_EDGE = 1400

const only = process.argv.slice(2)
const files = (await readdir(SOURCE_DIR)).filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
const targets = files.filter((file) => only.length === 0 || only.includes(path.parse(file).name))

await mkdir(OUTPUT_DIR, { recursive: true })

const loaded = new Map()

async function loadModel(id) {
  if (!loaded.has(id)) {
    console.log(`Loading ${id}`)
    const model = await AutoModel.from_pretrained(id, {
      dtype: 'fp16',
      session_options: { enableCpuMemArena: false, enableMemPattern: false },
    })
    loaded.set(id, { model, processor: await AutoProcessor.from_pretrained(id) })
  }
  return loaded.get(id)
}

for (const file of targets) {
  const name = path.parse(file).name
  const started = Date.now()
  const resized = await sharp(path.join(SOURCE_DIR, file))
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = resized.info
  await sharp(resized.data, { raw: { width, height, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUTPUT_DIR, `${name}.webp`))

  const { model, processor } = await loadModel(process.env.MODEL_ID ?? (PERSON_SAMPLES.has(name) ? PERSON_MODEL : OBJECT_MODEL))
  const image = new RawImage(new Uint8ClampedArray(resized.data), width, height, 3)
  const { pixel_values } = await processor(image)
  const output = await model({ [model.sessions.model.inputNames[0]]: pixel_values })
  const logits = Object.values(output).at(-1)
  const maskTensor = logits[0].mul(255).round().clamp(0, 255).to('uint8')
  const mask = await RawImage.fromTensor(maskTensor).resize(width, height)

  const rgba = Buffer.alloc(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = resized.data[index * 3]
    rgba[index * 4 + 1] = resized.data[index * 3 + 1]
    rgba[index * 4 + 2] = resized.data[index * 3 + 2]
    rgba[index * 4 + 3] = mask.data[index]
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(path.join(OUTPUT_DIR, `${name}-cutout.webp`))

  console.log(`${name}: ${width}x${height} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}
