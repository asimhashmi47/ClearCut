import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Landing } from './components/Landing'
import { Studio } from './components/Studio'
import { ACCEPTED_TYPES, APP_NAME } from './config'
import { fileNameFromLink, imageProblem, parseImageLink } from './lib/imageRules'
import { loadImageFromLink } from './lib/linkImage'
import { originalOf, type Sample } from './lib/samples'
import { useRemover } from './lib/useRemover'

const ease = [0.16, 1, 0.3, 1] as const

function App() {
  const { state, start, retry, reset, changeSubject } = useRemover()
  const [error, setError] = useState('')
  const [fetchingLink, setFetchingLink] = useState(false)
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const linkRequest = useRef<AbortController | null>(null)
  const reduceMotion = useReducedMotion()
  const studioOpen = state.phase !== 'idle'

  const cancelLink = useCallback(() => {
    linkRequest.current?.abort()
    linkRequest.current = null
    setFetchingLink(false)
  }, [])

  const closeStudio = useCallback(() => {
    setError('')
    cancelLink()
    reset()
  }, [cancelLink, reset])

  const chooseFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      cancelLink()
      const problem = imageProblem(file)
      if (problem) {
        setError(problem)
        return
      }
      setError('')
      void start(file, file.name)
    },
    [cancelLink, start],
  )

  const chooseUrl = useCallback(
    async (value: string) => {
      const parsed = parseImageLink(value)
      if (!parsed) {
        setError('Enter a full image link starting with https://.')
        return
      }

      cancelLink()
      const request = new AbortController()
      linkRequest.current = request
      setError('')
      setFetchingLink(true)

      const result = await loadImageFromLink(parsed, { signal: request.signal })
      if (linkRequest.current !== request) return
      linkRequest.current = null
      setFetchingLink(false)
      if (result.status === 'problem') setError(result.message)
      if (result.status === 'ok') void start(result.blob, fileNameFromLink(parsed))
    },
    [cancelLink, start],
  )

  const chooseSample = useCallback(
    async (sample: Sample) => {
      cancelLink()
      try {
        const response = await fetch(originalOf(sample))
        setError('')
        void start(await response.blob(), `${sample.id}.webp`, sample.subject)
      } catch {
        setError('That sample could not be loaded. Try choosing your own image.')
      }
    },
    [cancelLink, start],
  )

  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files')

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current += 1
      setDrop({ x: event.clientX, y: event.clientY })
    }
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDrop(null)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDrop(null)
      chooseFile(event.dataTransfer?.files[0])
    }
    const onPaste = (event: ClipboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      const image = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'))
      const file = image?.getAsFile()
      if (file) {
        chooseFile(file)
        return
      }
      const text = event.clipboardData?.getData('text/plain').trim() ?? ''
      if (/^https?:\/\//.test(text)) void chooseUrl(text)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [chooseFile, chooseUrl])

  useEffect(() => {
    document.body.style.overflow = studioOpen ? 'hidden' : ''
  }, [studioOpen])

  useEffect(() => {
    document.title = state.phase === 'done' ? `Done: ${state.name} | ${APP_NAME}` : `${APP_NAME}: remove image backgrounds for free, in your browser`
  }, [state.name, state.phase])

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease }}>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={(event) => {
          chooseFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />

      <div inert={studioOpen}>
        <Landing error={error} fetchingLink={fetchingLink} demoPaused={studioOpen} onChooseFile={() => fileInput.current?.click()} onChooseSample={chooseSample} onChooseUrl={chooseUrl} />
      </div>

      <AnimatePresence>
        {studioOpen && <Studio key="studio" state={state} notice={error} fetchingLink={fetchingLink} onSubjectChange={changeSubject} onClose={closeStudio} onRetry={retry} onPickAnother={() => fileInput.current?.click()} />}
      </AnimatePresence>

      <AnimatePresence>
        {drop && (
          <motion.div
            className="drop-veil checker"
            aria-hidden="true"
            initial={reduceMotion ? { opacity: 0 } : { clipPath: `circle(0px at ${drop.x}px ${drop.y}px)` }}
            animate={reduceMotion ? { opacity: 1 } : { clipPath: `circle(150vmax at ${drop.x}px ${drop.y}px)` }}
            exit={reduceMotion ? { opacity: 0 } : { clipPath: `circle(0px at ${drop.x}px ${drop.y}px)` }}
            transition={{ duration: 0.6, ease }}
          >
            <p>Let go.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

export default App
