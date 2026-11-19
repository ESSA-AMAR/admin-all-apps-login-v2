/**
 * What the first page's tabs show beyond today's KPIs: sales over days, hours and time frames, menu products,
 * online against store orders, the benchmark against the Caisse Manager network, customer feedback, and the actions all of it suggests.
 * Demo data, deterministic per outlet and per day, so the tabs, the actions and the assistant tell the same story.
 */
import { cityById, HOLDINGS } from '../data/mock'
import type { IndustryId, Store } from '../data/types'
import { SHAPE, storeKpis, type ScopeKpis } from './kpis'
import { between, hashString, rng } from './random'

export type Range = 7 | 30 | 90
export const RANGES: Range[] = [7, 30, 90]
/** Weekdays, Monday first. */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const DAY_MS = 86_400_000

const dowOf = (d: Date) => (d.getDay() + 6) % 7
const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0)

/** Trade per weekday (Monday first), around 1. */
const WEEK: Record<IndustryId, number[]> = {
  hospitality: [0.82, 0.86, 0.92, 1.0, 1.22, 1.38, 1.1],
  it: [0.95, 0.97, 1.0, 1.02, 1.1, 1.3, 0.66],
  harvest: [0.85, 0.9, 0.95, 1.0, 1.12, 1.42, 0.76],
}

/** How the hours fill on a weekday: weekend brunch, Friday and Saturday nights, the Saturday market, Saturday shopping. */
function hourWeight(ind: IndustryId, dow: number, h: number) {
  let w = SHAPE[ind](h)
  if (ind === 'hospitality') {
    if (dow >= 5 && h >= 9 && h <= 13) w *= 1.35
    if ((dow === 4 || dow === 5) && h >= 20) w *= 1.25
  } else if (ind === 'harvest' && dow === 5 && h >= 8 && h <= 12) w *= 1.4
  else if (ind === 'it' && dow === 5 && h >= 13 && h <= 17) w *= 1.25
  return w
}
/** Share of a day's sales per hour, per industry and weekday. */
const HOUR_SHARE = Object.fromEntries(
  (['it', 'hospitality', 'harvest'] as IndustryId[]).map((ind) => [
    ind,
    Array.from({ length: 7 }, (_, dow) => {
      const w = Array.from({ length: 24 }, (_, h) => hourWeight(ind, dow, h))
      const t = sumOf(w) || 1
      return w.map((v) => v / t)
    }),
  ]),
) as Record<IndustryId, number[][]>

// ───────────────── Outlet profile: what does not change from one day to the next ─────────────────

interface Profile {
  /** A typical day's sales. */
  base: number
  basket: number
  /** Growth over a year (0.1 = +10 %). */
  trend: number
  /** Online share of sales (%). */
  online: number
  /** The rating customers give it, on average. */
  rating: number
  /** Reviews per order. */
  reviewRate: number
  /** Share of reviews answered. */
  replies: number
  kiosk: boolean
}
const profiles = new Map<string, Profile>()
function profile(s: Store): Profile {
  let p = profiles.get(s.id)
  if (p) return p
  const r = rng(`${s.id}:profile`)
  // Each brand has its own level (concept, management, prices): its outlets share it, so brands really differ.
  const bias = between(rng(`${s.brandId}:brand`), -1, 1)
  const scale = (s.industry === 'it' ? between(r, 260, 520) : s.industry === 'hospitality' ? between(r, 320, 680) : between(r, 160, 380)) * (1 + bias * 0.18)
  const base = Array.from({ length: 24 }, (_, h) => SHAPE[s.industry](h)).reduce((a, w) => a + w * scale, 0)
  p = {
    base,
    basket: s.industry === 'it' ? between(r, 85, 160) : s.industry === 'hospitality' ? between(r, 24, 48) : between(r, 14, 32),
    trend: between(r, -0.3, 0.35) + bias * 0.6,
    online: s.industry === 'hospitality' ? between(r, 22, 40) : s.industry === 'it' ? between(r, 8, 18) : between(r, 6, 15),
    rating: Math.min(4.85, Math.max(3.3, between(r, 3.55, 4.6) + bias * 0.3)),
    reviewRate: between(r, 0.012, 0.03),
    replies: between(r, 0.45, 0.9),
    kiosk: r() > 0.5,
  }
  profiles.set(s.id, p)
  return p
}

/** Noon, `daysAgo` days back: history uses whole calendar days. */
function dayAt(daysAgo: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return new Date(d.getTime() - daysAgo * DAY_MS)
}

/** One outlet's sales on one past day, and the online part of it. */
function dayOf(s: Store, daysAgo: number) {
  const p = profile(s)
  const date = dayAt(daysAgo)
  const r = rng(`${s.id}:day:${date.toDateString()}`)
  const revenue = p.base * WEEK[s.industry][dowOf(date)] * (1 - (p.trend * daysAgo) / 365) * between(r, 0.88, 1.12)
  // Online grows faster than the rest.
  const onlineShare = Math.min(60, p.online * (1 - (0.35 * daysAgo) / 365) * between(r, 0.9, 1.1))
  return { date, revenue, online: (revenue * onlineShare) / 100 }
}

// ───────────────── Menu ─────────────────

