import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { ChevronsLeftRight } from 'lucide-react'

type CompareStageProps = {
  original: string
  cutout: string
  alt: string
  /** Solid color behind the cutout. Null shows the transparency checkerboard. */
  color?: string | null
  /** Where the divider settles after the opening sweep, as a percentage. */
  rest?: number
  /** Replays the sweep whenever this value changes. */
  sweepKey?: string
  fit?: 'cover' | 'contain'
  /** Which part of the images stays in view when the stage crops them. */
  focus?: string
  width?: number
  height?: number
  className?: string
}

const sweepEase = [0.16, 1, 0.3, 1] as const

function usePercent(value: MotionValue<number>, render: (percent: number) => string) {
  return useTransform(value, render)
}

export function CompareStage({ original, cutout, alt, color = null, rest = 0, sweepKey, fit = 'cover', focus, width, height, className = '' }: CompareStageProps) {
  const stage = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  // The opening animation, so that any touch or keypress can take over from it.
  const sweep = useRef<ReturnType<typeof animate> | null>(null)
  const reduceMotion = useReducedMotion()
  const position = useMotionValue(reduceMotion ? rest : 100)

  const clipPath = usePercent(position, (percent) => `inset(0 ${100 - percent}% 0 0)`)
  const left = usePercent(position, (percent) => `clamp(22px, ${percent}%, calc(100% - 22px))`)

  useMotionValueEvent(position, 'change', (percent) => {
    handle.current?.setAttribute('aria-valuenow', String(Math.round(percent)))
  })

  useEffect(() => {
    if (reduceMotion) {
      position.set(rest)
      return
    }
    position.set(100)
    handle.current?.setAttribute('aria-valuenow', '100')
    const controls = animate(position, rest, { duration: 1.5, delay: 0.25, ease: sweepEase })
    sweep.current = controls
    return () => controls.stop()
  }, [position, reduceMotion, rest, sweepKey])

  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const bounds = stage.current?.getBoundingClientRect()
    if (!bounds) return
    position.set(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    sweep.current?.stop()
    moveTo(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2
    const moves: Record<string, number> = {
      ArrowLeft: position.get() - step,
      ArrowRight: position.get() + step,
      Home: 0,
      End: 100,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    sweep.current?.stop()
    position.set(Math.min(100, Math.max(0, moves[event.key])))
  }

  const stageStyle = width && height ? ({ '--ratio': width / height, aspectRatio: `${width} / ${height}` } as CSSProperties) : undefined

  return (
    <div
      ref={stage}
      className={`compare ${className}`}
      style={stageStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => dragging.current && moveTo(event)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <div className={color ? 'compare-layer' : 'compare-layer checker'} style={color ? { background: color } : undefined} />
      <img className={`compare-image is-${fit}`} src={cutout} alt={`${alt}, background removed`} style={{ objectPosition: focus }} draggable={false} />
      <motion.div className="compare-layer" style={{ clipPath }}>
        <img className={`compare-image is-${fit}`} src={original} alt="" style={{ objectPosition: focus }} draggable={false} />
      </motion.div>

      <span className="tape tape-left">Original</span>
      <span className="tape tape-right">Cutout</span>

      <motion.div className="compare-divider" style={{ left }} aria-hidden="true" />
      <motion.div
        ref={handle}
        className="compare-handle"
        style={{ left }}
        role="slider"
        tabIndex={0}
        aria-label="Compare original and cutout"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rest}
        onKeyDown={handleKeyDown}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <ChevronsLeftRight size={18} aria-hidden="true" />
      </motion.div>
    </div>
  )
}
