import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowDownToLine, ArrowLeft, Check, Copy, ImagePlus, RotateCcw } from 'lucide-react'
import { CompareStage } from './CompareStage'
import { ThemeToggle, Wordmark } from './Brand'
import { formatBytes, renderExport, saveBlob, type ExportFormat } from '../lib/exportImage'
import type { RemoverState } from '../lib/useRemover'
import type { Subject } from '../config'

type StudioProps = {
  state: RemoverState
  /** A problem with the last image chosen while the studio is open. */
  notice: string
  fetchingLink: boolean
  onSubjectChange: (subject: Subject) => void
  onClose: () => void
  onRetry: () => void
  onPickAnother: () => void
}

const swatches = [
  { label: 'Transparent', value: null },
  { label: 'White', value: '#ffffff' },
  { label: 'Near black', value: '#091413' },
  { label: 'Key green', value: '#08cb00' },
  { label: 'Sky', value: '#bcdcff' },
  { label: 'Coral', value: '#ff8a70' },
] as const

const subjects: { value: Subject; label: string }[] = [
  { value: 'person', label: 'People' },
  { value: 'object', label: 'Objects & pets' },
]

const ease = [0.16, 1, 0.3, 1] as const

function statusCopy(state: RemoverState) {
  switch (state.phase) {
    case 'decoding':
      return { title: 'Reading your image', detail: 'Getting everything ready.' }
    case 'downloading':
      return {
        title: state.download?.total && state.download.loaded < state.download.total ? `Downloading the model: ${formatBytes(state.download.loaded)} of ${formatBytes(state.download.total)}` : 'Loading the model',
        detail: 'Only slow on the first visit. It stays cached in your browser after this.',
      }
    case 'inferring':
      return {
        title: 'Finding the subject',
        detail: state.device === 'wasm' ? 'Running on your CPU. On this device it can take a minute.' : 'Running on your graphics card.',
      }
    case 'finishing':
      return { title: 'Cutting it out', detail: 'Applying the mask at full resolution.' }
    default:
      return { title: '', detail: '' }
  }
}