type MenuItem = [name: string, category: string, price: number]
/** The menu per industry. The first names match the Top products of today's view. */
const MENU: Record<IndustryId, MenuItem[]> = {
  hospitality: [
    ['Signature Burger', 'Mains', 19],
    ['Truffle Risotto', 'Mains', 26],
    ['Chicken Bao', 'Mains', 14],
    ['Poke Bowl', 'Mains', 16],
    ['Brunch Formula', 'Brunch', 32],
    ['Avocado Toast', 'Brunch', 12],
    ['Espresso Tonic', 'Drinks', 6],
    ['Natural Wine (gl.)', 'Drinks', 9],
    ['Craft IPA', 'Drinks', 7],
    ['Fresh Lemonade', 'Drinks', 5],
    ['Tiramisu', 'Desserts', 8],
    ['Matcha Cheesecake', 'Desserts', 9],
  ],
  it: [
    ['USB-C Hub Pro', 'Accessories', 59],
    ['Noise-cancel Headset', 'Accessories', 189],
    ['Phone Case', 'Accessories', 25],
    ['27" 4K Monitor', 'Devices', 349],
    ['Mesh Wi-Fi Kit', 'Devices', 219],
    ['Laptop Air 13"', 'Devices', 1099],
    ['Repair — Screen', 'Services', 129],
    ['Cloud Backup 1y', 'Services', 79],
    ['Setup & transfer', 'Services', 49],
  ],
  harvest: [
    ['Heirloom Tomatoes /kg', 'Produce', 6.5],
    ['Seasonal Basket', 'Produce', 29],
    ['Avocados x4', 'Produce', 5.5],
    ['Organic Eggs x12', 'Dairy & eggs', 5.9],
    ['Goat Cheese', 'Dairy & eggs', 7.2],
    ['Sourdough Loaf', 'Bakery', 4.8],
    ['Butter Croissant', 'Bakery', 1.6],
    ['Raw Honey 500g', 'Pantry', 11],
    ['Olive Oil 1L', 'Pantry', 14],
    ['Apple Juice 1L', 'Drinks', 3.9],
  ],
}

/** The menu of an industry: name, category, price. */
export const menuOf = (ind: IndustryId): readonly MenuItem[] => MENU[ind]

/** How much each item sells in an outlet (cheaper items sell more), fixed per outlet. */
const menuWeights = new Map<string, number[]>()
function weightsOf(s: Store) {
  let w = menuWeights.get(s.id)
  if (!w) {
    const r = rng(`${s.id}:menu`)
    w = MENU[s.industry].map(([, , price]) => between(r, 0.35, 1.65) / Math.sqrt(price))
    menuWeights.set(s.id, w)
  }
  return w
}

export interface ProductRow {
  name: string
  category: string
  industry: IndustryId
  price: number
  qty: number
  revenue: number
  /** Share of the period's sales (%). */
  share: number
  /** Quantity against the previous period (%). */
  trend: number
}

// ───────────────── Sales ─────────────────

export interface Daypart {
  id: string
  label: string
  /** Hours, [from, to), wrapping past midnight. */
  from: number
  to: number
  revenue: number
  orders: number
  basket: number
  share: number
}

export interface Source {
  id: string
  label: string
  group: 'store' | 'online'
  revenue: number
  share: number
}

export interface SalesInsights {
  range: Range
  /** Oldest first. */
  days: { date: Date; revenue: number; online: number; orders: number }[]
  total: number
  orders: number
  basket: number
  /** Against the period before (%). */
  growth: number
  ordersGrowth: number
  basketGrowth: number
  onlineShare: number
  onlineShareDelta: number
  /** Average sales per hour slot, [weekday][hour]. */
  heat: number[][]
  /** Average day per weekday. */
  byWeekday: number[]
  peakDay: { dow: number; lift: number }
  quietDay: { dow: number; lift: number }
  /** The busiest hour slot of the week, and the busiest hour on average. */
  peakSlot: { dow: number; h: number; value: number }
  peakHour: number
  dayparts: Daypart[]
  channels: {
    store: { revenue: number; orders: number; basket: number; growth: number }
    online: { revenue: number; orders: number; basket: number; growth: number }
    sources: Source[]
  }
  products: ProductRow[]
  categories: string[]
}

const DAYPART_DEF: [id: string, food: string, other: string, from: number, to: number, foodBasket: number, otherBasket: number][] = [
  ['morning', 'Breakfast', 'Morning', 6, 11, 0.6, 0.9],
  ['midday', 'Lunch', 'Midday', 11, 15, 1.05, 1],
  ['afternoon', 'Afternoon', 'Afternoon', 15, 18, 0.7, 1.05],
  ['evening', 'Dinner', 'Evening', 18, 23, 1.3, 1.1],
  ['night', 'Late night', 'Night', 23, 6, 1.1, 1],
]
const inPart = (h: number, from: number, to: number) => (from < to ? h >= from && h < to : h >= from || h < to)

