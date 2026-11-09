// Copies the ONNX Runtime files into public/ort, so the app loads them from its
// own origin instead of a third-party CDN. Runs automatically before dev and build.
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

const source = 'node_modules/onnxruntime-web/dist'
const target = 'public/ort'
const files = (await readdir(source)).filter((file) => /^ort-wasm-simd-threaded.*\.(mjs|wasm)$/.test(file))

await mkdir(target, { recursive: true })
await Promise.all(files.map((file) => copyFile(path.join(source, file), path.join(target, file))))
console.log(`Copied ${files.length} runtime files to ${target}`)