export function Studio({ state, notice: inputError, fetchingLink, onSubjectChange, onClose, onRetry, onPickAnother }: StudioProps) {
  const [color, setColor] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const reduceMotion = useReducedMotion()

  const isWorking = ['decoding', 'downloading', 'inferring', 'finishing'].includes(state.phase)
  const status = useMemo(() => statusCopy(state), [state])
  const progress = state.download && state.download.total > 0 ? state.download.loaded / state.download.total : null

  useEffect(() => {
    heading.current?.focus()
  }, [])

  useEffect(() => {
    // A finished result is only discarded on purpose, through the visible button.
    if (state.phase === 'done') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, state.phase])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2400)
    return () => clearTimeout(timer)
  }, [notice])

  async function download() {
    if (!state.result) return
    setExporting(true)
    try {
      saveBlob(await renderExport(state.result.blob, color, format), state.name)
      setNotice('Saved to your downloads')
    } catch {
      setNotice('Could not save this image')
    } finally {
      setExporting(false)
    }
  }

  async function copy() {
    if (!state.result) return
    try {
      const blob = await renderExport(state.result.blob, color, 'png')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setNotice('Copied to clipboard')
    } catch {
      setNotice('This browser blocked copying. Use Download instead.')
    }
  }

  return (
    <motion.div
      className="studio"
      initial={reduceMotion ? { opacity: 0 } : { clipPath: 'inset(100% 0 0 0)' }}
      animate={reduceMotion ? { opacity: 1 } : { clipPath: 'inset(0% 0 0 0)' }}
      exit={reduceMotion ? { opacity: 0 } : { clipPath: 'inset(100% 0 0 0)' }}
      transition={{ duration: 0.55, ease }}
    >
      <header className="studio-bar">
        <motion.button className="text-button" type="button" whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }} onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{state.phase === 'done' ? 'Start over' : 'Back'}</span>
        </motion.button>
        <Wordmark />
        <ThemeToggle />
      </header>

      <div className="studio-body">
        <main className="studio-stage" aria-busy={isWorking}>
          <h1 className="visually-hidden" ref={heading} tabIndex={-1}>
            {state.phase === 'done' ? `Background removed from ${state.name}` : `Removing the background from ${state.name}`}
          </h1>

          {state.result && state.originalUrl ? (
            <CompareStage
              key={state.result.url}
              original={state.originalUrl}
              cutout={state.result.url}
              alt={state.name}
              color={color}
              fit="contain"
              width={state.width}
              height={state.height}
              sweepKey={state.result.url}
              className="studio-compare"
            />
          ) : (
            state.originalUrl && (
              <div className="studio-preview" style={state.width ? ({ '--ratio': state.width / state.height, aspectRatio: `${state.width} / ${state.height}` } as CSSProperties) : undefined}>
                <img src={state.originalUrl} alt={`${state.name}, being processed`} />
                {isWorking && !reduceMotion && (
                  <motion.span
                    className="scanline"
                    initial={{ top: '0%' }}
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2.8, ease: 'easeInOut', repeat: Infinity }}
                  />
                )}
              </div>
            )
          )}
        </main>

        <aside className="studio-panel" aria-label="Output options">
          <fieldset className="field subject-field">
            <legend>What's in the photo?</legend>
            <div className="segmented is-wide">
              {subjects.map((option) => (
                <button key={option.value} type="button" aria-pressed={state.subject === option.value} onClick={() => state.subject !== option.value && onSubjectChange(option.value)}>
                  {state.subject === option.value && <motion.span layoutId="subject-pill" className="segmented-pill" />}
                  <span className="segmented-label">{option.label}</span>
                </button>
              ))}
            </div>
            <p className="subject-hint">Something missing from the cutout? Try the other option.</p>
          </fieldset>

          <AnimatePresence mode="wait" initial={false}>
            {isWorking && (
              <motion.div key="working" className="panel-status" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="panel-title">{status.title}</p>
                <p className="panel-detail">{status.detail}</p>
                <div className="meter" aria-hidden="true">
                  {progress === null ? (
                    <motion.span className="meter-fill is-indeterminate" animate={reduceMotion ? undefined : { x: ['-100%', '260%'] }} transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }} />
                  ) : (
                    <motion.span className="meter-fill" style={{ originX: 0 }} animate={{ scaleX: progress }} transition={{ duration: 0.25, ease: 'easeOut' }} />
                  )}
                </div>
              </motion.div>
            )}

            {state.phase === 'error' && (
              <motion.div key="error" className="panel-status" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="panel-title with-icon">
                  <AlertTriangle size={18} aria-hidden="true" /> That didn't work
                </p>
                <p className="panel-detail">{state.error}</p>
                <div className="panel-actions">
                  {state.retryable && (
                    <motion.button className="button is-key" type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={onRetry}>
                      <RotateCcw size={16} aria-hidden="true" /> Try again
                    </motion.button>
                  )}
                  <motion.button className="button is-quiet" type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={onPickAnother}>
                    <ImagePlus size={16} aria-hidden="true" /> Choose another image
                  </motion.button>
                </div>
              </motion.div>
            )}

            {state.phase === 'done' && state.result && (
              <motion.div key="done" className="panel-controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease, delay: 0.1 }}>
                <div>
                  <p className="panel-title">Background removed</p>
                  <p className="panel-detail">
                    {state.width} × {state.height}, done in {(state.result.milliseconds / 1000).toFixed(1)}s on your {state.device === 'webgpu' ? 'GPU' : 'CPU'}.
                  </p>
                </div>

                <fieldset className="field">
                  <legend>Background</legend>
                  <div className="swatches">
                    {swatches.map((swatch) => (
                      <motion.button
                        key={swatch.label}
                        type="button"
                        className={`swatch ${swatch.value === null ? 'checker' : ''} ${color === swatch.value ? 'is-selected' : ''}`}
                        style={swatch.value ? { background: swatch.value } : undefined}
                        aria-label={swatch.label}
                        aria-pressed={color === swatch.value}
                        title={swatch.label}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setColor(swatch.value)}
                      />
                    ))}
                    <label className="swatch swatch-custom" title="Custom color">
                      <span className="visually-hidden">Custom background color</span>
                      <input type="color" value={color ?? '#ffffff'} onChange={(event) => setColor(event.target.value)} />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="field">
                  <legend>Format</legend>
                  <div className="segmented">
                    {(['png', 'webp'] as const).map((option) => (
                      <button key={option} type="button" aria-pressed={format === option} onClick={() => setFormat(option)}>
                        {format === option && <motion.span layoutId="format-pill" className="segmented-pill" />}
                        <span className="segmented-label">{option.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="panel-actions">
                  <motion.button className="button is-key" type="button" disabled={exporting} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={download}>
                    <ArrowDownToLine size={18} aria-hidden="true" /> Download {format.toUpperCase()}
                  </motion.button>
                  <motion.button className="button is-quiet" type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={copy}>
                    <Copy size={16} aria-hidden="true" /> Copy image
                  </motion.button>
                  <motion.button className="button is-quiet" type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={onPickAnother}>
                    <ImagePlus size={16} aria-hidden="true" /> Choose another image
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {fetchingLink && (
            <p className="panel-note" role="status">
              Fetching that image...
            </p>
          )}

          {inputError && (
            <p className="panel-error" role="alert">
              {inputError}
            </p>
          )}

          <AnimatePresence>
            {notice && (
              <motion.p key={notice} className="toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                <Check size={15} aria-hidden="true" /> {notice}
              </motion.p>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </motion.div>
  )
}