const salesCache = new Map<string, SalesInsights>()
/** Sales over the last `range` whole days for these outlets, compared with the `range` days before. */
export function salesInsights(stores: Store[], range: Range): SalesInsights {
  const key = `${range}:${dayAt(0).toDateString()}:${hashString(stores.map((s) => s.id).join())}`
  const hit = salesCache.get(key)
  if (hit) return hit

  const food = stores.length > 0 && stores.every((s) => s.industry === 'hospitality')
  const days = Array.from({ length: range }, (_, i) => ({ date: dayAt(range - i), revenue: 0, online: 0, orders: 0 }))
  const heatSum = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const dowCount = new Array<number>(7).fill(0)
  days.forEach((d) => dowCount[dowOf(d.date)]++)
  let prevTotal = 0
  let prevOrders = 0
  let prevOnline = 0
  let storeOrders = 0
  let onlineOrders = 0
  const sourceRev = new Map<string, { label: string; group: 'store' | 'online'; revenue: number }>()
  const addSource = (id: string, label: string, group: 'store' | 'online', v: number) => {
    const cur = sourceRev.get(id) ?? { label, group, revenue: 0 }
    cur.revenue += v
    sourceRev.set(id, cur)
  }
  const products = new Map<string, ProductRow & { prevQty: number }>()

  for (const s of stores) {
    const p = profile(s)
    let rev = 0
    let prev = 0
    let online = 0
    for (let i = 0; i < range; i++) {
      const d = dayOf(s, range - i)
      const o = d.revenue / p.basket
      days[i].revenue += d.revenue
      days[i].online += d.online
      days[i].orders += o
      rev += d.revenue
      online += d.online
      storeOrders += (d.revenue - d.online) / (p.basket * 0.95)
      onlineOrders += d.online / (p.basket * 1.3)
      const share = HOUR_SHARE[s.industry][dowOf(d.date)]
      const row = heatSum[dowOf(d.date)]
      for (let h = 0; h < 24; h++) row[h] += d.revenue * share[h]
    }
    for (let i = range + 1; i <= range * 2; i++) {
      const d = dayOf(s, i)
      prev += d.revenue
      prevTotal += d.revenue
      prevOrders += d.revenue / p.basket
      prevOnline += d.online
    }

    // Where the orders come from: fixed splits per outlet.
    const rs = rng(`${s.id}:sources`)
    const inStore = rev - online
    const kiosk = p.kiosk ? between(rs, 0.1, 0.2) : 0
    const table = s.industry === 'hospitality' ? between(rs, 0.2, 0.35) : 0
    addSource('pos', 'POS counter', 'store', inStore * (1 - kiosk - table))
    if (table) addSource('table', 'Table service', 'store', inStore * table)
    if (kiosk) addSource('kiosk', 'Kiosk', 'store', inStore * kiosk)
    const web = between(rs, 0.2, 0.35)
    const app = between(rs, 0.15, 0.3)
    addSource('web', 'Website & e-shop', 'online', online * web)
    addSource('app', 'Mobile app', 'online', online * app)
    if (s.industry === 'hospitality') addSource('delivery', 'Delivery apps', 'online', online * (1 - web - app))
    else addSource('market', 'Marketplaces', 'online', online * (1 - web - app))

    // Products: quantities that add up to the outlet's sales; the previous period moves a little per item.
    const menu = MENU[s.industry]
    const w = weightsOf(s)
    const rp = rng(`${s.id}:menu:${range}:${dayAt(0).toDateString()}`)
    const wPrev = w.map((v) => v * between(rp, 0.78, 1.25))
    const unit = rev / sumOf(menu.map(([, , price], i) => w[i] * price))
    const unitPrev = prev / sumOf(menu.map(([, , price], i) => wPrev[i] * price))
    menu.forEach(([name, category, price], i) => {
      const cur = products.get(name) ?? { name, category, industry: s.industry, price, qty: 0, revenue: 0, share: 0, trend: 0, prevQty: 0 }
      cur.qty += w[i] * unit
      cur.revenue += w[i] * unit * price
      cur.prevQty += wPrev[i] * unitPrev
      products.set(name, cur)
    })
  }

  const total = sumOf(days.map((d) => d.revenue))
  const orders = sumOf(days.map((d) => d.orders))
  const onlineTotal = sumOf(days.map((d) => d.online))
  const heat = heatSum.map((row, dow) => row.map((v) => (dowCount[dow] ? v / dowCount[dow] : 0)))
  const byWeekday = heat.map((row) => sumOf(row))
  const avgDay = sumOf(byWeekday) / 7 || 1
  const order = byWeekday.map((v, dow) => ({ dow, v })).sort((a, b) => b.v - a.v)
  let peakSlot = { dow: 0, h: 12, value: 0 }
  heat.forEach((row, dow) => row.forEach((v, h) => v > peakSlot.value && (peakSlot = { dow, h, value: v })))
  const hourTotals = Array.from({ length: 24 }, (_, h) => sumOf(heat.map((row) => row[h])))
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals))

  // Time frames: sales from the hours; orders spread by how big a basket is at that time of day.
  const parts = DAYPART_DEF.map(([id, fl, ol, from, to, fb, ob]) => {
    const revenue = sumOf(hourTotals.filter((_, h) => inPart(h, from, to))) * (range / 7)
    return { id, label: food ? fl : ol, from, to, revenue, weight: revenue / (food ? fb : ob) }
  })
  const partRevenue = sumOf(parts.map((p) => p.revenue)) || 1
  const partWeight = sumOf(parts.map((p) => p.weight)) || 1
  const dayparts: Daypart[] = parts.map(({ weight, ...p }) => {
    const o = (orders * weight) / partWeight
    // Scale to the period's real total (the heat is an average week).
    const revenue = (total * p.revenue) / partRevenue
    return { ...p, revenue, orders: o, basket: o ? revenue / o : 0, share: (p.revenue / partRevenue) * 100 }
  })

  const rows = [...products.values()]
  const productRows: ProductRow[] = rows
    .map(({ prevQty, ...r }) => ({ ...r, share: total ? (r.revenue / total) * 100 : 0, trend: prevQty ? ((r.qty - prevQty) / prevQty) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  const storeRev = total - onlineTotal
  const prevStoreRev = prevTotal - prevOnline
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0)
  const sourceTotal = sumOf([...sourceRev.values()].map((s) => s.revenue)) || 1

  const out: SalesInsights = {
    range,
    days,
    total,
    orders,
    basket: orders ? total / orders : 0,
    growth: pct(total, prevTotal),
    ordersGrowth: pct(orders, prevOrders),
    basketGrowth: pct(orders ? total / orders : 0, prevOrders ? prevTotal / prevOrders : 0),
    onlineShare: total ? (onlineTotal / total) * 100 : 0,
    onlineShareDelta: (total ? (onlineTotal / total) * 100 : 0) - (prevTotal ? (prevOnline / prevTotal) * 100 : 0),
    heat,
    byWeekday,
    peakDay: { dow: order[0].dow, lift: (order[0].v / avgDay - 1) * 100 },
    quietDay: { dow: order[6].dow, lift: (order[6].v / avgDay - 1) * 100 },
    peakSlot,
    peakHour,
    dayparts,
    channels: {
      store: { revenue: storeRev, orders: storeOrders, basket: storeOrders ? storeRev / storeOrders : 0, growth: pct(storeRev, prevStoreRev) },
      online: { revenue: onlineTotal, orders: onlineOrders, basket: onlineOrders ? onlineTotal / onlineOrders : 0, growth: pct(onlineTotal, prevOnline) },
      sources: [...sourceRev.entries()]
        .map(([id, s]) => ({ id, ...s, share: (s.revenue / sourceTotal) * 100 }))
        .sort((a, b) => (a.group === b.group ? b.revenue - a.revenue : a.group === 'store' ? -1 : 1)),
    },
    products: productRows,
    categories: [...new Set(productRows.map((r) => r.category))],
  }
  salesCache.set(key, out)
  return out
}

// ───────────────── Benchmark ─────────────────

export type Zone = 'safe' | 'watch' | 'danger'
export const zoneOf = (score: number): Zone => (score >= 60 ? 'safe' : score >= 40 ? 'watch' : 'danger')
export const ZONE_LABEL: Record<Zone, string> = { safe: 'Safe zone', watch: 'Watch', danger: 'Danger zone' }

export interface Metrics {
  /** Last 30 days against the 30 before (%). */
  growth: number
  /** Average day per outlet. */
  perOutlet: number
  basket: number
  rating: number
  primeCost: number
  loss: number
}
export type MetricKey = keyof Metrics
/** What counts in the score, and which way is better. Basket is shown, not scored (it depends on the concept). */
export const METRICS: { key: MetricKey; label: string; better: 'up' | 'down'; weight: number }[] = [
  { key: 'growth', label: 'Sales growth', better: 'up', weight: 0.3 },
  { key: 'perOutlet', label: 'Sales per outlet a day', better: 'up', weight: 0.25 },
  { key: 'rating', label: 'Customer rating', better: 'up', weight: 0.2 },
  { key: 'primeCost', label: 'Prime cost', better: 'down', weight: 0.15 },
  { key: 'loss', label: 'Loss', better: 'down', weight: 0.1 },
  { key: 'basket', label: 'Average basket', better: 'up', weight: 0 },
]

export interface RankLine {
  label: string
  rank: number
  of: number
  score: number
  zone: Zone
}
export interface BenchPeer {
  name: string
  score: number
  zone: Zone
  own: boolean
}
export interface BenchUnit {
  id: string
  name: string
  kind: 'brand' | 'outlet'
  industry: IndustryId
  outlets: number
  metrics: Metrics
  score: number
  zone: Zone
  /** Against the same industry across the network. */
  industryRank: RankLine
  /** For an outlet: against the other outlets of its brand. */
  brandRank: RankLine | null
  /** Against the same industry in each city where it trades, best first. */
  cityRanks: RankLine[]
  median: Metrics
  top: Metrics
  /** The industry leaderboard: the top of it, plus this unit. */
  board: (BenchPeer & { rank: number })[]
}

const metricsCache = new Map<string, Metrics>()
function storeMetrics(s: Store): Metrics {
  const key = `${s.id}:${dayAt(0).toDateString()}`
  let m = metricsCache.get(key)
  if (m) return m
  const p = profile(s)
  let last = 0
  let before = 0
  for (let i = 1; i <= 30; i++) last += dayOf(s, i).revenue
  for (let i = 31; i <= 60; i++) before += dayOf(s, i).revenue
  const k = storeKpis(s)
  m = { growth: before ? ((last - before) / before) * 100 : 0, perOutlet: last / 30, basket: p.basket, rating: ratingOf(p), primeCost: k.control.primeCost, loss: k.control.loss }
  metricsCache.set(key, m)
  return m
}

/** Several outlets as one: sales-weighted where it matters. */
function combine(list: Store[]): Metrics {
  const ms = list.map(storeMetrics)
  const w = ms.map((m) => m.perOutlet)
  const tw = sumOf(w) || 1
  const avg = (f: (m: Metrics) => number) => sumOf(ms.map((m, i) => f(m) * w[i])) / tw
  return { growth: avg((m) => m.growth), perOutlet: tw / ms.length, basket: avg((m) => m.basket), rating: avg((m) => m.rating), primeCost: avg((m) => m.primeCost), loss: avg((m) => m.loss) }
}

const ALL_STORES = HOLDINGS.flatMap((h) => h.stores)
const BRAND_NAME = new Map(HOLDINGS.flatMap((h) => h.brands.map((b) => [b.id, b.name] as const)))
const HOLDING_CODE = new Map(HOLDINGS.map((h) => [h.id, h.code] as const))

/** Anonymous peers from the rest of the Caisse Manager network, spread around the real ones. */
function syntheticPeers(seed: string, count: number, around: Metrics[]): Metrics[] {
  const mean = (f: (m: Metrics) => number) => (around.length ? sumOf(around.map(f)) / around.length : 0)
  const c = { growth: mean((m) => m.growth), perOutlet: mean((m) => m.perOutlet), basket: mean((m) => m.basket), primeCost: mean((m) => m.primeCost) }
  return Array.from({ length: count }, (_, i) => {
    const r = rng(`${seed}:${i}`)
    // The wider network is a little weaker than these established brands on average, with a long tail both ways.
    return {
      growth: c.growth - 1.5 + between(r, -14, 14),
      perOutlet: c.perOutlet * between(r, 0.5, 1.35),
      basket: c.basket * between(r, 0.75, 1.3),
      rating: between(r, 3.3, 4.7),
      primeCost: c.primeCost + between(r, -5, 8),
      loss: between(r, 1, 6),
    }
  })
}

/** Score 0–100: the weighted share of peers this one beats, metric by metric. */
function scoreIn(m: Metrics, peers: Metrics[]) {
  if (!peers.length) return 50
  let s = 0
  for (const { key, better, weight } of METRICS) {
    if (!weight) continue
    const beaten = peers.filter((p) => (better === 'up' ? p[key] < m[key] : p[key] > m[key])).length
    const ties = peers.filter((p) => p[key] === m[key]).length
    s += weight * ((beaten + ties / 2) / peers.length)
  }
  return Math.round(s * 100)
}

/** Rank `m` among `others` (not including itself). */
function rankLine(label: string, m: Metrics, others: Metrics[]): RankLine {
  const all = [m, ...others]
  const scores = all.map((x) => scoreIn(x, all.filter((y) => y !== x)))
  const score = scores[0]
  const rank = 1 + scores.slice(1).filter((s) => s > score).length
  return { label, rank, of: all.length, score, zone: zoneOf(score) }
}

function quantile(values: number[], q: number) {
  const v = [...values].sort((a, b) => a - b)
  if (!v.length) return 0
  const i = (v.length - 1) * q
  const lo = Math.floor(i)
  return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo)
}

