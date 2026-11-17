/** Real Caisse Manager imagery from the Figma "micro-design-system" assets page (see public/img). */
import type { AppId } from '../data/apps'

export const HERO_POSTER = '/img/hero/hero-poster.jpg'

const scene = (name: string) => `/img/scenes/${name}.jpg`

const APP_SCENE: Record<AppId, string> = {
  pos: scene('pos'),
  pos_pro: scene('pos'),
  pos_v1: scene('pos'),
  pos_v2: scene('pos'),
  pos_v3: scene('pos'),
  pos_v3_web: scene('pos'),
  pos_mobile: scene('pos-mobile'),
  customer_display: scene('customer-display'),
  drive_thru: scene('kiosk'),
  screen_menu: scene('customer-display'),
  table_qr: scene('web-app'),
  kiosk: scene('kiosk'),
  kds: scene('kds'),
  kds_v2: scene('kds'),
  kitchen_monitoring: scene('kds'),
  customer_queuing: scene('customer-queuing'),
  web_app: scene('web-app'),
  mobile_app: scene('pos-mobile'),
  delivery_app: scene('delivery-app'),
  stock: scene('back-office'),
  attendance: scene('attendance-app'),
  qr_ringer: scene('customer-queuing'),
}

export const sceneForApp = (id: AppId) => APP_SCENE[id]

/** Holding covers: free-to-use Unsplash photos (unsplash.com/license), loaded from their CDN, cropped to the card. */
const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=900&q=75&auto=format&fit=crop`
const HOLDING_COVER: Record<string, string> = {
  cmh: unsplash('photo-1556742049-0cfed4f6a45d'), // checkout counter, card payment
  nlv: unsplash('photo-1534351590666-13e3e96b5017'), // Amsterdam canal
  ahg: unsplash('photo-1539020140153-e479b8c22e70'), // Moroccan zellige fountains
  lmn: unsplash('photo-1441986300917-64674bd600d8'), // retail store interior
}

export const coverForHolding = (id: string) => HOLDING_COVER[id] ?? HERO_POSTER

/** A real client logo when the brand is one of Caisse Manager's own references. */
export const logoForBrand = (name: string) => {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return CLIENT_LOGOS.find((c) => c.name === key)?.src
}

export const CLIENT_LOGOS = [
  'crusty',
  'panda',
  'franks-burger',
  'texas-chicken',
  'hy-sushi',
  'the-hunger',
  'wok-4-you',
  'uncle-crespy',
  'bunnies',
  'divachic',
  'kleat',
  'lartisan',
  'mr-bnin',
  'the-meat',
  'wake-up',
  '75-flavours',
  'fried',
].map((n) => ({ name: n, src: `/img/clients/${n}.png` }))
