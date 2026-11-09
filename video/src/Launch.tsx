import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont as loadDisplay } from '@remotion/google-fonts/BigShoulders'
import { loadFont as loadBody } from '@remotion/google-fonts/SchibstedGrotesk'

const { fontFamily: display } = loadDisplay('normal', { weights: ['700', '800', '900'], subsets: ['latin'] })
const { fontFamily: body } = loadBody('normal', { weights: ['500', '700'], subsets: ['latin'] })

// Light: colorhunt.co/palette/f4baa3f4f0e2a6c8e2619dc6, plus a deep navy for text
const green = '#a6c8e2'
const olive = '#16293a'
const grey = '#f4f0e2'
// Dark: colorhunt.co/palette/091413285a48408a71b0e4cc
const ink = '#091413'
const pine = '#285a48'
const mint = '#b0e4cc'

const ease = Easing.bezier(0.16, 1, 0.3, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const headline: CSSProperties = { fontFamily: display, fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.9, margin: 0 }

const checker: CSSProperties = {
  backgroundColor: grey,
  backgroundImage: `conic-gradient(#c9dbe4 25%, transparent 0 50%, #c9dbe4 0 75%, transparent 0)`,
  backgroundSize: '56px 56px',
}

/** Every scene arrives the way the app's studio does: rising up from the bottom edge. */
const Reveal = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ clipPath: `inset(${interpolate(frame, [0, 16], [100, 0], { ...clamp, easing: ease })}% 0 0 0)` }}>
      {children}
    </AbsoluteFill>
  )
}

const Tape = ({ children, style }: { children: ReactNode; style: CSSProperties }) => (
  <div style={{ position: 'absolute', padding: '8px 22px', background: olive, color: grey, fontFamily: display, fontWeight: 700, fontSize: 52, textTransform: 'uppercase', ...style }}>{children}</div>
)

const Word = ({ children, delay }: { children: string; delay: number }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
      <h1 style={{ ...headline, fontSize: 290, color: olive, translate: interpolate(frame, [delay, delay + 20], ['0px 320px', '0px 0px'], { ...clamp, easing: ease }) }}>{children}</h1>
    </div>
  )
}

const Hook = () => (
  <AbsoluteFill style={{ background: green, justifyContent: 'center', paddingLeft: 120 }}>
    <Word delay={3}>Take the</Word>
    <Word delay={9}>background</Word>
    <Word delay={15}>out.</Word>
  </AbsoluteFill>
)

const Wipe = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ background: green, flexDirection: 'row', alignItems: 'stretch' }}>
      <div style={{ width: 840, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 120, paddingRight: 40 }}>
        <h2 style={{ ...headline, fontSize: 190, color: olive }}>Every edge.</h2>
        <p style={{ fontFamily: body, fontWeight: 500, fontSize: 60, lineHeight: 1.2, color: olive, marginTop: 36 }}>Real output, unedited.</p>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', ...checker }}>
        <Img src={staticFile('samples/people-cutout.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${interpolate(frame, [0.5 * fps, 2.4 * fps], [0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) })}% 0 0)` }}>
          <Img src={staticFile('samples/people.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 8, marginLeft: -4, background: green, left: `${interpolate(frame, [0.5 * fps, 2.4 * fps], [100, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) })}%` }} />
        <Tape style={{ top: 40, right: 40, rotate: '1.5deg' }}>Cutout</Tape>
      </div>
    </AbsoluteFill>
  )
}

const panels = [
  { id: 'animal', colors: [mint, green, grey] },
  { id: 'car', colors: [grey, mint, green] },
  { id: 'product', colors: [green, grey, mint] },
]

const Panel = ({ id, colors }: (typeof panels)[number]) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ position: 'relative', flex: 1, background: colors[Math.min(colors.length - 1, Math.floor(frame / fps))] }}>
      <Img src={staticFile(`samples/${id}-cutout.webp`)} style={{ position: 'absolute', inset: 40, width: 'calc(100% - 80px)', height: 'calc(100% - 80px)', objectFit: 'contain' }} />
    </div>
  )
}

const AnyBackground = () => (
  <AbsoluteFill style={{ background: olive }}>
    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
      {panels.map((panel) => (
        <Panel key={panel.id} {...panel} />
      ))}
    </div>
    <Tape style={{ left: 120, bottom: 100, fontSize: 96, rotate: '-1deg' }}>Any background. Full resolution.</Tape>
  </AbsoluteFill>
)

const NetworkRow = () => {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 90,
        padding: '40px 52px',
        background: mint,
        color: ink,
        fontFamily: body,
        fontWeight: 700,
        fontSize: 64,
        translate: interpolate(frame, [18, 42], ['0px 80px', '0px 0px'], { ...clamp, easing: ease }),
        opacity: interpolate(frame, [18, 34], [0, 1], clamp),
      }}
    >
      <span>your-photo.jpg</span>
      <span>never sent</span>
    </div>
  )
}

const Private = () => (
  <AbsoluteFill style={{ background: pine, justifyContent: 'center', padding: '0 120px' }}>
    <h2 style={{ ...headline, fontSize: 250, color: mint }}>Nothing gets uploaded.</h2>
    <NetworkRow />
  </AbsoluteFill>
)

const End = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: green, justifyContent: 'center', alignItems: 'center', color: olive }}>
      <h1 style={{ ...headline, fontSize: 340, scale: interpolate(frame, [0, 26], [0.92, 1], { ...clamp, easing: ease }) }}>Clearcut</h1>
      <p style={{ fontFamily: body, fontWeight: 700, fontSize: 66, marginTop: 34 }}>Free. Open source. Runs in your browser.</p>
    </AbsoluteFill>
  )
}

export const Launch = () => {
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ background: green }}>
      <Sequence name="Hook" durationInFrames={2.6 * fps}>
        <Hook />
      </Sequence>
      <Sequence name="Wipe" from={2.2 * fps} durationInFrames={4.2 * fps}>
        <Reveal>
          <Wipe />
        </Reveal>
      </Sequence>
      <Sequence name="Any background" from={6 * fps} durationInFrames={3.4 * fps}>
        <Reveal>
          <AnyBackground />
        </Reveal>
      </Sequence>
      <Sequence name="Private" from={9 * fps} durationInFrames={3.4 * fps}>
        <Reveal>
          <Private />
        </Reveal>
      </Sequence>
      <Sequence name="End" from={12 * fps} durationInFrames={3 * fps}>
        <Reveal>
          <End />
        </Reveal>
      </Sequence>
    </AbsoluteFill>
  )
}