const IND_NAME: Record<IndustryId, string> = { hospitality: 'Hospitality', it: 'IT & tech retail', harvest: 'Harvest & grocery' }
const PEERS_PER_INDUSTRY: Record<IndustryId, number> = { hospitality: 22, it: 16, harvest: 13 }

/**
 * The benchmark: each brand in scope (or the outlet, at store level) against the same industry across the Caisse Manager network,
 * and against the same industry in every city where it trades. Peers outside the scope stay anonymous.
 */
export function benchmark(stores: Store[]): BenchUnit[] {
  const inScope = new Set(stores.map((s) => s.id))
  const brandsAll = new Map<string, Store[]>()
  for (const s of ALL_STORES) brandsAll.set(s.brandId, [...(brandsAll.get(s.brandId) ?? []), s])
  const nameCount = new Map<string, number>()
  for (const [id] of brandsAll) nameCount.set(BRAND_NAME.get(id) ?? id, (nameCount.get(BRAND_NAME.get(id) ?? id) ?? 0) + 1)
  const brandName = (id: string) => {
    const n = BRAND_NAME.get(id) ?? id
    return (nameCount.get(n) ?? 0) > 1 ? `${n} · ${HOLDING_CODE.get(id.split('-')[0]) ?? ''}` : n
  }

  const industryPeers = (ind: IndustryId) => {
    const real = [...brandsAll.entries()].filter(([, list]) => list[0].industry === ind).map(([id, list]) => ({ id, m: combine(list) }))
    return { real, synthetic: syntheticPeers(`peer:${ind}`, PEERS_PER_INDUSTRY[ind], real.map((r) => r.m)) }
  }
  const outletPeers = (ind: IndustryId) => {
    const real = ALL_STORES.filter((s) => s.industry === ind).map((s) => ({ id: s.id, m: storeMetrics(s) }))
    return { real, synthetic: syntheticPeers(`outlet:${ind}`, 40, real.map((r) => r.m)) }
  }
  const cityLines = (ind: IndustryId, own: Store[]): RankLine[] => {
    const byCity = new Map<string, Store[]>()
    for (const s of own) byCity.set(s.cityId, [...(byCity.get(s.cityId) ?? []), s])
    return [...byCity.entries()]
      .map(([cityId, list]) => {
        const ownIds = new Set(list.map((s) => s.id))
        const others = ALL_STORES.filter((s) => s.cityId === cityId && s.industry === ind && !ownIds.has(s.id)).map(storeMetrics)
        const extra = syntheticPeers(`city:${cityId}:${ind}`, 4 + (hashString(cityId + ind) % 7), [combine(list), ...others])
        return rankLine(cityById(cityId).name, combine(list), [...others, ...extra])
      })
      .sort((a, b) => a.rank / a.of - b.rank / b.of)
  }
  /** The leaderboard: what is in scope is named, the rest of the network is "Peer 01", "Peer 02"… */
  const board = (ownId: string, real: { id: string; m: Metrics }[], synthetic: Metrics[], nameOf: (id: string) => string | null) => {
    const all = [...real, ...synthetic.map((m, i) => ({ id: `syn-${i}`, m }))]
    const scored = all.map((x) => ({ ...x, score: scoreIn(x.m, all.filter((y) => y !== x).map((y) => y.m)) })).sort((a, b) => b.score - a.score)
    let peerNo = 0
    const named = scored.map((x, i) => ({
      name: nameOf(x.id) ?? `Peer ${String(++peerNo).padStart(2, '0')}`,
      score: x.score,
      zone: zoneOf(x.score),
      own: x.id === ownId,
      rank: i + 1,
    }))
    const top = named.slice(0, 8)
    const me = named.find((x) => x.own)
    return me && !top.includes(me) ? [...top, me] : top
  }
  const brandInScope = (id: string) => (brandsAll.get(id) ?? []).some((s) => inScope.has(s.id))
  const stats = (list: Metrics[]) => {
    const pick = (q: number, better: 'up' | 'down') => (key: MetricKey) => quantile(list.map((m) => m[key]), better === 'up' ? q : 1 - q)
    const med = Object.fromEntries(METRICS.map(({ key }) => [key, quantile(list.map((m) => m[key]), 0.5)])) as unknown as Metrics
    const top = Object.fromEntries(METRICS.map(({ key, better }) => [key, pick(0.75, better)(key)])) as unknown as Metrics
    return { med, top }
  }

  if (stores.length === 1) {
    const s = stores[0]
    const m = storeMetrics(s)
    const { real, synthetic } = outletPeers(s.industry)
    const others = [...real.filter((r) => r.id !== s.id).map((r) => r.m), ...synthetic]
    const industryRank = rankLine(`${IND_NAME[s.industry]} outlets`, m, others)
    const siblings = (brandsAll.get(s.brandId) ?? []).filter((x) => x.id !== s.id).map(storeMetrics)
    const { med, top } = stats([m, ...others])
    return [
      {
        id: s.id,
        name: s.name,
        kind: 'outlet',
        industry: s.industry,
        outlets: 1,
        metrics: m,
        score: industryRank.score,
        zone: industryRank.zone,
        industryRank,
        brandRank: siblings.length ? rankLine(`${BRAND_NAME.get(s.brandId)} outlets`, m, siblings) : null,
        cityRanks: cityLines(s.industry, [s]),
        median: med,
        top,
        board: board(s.id, real, synthetic, (id) => (inScope.has(id) ? (ALL_STORES.find((x) => x.id === id)?.name ?? null) : null)),
      },
    ]
  }

  const mine = new Map<string, Store[]>()
  for (const s of stores) mine.set(s.brandId, [...(mine.get(s.brandId) ?? []), s])
  const cache = new Map<IndustryId, ReturnType<typeof industryPeers>>()
  return [...mine.entries()]
    .map(([brandId, list]): BenchUnit => {
      const ind = list[0].industry
      const peers = cache.get(ind) ?? industryPeers(ind)
      cache.set(ind, peers)
      // The brand as it trades in this scope (a city scope compares only those outlets).
      const m = combine(list)
      const others = [...peers.real.filter((r) => r.id !== brandId).map((r) => r.m), ...peers.synthetic]
      const industryRank = rankLine(IND_NAME[ind], m, others)
      const { med, top } = stats([m, ...others])
      return {
        id: brandId,
        name: brandName(brandId),
        kind: 'brand',
        industry: ind,
        outlets: list.length,
        metrics: m,
        score: industryRank.score,
        zone: industryRank.zone,
        industryRank,
        brandRank: null,
        cityRanks: cityLines(ind, list),
        median: med,
        top,
        // The board ranks whole brands; the unit's own line uses its score in this scope.
        board: board(brandId, [{ id: brandId, m }, ...peers.real.filter((r) => r.id !== brandId)], peers.synthetic, (id) => (brandInScope(id) ? brandName(id) : null)),
      }
    })
    .sort((a, b) => a.score - b.score)
}

