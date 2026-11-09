import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { AnimatePresence, motion, transform, useAnimationFrame, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { ArrowDownToLine, Pause, Play } from 'lucide-react'
import { Mark } from './Brand'
import { cutoutOf, originalOf, samples } from '../lib/samples'

const TOTAL = 9.4

const steps = [
  { label: 'Drop', start: 0, status: 'Image received' },
  { label: 'Detect', start: 1.3, status: 'Finding the subject' },
  { label: 'Remove', start: 3.4, status: 'Removing the background' },
  { label: 'Recolor', start: 4.9, status: 'Trying backgrounds' },
  { label: 'Export', start: 7.2, status: 'Saved. 0 bytes uploaded' },
]

const stepAt = (time: number) => steps.reduce((current, step, index) => (time >= step.start ? index : current), 0)
const endOf = (index: number) => steps[index + 1]?.start ?? TOTAL

/** Sample used for the still frame shown to people who prefer reduced motion. */
const STILL_TIME = 4.95

const backgrounds = [
  { className: 'checker', style: undefined, window: [0, 0.01, 5.1, 5.2] },
  { className: '', style: { background: '#ffffff' }, window: [5.1, 5.25, 5.8, 5.95] },
  { className: '', style: { background: 'var(--hunt-demo-a)' }, window: [5.8, 5.95, 6.5, 6.65] },
  { className: '', style: { background: 'var(--hunt-demo-b)' }, window: [6.5, 6.65, TOTAL - 0.01, TOTAL] },
] as const

const expo = (progress: number) => (progress === 1 ? 1 : 1 - 2 ** (-10 * progress))
const clampEase = { clamp: true, ease: expo }

type Point = { x: number; y: number }
type Targets = { swatches: Point[]; download: Point }

function useRange(time: MotionValue<number>, from: number, to: number) {
  return useTransform(time, [from, to], [0, 1], clampEase)
}

function useFrameTargets(frame: RefObject<HTMLDivElement | null>) {
  const targets = useRef<Targets>({ swatches: [], download: { x: 80, y: 85 } })

  useEffect(() => {
    const root = frame.current
    if (!root) return

    const measure = () => {
      const bounds = root.getBoundingClientRect()
      if (!bounds.width) return
      const centerOf = (element: Element): Point => {
        const box = element.getBoundingClientRect()
        return {
          x: ((box.left + box.width / 2 - bounds.left) / bounds.width) * 100,
          y: ((box.top + box.height / 2 - bounds.top) / bounds.height) * 100,
        }
      }
      targets.current = {
        swatches: Array.from(root.querySelectorAll('[data-demo-swatch]')).map(centerOf),
        download: centerOf(root.querySelector('[data-demo-download]') ?? root),
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [frame])

  return targets
}

function Swatch({ time, background }: { time: MotionValue<number>; background: (typeof backgrounds)[number] }) {
  const opacity = useTransform(time, [...background.window], [0, 1, 1, 0])
  return (
    <div className={`demo-swatch ${background.className}`} style={background.style as CSSProperties | undefined} data-demo-swatch="">
      <motion.span className="demo-swatch-ring" style={{ opacity }} />
    </div>
  )
}

function BackgroundLayer({ time, background }: { time: MotionValue<number>; background: (typeof backgrounds)[number] }) {
  const opacity = useTransform(time, [...background.window], [0, 1, 1, 0])
  return <motion.div className={`demo-layer ${background.className}`} style={{ ...(background.style as CSSProperties | undefined), opacity }} />
}

function StepButton({ time, index, active, onSelect }: { time: MotionValue<number>; index: number; active: boolean; onSelect: () => void }) {
  const scaleX = useTransform(time, [steps[index].start, endOf(index)], [0, 1], { clamp: true })
  return (
    <button type="button" className={`demo-step ${active ? 'is-active' : ''}`} aria-current={active ? 'step' : undefined} onClick={onSelect}>
      <span>{steps[index].label}</span>
      <span className="demo-step-track" aria-hidden="true">
        <motion.span className="demo-step-fill" style={{ scaleX, originX: 0 }} />
      </span>
    </button>
  )
}

export function HeroDemo({ paused }: { paused: boolean }) {
  const reduceMotion = useReducedMotion()
  const reel = useMemo(() => samples.filter((sample) => sample.id !== 'car'), [])
  const [sampleIndex, setSampleIndex] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const frame = useRef<HTMLDivElement>(null)
  const inView = useInView(frame, { amount: 0.25 })
  const targets = useFrameTargets(frame)

  const sample = reel[sampleIndex]
  const time = useMotionValue(reduceMotion ? STILL_TIME : 0)
  const isAnimated = !reduceMotion

  useEffect(() => {
    for (const item of reel) {
      new Image().src = originalOf(item)
      new Image().src = cutoutOf(item)
    }
  }, [reel])

  useAnimationFrame((_, delta) => {
    if (!isAnimated || paused || !playing || !inView || document.hidden) return
    const next = time.get() + Math.min(delta, 50) / 1000
    if (next >= TOTAL) {
      time.set(0)
      setSampleIndex((index) => (index + 1) % reel.length)
      return
    }
    time.set(next)
  })

  useMotionValueEvent(time, 'change', (latest) => setStep(stepAt(latest)))

  // Drop: the photo flies in and lands on the stage.
  const landed = useRange(time, 0.1, 1.15)
  const photoScale = useTransform(landed, [0, 1], [0.5, 1])
  const photoX = useTransform(landed, [0, 1], ['-30%', '0%'])
  const photoY = useTransform(landed, [0, 1], ['-26%', '0%'])
  const photoRotate = useTransform(landed, [0, 1], [-9, 0])
  const photoOpacity = useTransform(time, [0, 0.2], [0, 1])
  const hintOpacity = useTransform(time, [0.55, 1], [1, 0])

  // Detect: a scan passes over the image and paints the real subject mask.
  const scan = useRange(time, 1.4, 3.1)
  const scanTop = useTransform(scan, (value) => `${value * 100}%`)
  const scanOpacity = useTransform(time, [1.3, 1.45, 3.1, 3.3], [0, 1, 1, 0])
  const maskClip = useTransform(scan, (value) => `inset(0 0 ${100 - value * 100}% 0)`)
  const maskOpacity = useTransform(time, [1.3, 1.6, 3.5, 3.9], [0, 0.72, 0.72, 0])

  // Key out: the original wipes away to leave the cutout.
  const keyed = useTransform(time, [3.4, 4.8], [0, 1], { clamp: true, ease: (value) => value * value * (3 - 2 * value) })
  const photoClip = useTransform(keyed, (value) => `inset(0 ${value * 100}% 0 0)`)
  const dividerLeft = useTransform(keyed, (value) => `${(1 - value) * 100}%`)
  const dividerOpacity = useTransform(time, [3.3, 3.45, 4.75, 4.9], [0, 1, 1, 0])
  const cutoutOpacity = useTransform(time, [3.35, 3.4], [0, 1])

  // Export: the download button is pressed and the file is saved.
  const downloadScale = useTransform(time, [7.35, 7.48, 7.65], [1, 0.94, 1])
  const toastOpacity = useTransform(time, [7.6, 7.85, TOTAL - 0.4, TOTAL - 0.1], [0, 1, 1, 0])
  const toastY = useTransform(time, [7.6, 7.85], [14, 0], clampEase)

  // A cursor performs each step, so the loop reads as someone using the app.
  const cursorX = useTransform(time, (latest) => {
    const { swatches, download } = targets.current
    return `${transform([0, 1.05, 4.8, 5.15, 5.85, 6.55, 7.3], [18, 52, 60, swatches[1]?.x ?? 80, swatches[2]?.x ?? 80, swatches[3]?.x ?? 80, download.x], clampEase)(latest)}%`
  })
  const cursorY = useTransform(time, (latest) => {
    const { swatches, download } = targets.current
    return `${transform([0, 1.05, 4.8, 5.15, 5.85, 6.55, 7.3], [18, 50, 58, swatches[1]?.y ?? 30, swatches[2]?.y ?? 30, swatches[3]?.y ?? 30, download.y], clampEase)(latest)}%`
  })
  const cursorOpacity = useTransform(time, [0, 0.15, 1.15, 1.4, 4.7, 4.95, TOTAL - 0.6, TOTAL - 0.3], [0, 1, 1, 0, 0, 1, 1, 0])

  function jumpTo(index: number) {
    time.set(steps[index].start)
    setStep(index)
  }

  const imageStyle: CSSProperties = { objectPosition: sample.focus ?? '50% 32%' }

  return (
    <figure className="demo">
      <figcaption className="visually-hidden">
        Looping demo of the app: an image is dropped in, the subject is detected, the background is removed, new backgrounds are tried, and the result is exported without uploading anything.
      </figcaption>

      <div className="demo-window" ref={frame} aria-hidden="true">
        <div className="demo-bar">
          <span className="demo-file">
            <Mark size={14} />
            {sample.id}.webp
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={step} className="demo-status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {steps[step].status}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="demo-body">
          <div className="demo-stage">
            {backgrounds.map((background) => (
              <BackgroundLayer key={background.window[0]} time={time} background={background} />
            ))}

            <motion.div className="demo-layer demo-hint" style={{ opacity: hintOpacity }}>
              <span>Drop an image</span>
            </motion.div>

            <motion.div className="demo-layer" style={{ scale: photoScale, x: photoX, y: photoY, rotate: photoRotate, opacity: photoOpacity }}>
              <motion.img className="demo-image" key={`${sample.id}-cutout`} src={cutoutOf(sample)} alt="" style={{ ...imageStyle, opacity: cutoutOpacity }} draggable={false} />
              <motion.img className="demo-image" key={sample.id} src={originalOf(sample)} alt="" style={{ ...imageStyle, clipPath: photoClip }} draggable={false} />
              <motion.div
                className="demo-layer demo-mask"
                style={{
                  WebkitMaskImage: `url(${cutoutOf(sample)})`,
                  maskImage: `url(${cutoutOf(sample)})`,
                  WebkitMaskPosition: sample.focus,
                  maskPosition: sample.focus,
                  clipPath: maskClip,
                  opacity: maskOpacity,
                }}
              />
            </motion.div>

            <motion.span className="demo-scan" style={{ top: scanTop, opacity: scanOpacity }} />
            <motion.span className="demo-divider" style={{ left: dividerLeft, opacity: dividerOpacity }} />
            <motion.div className="demo-toast" style={{ opacity: toastOpacity, y: toastY }}>
              {sample.id}-cutout.png
            </motion.div>
          </div>

          <div className="demo-rail">
            <div>
              <p className="demo-rail-label">Background</p>
              <div className="demo-swatches">
                {backgrounds.map((background) => (
                  <Swatch key={background.window[0]} time={time} background={background} />
                ))}
              </div>
            </div>
            <motion.div className="demo-download" data-demo-download="" style={{ scale: downloadScale }}>
              <ArrowDownToLine size={15} />
              Download
            </motion.div>
          </div>
        </div>

        {isAnimated && (
          <motion.div className="demo-cursor-track" style={{ x: cursorX, y: cursorY, opacity: cursorOpacity }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M5 3l14 8-6.2 1.6L10 19z" fill="var(--on-hero)" stroke="var(--hero)" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </div>

      <div className="demo-controls">
        {steps.map((item, index) => (
          <StepButton key={item.label} time={time} index={index} active={step === index} onSelect={() => jumpTo(index)} />
        ))}
        {isAnimated && (
          <motion.button className="demo-toggle" type="button" aria-label={playing ? 'Pause demo' : 'Play demo'} whileTap={{ scale: 0.92 }} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </motion.button>
        )}
      </div>
    </figure>
  )
}
