import type { Subject } from '../config'

export type Sample = {
  id: string
  label: string
  note: string
  alt: string
  subject: Subject
  /** Which part of the photo stays in view when a frame crops it. */
  focus?: string
}

const base = import.meta.env.BASE_URL

export const originalOf = (sample: Sample) => `${base}samples/${sample.id}.webp`
export const cutoutOf = (sample: Sample) => `${base}samples/${sample.id}-cutout.webp`

export const samples: Sample[] = [
  {
    id: 'people',
    label: 'People',
    subject: 'person',
    note: 'Long, loose curls against a warm wall, cut around each coil.',
    alt: 'Woman with long curly hair in profile against a tan wall',
  },
  {
    id: 'animal',
    label: 'Animals',
    subject: 'object',
    focus: '14% 32%',
    note: 'A fluffy ginger kitten lifted off a dark backdrop, whiskers included.',
    alt: 'Fluffy ginger kitten sitting against a dark background',
  },
  {
    id: 'car',
    label: 'Cars',
    subject: 'object',
    note: 'A dark car against a dark studio, the hardest contrast in this set.',
    alt: 'Dark blue muscle car in side view in a dark studio',
  },
  {
    id: 'product',
    label: 'Products',
    subject: 'object',
    note: 'A catalog shot, ready for a white background in two clicks.',
    alt: 'Maroon canvas sneaker floating against a yellow background',
  },
]