// ───────────────── Customer feedback ─────────────────

export type ReviewSource = 'receipt' | 'kiosk' | 'web' | 'delivery' | 'google'
export const SOURCE_LABEL: Record<ReviewSource, string> = { receipt: 'Receipt QR', kiosk: 'Kiosk', web: 'Website & app', delivery: 'Delivery apps', google: 'Google' }

export interface Review {
  id: string
  stars: number
  store: string
  source: ReviewSource
  /** Minutes ago. */
  minutes: number
  text: string
  topic: string
  replied: boolean
}

export interface FeedbackInsights {
  count: number
  avg: number
  avgDelta: number
  /** Counts for 5, 4, 3, 2 and 1 star. */
  dist: number[]
  /** Share of 4 and 5 stars (%). */
  positive: number
  responseRate: number
  unansweredNegative: number
  sources: { id: ReviewSource; label: string; count: number; avg: number }[]
  topics: { label: string; positive: number; mentions: number }[]
  reviews: Review[]
}

/** Star shares (5 → 1) for an outlet's average rating. */
function starShares(mean: number) {
  const k = mean - 3.5
  const raw = [0.24 + k * 0.36, 0.3 + k * 0.04, 0.2 - k * 0.1, 0.13 - k * 0.14, 0.13 - k * 0.16].map((v) => Math.max(0.02, v))
  const t = sumOf(raw)
  return raw.map((v) => v / t)
}
/** The rating an outlet shows: the average of its star shares. */
function ratingOf(p: Profile) {
  const sh = starShares(p.rating)
  return sh.reduce((a, v, i) => a + v * (5 - i), 0)
}

