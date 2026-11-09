import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Cross-origin isolation lets the WebAssembly fallback use every CPU thread.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// `vite preview` serves the same headers as production. The dev server only gets
// isolation, because a strict content security policy would block hot reloading.
const productionHeaders = Object.fromEntries(
  readFileSync('public/_headers', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s+\S+:/.test(line))
    .map((line) => {
      const separator = line.indexOf(':')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    }),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  server: { headers: isolationHeaders },
  preview: { headers: productionHeaders },
})
