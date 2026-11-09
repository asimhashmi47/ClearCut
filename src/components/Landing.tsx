import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Link2, Upload } from 'lucide-react'
import { CompareStage } from './CompareStage'
import { HeroDemo } from './HeroDemo'
import { GitHubIcon, ThemeToggle, Wordmark } from './Brand'
import { APP_LICENSE, APP_NAME, AUTHOR_URL, CONTACT_EMAIL, MODELS, REPO_URL } from '../config'
import { cutoutOf, originalOf, samples, type Sample } from '../lib/samples'

type LandingProps = {
  error: string
  fetchingLink: boolean
  demoPaused: boolean
  onChooseFile: () => void
  onChooseSample: (sample: Sample) => void
  onChooseUrl: (url: string) => void
}

const ease = [0.16, 1, 0.3, 1] as const

function Header() {
  return (
    <header className="site-header">
      <a href="#top" aria-label={`${APP_NAME} home`}>
        <Wordmark />
      </a>
      <nav className="site-nav" aria-label="Main">
        <a href="#edges">Examples</a>
        <a href="#private">Privacy</a>
        <a href="#cost">Cost</a>
      </nav>
      <div className="site-tools">
        {REPO_URL && (
          <motion.a className="button is-ink is-small" href={REPO_URL} aria-label="Star on GitHub" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
            <GitHubIcon size={16} /> <span className="star-label">Star on GitHub</span>
          </motion.a>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

function Hero({ error, fetchingLink, demoPaused, onChooseFile, onChooseSample, onChooseUrl }: LandingProps) {
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (url.trim()) onChooseUrl(url.trim())
  }

  return (
    <section className="hero" id="top">
      <Header />
      <div className="hero-grid">
        <div className="hero-copy">
          <motion.h1 initial={{ y: 28 }} animate={{ y: 0 }} transition={{ duration: 0.9, ease }}>
            Take the background out.
          </motion.h1>
          <p className="hero-lede">Free, full resolution, no account. {APP_NAME} works inside your browser, so your photos never leave your computer.</p>

          <div className="hero-actions">
            <motion.button className="button is-ink is-large" type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onChooseFile}>
              <Upload size={20} aria-hidden="true" /> Choose an image
            </motion.button>
            <p className="hero-hint">
              or drop it anywhere, paste it, or{' '}
              <button className="inline-button" type="button" aria-expanded={urlOpen} onClick={() => setUrlOpen((open) => !open)}>
                use a link
              </button>
            </p>
          </div>

          <AnimatePresence initial={false}>
            {urlOpen && (
              <motion.form className="url-form" onSubmit={submit} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }}>
                <div className="url-row">
                  <Link2 size={18} aria-hidden="true" />
                  <label className="visually-hidden" htmlFor="image-url">
                    Image link
                  </label>
                  <input id="image-url" type="url" inputMode="url" placeholder="https://example.com/photo.jpg" value={url} onChange={(event) => setUrl(event.target.value)} />
                  <button type="submit" aria-label="Load image from link">
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {fetchingLink && (
            <p className="hero-status" role="status">
              Fetching that image...
            </p>
          )}

          {error && (
            <p className="hero-error" role="alert">
              {error}
            </p>
          )}

          <p className="hero-note">Your first image loads an 84 MB model. After that, it's ready instantly.</p>

          <div className="sample-row">
            <span>No photo handy?</span>
            <div className="sample-list">
              {samples.map((sample) => (
                <motion.button key={sample.id} className="sample-thumb" type="button" aria-label={`Try the ${sample.label.toLowerCase()} sample`} title={sample.label} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }} onClick={() => onChooseSample(sample)}>
                  <img src={originalOf(sample)} alt="" loading="lazy" style={{ objectPosition: sample.focus }} />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-stage">
          <HeroDemo paused={demoPaused} />
        </div>
      </div>
    </section>
  )
}

function Edges({ onChooseSample }: Pick<LandingProps, 'onChooseSample'>) {
  const [active, setActive] = useState(samples[1])

  return (
    <section className="edges" id="edges">
      <div className="edges-intro">
        <h2>Check the edges yourself.</h2>
        <p>Every image here is unedited output from the model you'll run. Drag the divider, then zoom in with your browser.</p>
      </div>

      <div className="edges-tabs" role="tablist" aria-label="Examples">
        {samples.map((sample) => (
          <button key={sample.id} role="tab" type="button" aria-selected={active.id === sample.id} className="edges-tab" onClick={() => setActive(sample)}>
            {active.id === sample.id && <motion.span layoutId="edges-tab" className="edges-tab-pill" transition={{ duration: 0.3, ease }} />}
            <span className="edges-tab-label">{sample.label}</span>
          </button>
        ))}
      </div>

      <div className="edges-stage" role="tabpanel" aria-label={active.label}>
        <CompareStage key={active.id} original={originalOf(active)} cutout={cutoutOf(active)} alt={active.alt} focus={active.focus} rest={50} />
        <div className="edges-caption">
          <p>{active.note}</p>
          <motion.button className="button is-quiet" type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={() => onChooseSample(active)}>
            Run this one live <ArrowRight size={16} aria-hidden="true" />
          </motion.button>
        </div>
      </div>
    </section>
  )
}

const requests = [
  { name: 'The model', source: 'Comes from this site, first visit only', size: '84 MB', sent: false },
  { name: 'Your photo', source: 'Stays on your device', size: 'Never sent', sent: true },
]

function Private() {
  return (
    <section className="private" id="private">
      <div className="private-copy">
        <h2>Your photos stay on your computer.</h2>
        <p>Nothing gets uploaded, because everything runs on your own device. Developers can confirm it: open the browser's Network tab and watch while an image is processed.</p>
      </div>
      <motion.div className="netlog" initial={{ y: 36 }} whileInView={{ y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, ease }}>
        <div className="netlog-head">
          <span>What</span>
          <span>Where</span>
          <span>Size</span>
        </div>
        {requests.map((request) => (
          <div className={`netlog-row ${request.sent ? 'is-photo' : ''}`} key={request.name}>
            <span>{request.name}</span>
            <span>{request.source}</span>
            <span>{request.size}</span>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

const receipt = [
  ['Full-resolution export', '$0'],
  ['Credits per image', 'none'],
  ['Account', 'not needed'],
  ['Watermark', 'none'],
  ['Images uploaded', '0'],
  ['Source code', APP_LICENSE],
]

function Cost() {
  return (
    <section className="cost" id="cost">
      <motion.div className="receipt" initial={{ y: 56, rotate: -3 }} whileInView={{ y: 0, rotate: -1.2 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.9, ease }}>
        <p className="receipt-title">{APP_NAME}</p>
        <dl>
          {receipt.map(([item, price]) => (
            <div key={item}>
              <dt>{item}</dt>
              <dd>{price}</dd>
            </div>
          ))}
        </dl>
        <p className="receipt-total">
          <span>Total</span>
          <span>$0.00</span>
        </p>
      </motion.div>
    </section>
  )
}

const currentYear = new Date().getFullYear()

function Footer({ onChooseFile }: Pick<LandingProps, 'onChooseFile'>) {
  return (
    <footer className="site-footer">
      <div className="footer-cta">
        <h2>Got a photo?</h2>
        <motion.button className="button is-ink is-large" type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onChooseFile}>
          <Upload size={20} aria-hidden="true" /> Choose an image
        </motion.button>
      </div>
      <p className="footer-word" aria-hidden="true">
        {APP_NAME}
      </p>
      <div className="footer-line">
        <p>
          Cutouts by <a href={MODELS.person.url}>{MODELS.person.name}</a> ({MODELS.person.license}) and <a href={MODELS.object.url}>{MODELS.object.name}</a> ({MODELS.object.license}). Free software under the {APP_LICENSE} license. Runs on <a href="https://huggingface.co/docs/transformers.js">Transformers.js</a>. Sample photos from <a href="https://unsplash.com">Unsplash</a> and <a href="https://www.vecteezy.com">Vecteezy</a>.
        </p>
        {REPO_URL && <a href={REPO_URL}>Source on GitHub</a>}
      </div>
      <div className="footer-line">
        <p>
          © {currentYear} {APP_NAME}. All rights reserved.
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> | <a href={AUTHOR_URL}>{AUTHOR_URL.replace('https://', '')}</a>
        </p>
      </div>
    </footer>
  )
}

export function Landing(props: LandingProps) {
  return (
    <>
      <Hero {...props} />
      <main>
        <Edges onChooseSample={props.onChooseSample} />
        <Private />
        <Cost />
      </main>
      <Footer onChooseFile={props.onChooseFile} />
    </>
  )
}