const TOPICS: Record<IndustryId, string[]> = {
  hospitality: ['Food', 'Speed', 'Service', 'Price', 'Cleanliness'],
  it: ['Product', 'Advice', 'Waiting time', 'Price', 'After-sales'],
  harvest: ['Freshness', 'Choice', 'Service', 'Price', 'Delivery'],
}
/** [text, topic index] per sentiment: 0 = negative, 1 = mixed, 2 = positive. */
const COMMENTS: Record<IndustryId, [string, number][][]> = {
  hospitality: [
    [
      ['Cold fries and a missing drink in my delivery.', 0],
      ['Waited 35 minutes for two bowls.', 1],
      ['Table not cleaned, staff overwhelmed.', 4],
      ['Charged twice on my card, please refund.', 3],
    ],
    [
      ['Good food but we waited 20 minutes.', 1],
      ['Nice place, a bit pricey for lunch.', 3],
      ['Order was right, packaging could be better.', 0],
    ],
    [
      ['The Signature Burger was perfect, staff very friendly.', 0],
      ['Fast service even at the lunch rush.', 1],
      ['Great brunch, we will be back!', 2],
      ['Delivery arrived hot and on time.', 1],
    ],
  ],
  it: [
    [
      ['Headset broke after a week, still no answer.', 4],
      ['Waited 40 minutes at the service desk.', 2],
      ['Shown in stock online, but it was not.', 0],
    ],
    [
      ['Good price but the queue was long.', 2],
      ['Product fine, setup took longer than promised.', 4],
    ],
    [
      ['Screen repaired in one hour, perfect.', 4],
      ['Helpful advice on choosing a monitor.', 1],
      ['Smooth click & collect.', 2],
    ],
  ],
  harvest: [
    [
      ['Eggs broken in my delivery.', 4],
      ['Bread was stale by noon.', 0],
      ['Card machine down, cash only.', 2],
    ],
    [
      ['Good quality, but prices went up.', 3],
      ['Tomatoes missing from my basket, rest was fine.', 4],
    ],
    [
      ['Fresh vegetables, love the seasonal basket.', 0],
      ['Friendly staff and great sourdough.', 2],
      ['Delivery right on time.', 4],
    ],
  ],
}

const fbCache = new Map<string, FeedbackInsights>()
/** Customer feedback from every channel (receipt QR, kiosk, website and app, delivery apps, Google) over the last `range` days. */
export function feedback(stores: Store[], range: Range): FeedbackInsights {
  const today = dayAt(0).toDateString()
  const key = `${range}:${today}:${hashString(stores.map((s) => s.id).join())}`
  const hit = fbCache.get(key)
  if (hit) return hit

  const dist = [0, 0, 0, 0, 0]
  let count = 0
  let prevSum = 0
  let prevCount = 0
  let answered = 0
  let negUnanswered = 0
  const src = new Map<ReviewSource, { count: number; sum: number }>()
  const topics = new Map<string, { pos: number; n: number }>()
  const weights: { s: Store; n: number; shares: number[] }[] = []

  for (const s of stores) {
    const p = profile(s)
    let orders = 0
    for (let i = 1; i <= range; i++) orders += dayOf(s, i).revenue / p.basket
    const n = orders * p.reviewRate
    const r = rng(`${s.id}:fb:${range}:${today}`)
    // The rating moves a little from one period to the next.
    const drift = between(r, -0.18, 0.18)
    const shares = starShares(p.rating + drift / 2)
    const prevShares = starShares(p.rating - drift / 2)
    shares.forEach((v, i) => (dist[i] += v * n))
    count += n
    prevSum += prevShares.reduce((a, v, i) => a + v * (5 - i), 0) * n
    prevCount += n
    answered += n * p.replies
    negUnanswered += n * (shares[3] + shares[4]) * (1 - p.replies * 0.8)
    const mean = shares.reduce((a, v, i) => a + v * (5 - i), 0)
    const split: [ReviewSource, number][] = [
      ['receipt', 0.3],
      ['kiosk', p.kiosk ? 0.1 : 0],
      ['web', 0.15],
      ['delivery', s.industry === 'hospitality' ? 0.25 : 0.08],
      ['google', 0.2],
    ]
    const tot = sumOf(split.map(([, v]) => v))
    for (const [id, v] of split) {
      if (!v) continue
      const cur = src.get(id) ?? { count: 0, sum: 0 }
      const off = id === 'delivery' ? -0.25 : id === 'receipt' ? 0.15 : id === 'google' ? -0.05 : 0
      cur.count += (n * v) / tot
      cur.sum += ((n * v) / tot) * Math.min(5, Math.max(1, mean + off))
      src.set(id, cur)
    }
    TOPICS[s.industry].forEach((t, i) => {
      const cur = topics.get(t) ?? { pos: 0, n: 0 }
      const m = n * [0.38, 0.26, 0.2, 0.1, 0.06][i]
      const pos = Math.min(0.97, Math.max(0.2, (mean - 1) / 4 + between(r, -0.12, 0.08) - (i === 1 ? 0.06 : 0)))
      cur.pos += m * pos
      cur.n += m
      topics.set(t, cur)
    })
    weights.push({ s, n, shares })
  }

  // The latest reviews: drawn from the outlets in proportion to their reviews, newest first.
  const reviews: Review[] = []
  const rr = rng(`fb:list:${key}`)
  const totalN = sumOf(weights.map((w) => w.n)) || 1
  const perMinute = totalN / (range * 24 * 60)
  let minutes = 0
  for (let i = 0; i < 14 && weights.length; i++) {
    minutes += Math.max(1, Math.round((-Math.log(1 - rr() * 0.999) / Math.max(perMinute, 1e-4)) * 0.6))
    let pickN = rr() * totalN
    const w = weights.find((x) => (pickN -= x.n) <= 0) ?? weights[0]
    let roll = rr()
    let star = 5
    for (let k = 0; k < 5; k++) {
      roll -= w.shares[k]
      if (roll <= 0) {
        star = 5 - k
        break
      }
    }
    const mood = star >= 4 ? 2 : star === 3 ? 1 : 0
    const bank = COMMENTS[w.s.industry][mood]
    const [text, topicIdx] = bank[Math.floor(rr() * bank.length)]
    const srcRoll = rr()
    // A comment about a delivery or an online order comes from where that order was placed.
    const source: ReviewSource = /deliver|basket/i.test(text)
      ? w.s.industry === 'hospitality'
        ? 'delivery'
        : 'web'
      : /online|click/i.test(text)
        ? 'web'
        : srcRoll < 0.35
          ? 'receipt'
          : srcRoll < 0.6
            ? 'google'
            : srcRoll < 0.75
              ? 'web'
              : profile(w.s).kiosk
                ? 'kiosk'
                : 'receipt'
    const replyChance = (mood === 2 ? 0.7 : mood === 1 ? 0.5 : 0.35) * (minutes < 120 ? 0.3 : 1)
    reviews.push({ id: `${w.s.id}-${i}`, stars: star, store: w.s.name, source, minutes, text, topic: TOPICS[w.s.industry][topicIdx], replied: rr() < replyChance })
  }

  const avg = count ? dist.reduce((a, v, i) => a + v * (5 - i), 0) / count : 0
  const out: FeedbackInsights = {
    count: Math.round(count),
    avg,
    avgDelta: prevCount ? avg - prevSum / prevCount : 0,
    dist: dist.map((v) => Math.round(v)),
    positive: count ? ((dist[0] + dist[1]) / count) * 100 : 0,
    responseRate: count ? (answered / count) * 100 : 0,
    unansweredNegative: Math.round(negUnanswered),
    sources: [...src.entries()].map(([id, v]) => ({ id, label: SOURCE_LABEL[id], count: Math.round(v.count), avg: v.count ? v.sum / v.count : 0 })).sort((a, b) => b.count - a.count),
    topics: [...topics.entries()].map(([label, v]) => ({ label, positive: v.n ? (v.pos / v.n) * 100 : 0, mentions: Math.round(v.n) })).sort((a, b) => b.mentions - a.mentions),
    reviews,
  }
  fbCache.set(key, out)
  return out
}

// ───────────────── Suggested actions ─────────────────

export type DashTab = 'today' | 'sales' | 'bench' | 'feedback'
export interface SuggestedAction {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  why: string
  tab?: DashTab
  cta?: string
}

const fmtPct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toLocaleString('fr-BE', { maximumFractionDigits: 0 })} %`
export const hourRange = (h: number) => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`

/** What to do next, most urgent first, from everything the first page knows. */
export function suggestActions(x: {
  stores: Store[]
  base: ScopeKpis
  sales: SalesInsights
  bench: BenchUnit[]
  fb: FeedbackInsights
  /** Every late order, and the outlet with the most of them (empty for a single outlet). */
  late: { count: number; where: string; atWorst: number } | null
}): SuggestedAction[] {
  const out: SuggestedAction[] = []
  const single = x.stores.length === 1

  if (x.late && x.late.count > 0) {
    const { count, where, atWorst } = x.late
    const at = !where ? '' : count === 1 ? ` at ${where}` : atWorst > 1 ? `, ${atWorst} of them at ${where}` : `, including one at ${where}`
    out.push({
      id: 'late',
      priority: 'high',
      title: `${count} ${count === 1 ? 'order is' : 'orders are'} late`,
      why: `Waiting more than 15 minutes${at}. Call the kitchen and check what is holding the ticket.`,
    })
  }

  const offline = x.stores.filter((s) => s.status === 'offline')
  if (offline.length)
    out.push({
      id: 'offline',
      priority: 'high',
      title: single ? 'This outlet is offline' : `${offline.length} ${offline.length === 1 ? 'outlet is' : 'outlets are'} offline`,
      why: `${single ? 'Its' : offline.slice(0, 2).map((s) => s.name).join(', ') + (offline.length > 2 ? '…' : '') + ':'} sales are not coming in. Check the internet box and the POS.`,
    })

  for (const u of x.bench.filter((b) => b.zone === 'danger').slice(0, 2)) {
    const worst = [...u.cityRanks].sort((a, b) => b.rank / b.of - a.rank / a.of)[0]
    out.push({
      id: `danger-${u.id}`,
      priority: 'high',
      title: `${u.name} is in the danger zone`,
      why: `#${u.industryRank.rank} of ${u.industryRank.of} in its industry: sales ${fmtPct(u.metrics.growth)} in 30 days, rating ${u.metrics.rating.toFixed(1)}.${worst ? ` Start with ${worst.label} (#${worst.rank} of ${worst.of}).` : ''}`,
      tab: 'bench',
      cta: 'See the benchmark',
    })
  }

  if (x.fb.unansweredNegative > 0) {
    const weakest = [...x.fb.topics].sort((a, b) => a.positive - b.positive)[0]
    out.push({
      id: 'reviews',
      priority: x.fb.unansweredNegative >= 5 ? 'high' : 'medium',
      title: `Answer ${x.fb.unansweredNegative} negative ${x.fb.unansweredNegative === 1 ? 'review' : 'reviews'}`,
      why: `1 and 2 stars from the last 7 days with no reply${weakest ? `, mostly about ${weakest.label.toLowerCase()}` : ''}. A quick answer keeps the customer.`,
      tab: 'feedback',
      cta: 'Open feedback',
    })
  }

  const peak = x.sales.dayparts.reduce((a, b) => (b.revenue > a.revenue ? b : a), x.sales.dayparts[0])
  if (peak)
    out.push({
      id: 'peak',
      priority: 'medium',
      title: `Staff up for ${DAYS_LONG[x.sales.peakDay.dow]} ${peak.label.toLowerCase()}`,
      why: `${DAYS_LONG[x.sales.peakDay.dow]} is the busiest day (${fmtPct(x.sales.peakDay.lift)} on an average day) and the peak hour is ${hourRange(x.sales.peakSlot.h)}.`,
      tab: 'sales',
      cta: 'See peak hours',
    })

  const slow = [...x.sales.products].filter((p) => p.trend < -5).sort((a, b) => a.qty - b.qty)[0]
  if (slow)
    out.push({
      id: `slow-${slow.name}`,
      priority: 'low',
      title: `Rethink ${slow.name}`,
      why: `${Math.round(slow.qty).toLocaleString('fr-BE')} sold in ${x.sales.range} days (${fmtPct(slow.trend)}). Put it in a combo or take it off the menu.`,
      tab: 'sales',
      cta: 'See products',
    })

  if (x.sales.channels.online.growth > 8)
    out.push({
      id: 'online',
      priority: 'low',
      title: `Online orders are up ${fmtPct(x.sales.channels.online.growth)}`,
      why: `Online is ${Math.round(x.sales.onlineShare)} % of sales. Put the best sellers first on the website and the delivery menus.`,
      tab: 'sales',
      cta: 'See online vs store',
    })

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.priority] - rank[b.priority])
}
