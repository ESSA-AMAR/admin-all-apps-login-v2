import { between, pick, rng } from './random'
import type { IndustryId, Store } from '../data/types'

export interface IndustryKpi {
  label: string
  value: number
  unit?: string
  decimals?: number
  delta: number
}

/** Profit and control figures. The ratios are % of sales; the deltas are in points against last week. */
export interface ControlKpis {
  /** Like-for-like sales growth: same outlets, against the same day last year (%). */
  lfl: number
  /** Product cost plus labour, as a share of sales (%). */
  primeCost: number
  /** Voids, refunds and discounts, as a share of sales (%). */
  loss: number
  primeCostDelta: number
  lossDelta: number
}

export interface StoreKpis {
  revenueToday: number
  target: number
  transactions: number
  avgBasket: number
  customers: number
  deltas: { revenue: number; transactions: number; basket: number; customers: number }
  hourly: number[]
  hourlyLastWeek: number[]
  paymentMix: { label: string; value: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  industry: IndustryKpi[]
  staff: { name: string; role: string; since: string }[]
  terminals: { id: string; app: string; status: 'online' | 'idle' | 'offline' }[]
  control: ControlKpis
}

/** Business-hour shape per industry (0–1 weight by hour). */
export const SHAPE: Record<IndustryId, (h: number) => number> = {
  it: (h) => (h < 9 || h > 20 ? 0 : 0.4 + 0.6 * Math.exp(-((h - 15) ** 2) / 14)),
  hospitality: (h) =>
    h < 7 ? 0 : 0.15 + 0.85 * Math.exp(-((h - 12.8) ** 2) / 2.2) + 1.0 * Math.exp(-((h - 20) ** 2) / 3),
  harvest: (h) => (h < 7 || h > 19 ? 0 : 0.3 + 0.9 * Math.exp(-((h - 10) ** 2) / 5) + 0.4 * Math.exp(-((h - 17) ** 2) / 3)),
}

const PRODUCTS: Record<IndustryId, [string, number][]> = {
  it: [['USB-C Hub Pro', 59], ['Noise-cancel Headset', 189], ['27" 4K Monitor', 349], ['Repair — Screen', 129], ['Mesh Wi-Fi Kit', 219], ['Cloud Backup 1y', 79]],
  hospitality: [['Signature Burger', 19], ['Espresso Tonic', 6], ['Truffle Risotto', 26], ['Natural Wine (gl.)', 9], ['Brunch Formula', 32], ['Craft IPA', 7]],
  harvest: [['Heirloom Tomatoes /kg', 6.5], ['Organic Eggs x12', 5.9], ['Sourdough Loaf', 4.8], ['Seasonal Basket', 29], ['Raw Honey 500g', 11], ['Apple Juice 1L', 3.9]],
}

const FIRST = ['Lina', 'Noah', 'Amira', 'Lucas', 'Yasmine', 'Hugo', 'Sofia', 'Milan', 'Inès', 'Adam', 'Emma', 'Rayan']
const LAST = ['D.', 'V.', 'M.', 'B.', 'K.', 'P.', 'L.', 'R.']
const ROLES: Record<IndustryId, string[]> = {
  it: ['Store Lead', 'Tech Advisor', 'Repair Tech', 'Cashier'],
  hospitality: ['Floor Manager', 'Chef de Partie', 'Bartender', 'Server'],
  harvest: ['Market Lead', 'Produce Buyer', 'Cashier', 'Stock Runner'],
}
const APPS = ['POS', 'POS', 'Kiosk', 'KDS', 'Handheld', 'Self-checkout']

/** Hour the business day rolls over: late-night trade before it still counts for the previous day. */
const DAY_START = 6

/** The trading day `now` falls in, and how far through it we are (24 once that day has closed). */
export function businessDay(now = new Date()): { date: string; hour: number } {
  const hour = now.getHours() + now.getMinutes() / 60
  if (hour >= DAY_START) return { date: now.toDateString(), hour }
  const prev = new Date(now)
  prev.setDate(prev.getDate() - 1)
  return { date: prev.toDateString(), hour: 24 }
}

export function buildKpis(store: Store, now = new Date()): StoreKpis {
  const day = businessDay(now)
  const r = rng(store.id + day.date)
  const scale =
    store.industry === 'it' ? between(r, 260, 520) : store.industry === 'hospitality' ? between(r, 320, 680) : between(r, 160, 380)
  const curHour = day.hour

  const hourlyLastWeek = Array.from({ length: 24 }, (_, h) => Math.round(SHAPE[store.industry](h) * scale * between(r, 0.8, 1.2)))
  const hourly = hourlyLastWeek.map((v, h) => {
    if (h > curHour) return 0
    const partial = h + 1 > curHour ? curHour - h : 1
    return Math.round(v * between(r, 0.85, 1.35) * partial)
  })

  const revenueToday = hourly.reduce((a, b) => a + b, 0)
  const target = Math.round(hourlyLastWeek.reduce((a, b) => a + b, 0) * 1.08)
  const products = PRODUCTS[store.industry]
  const avgBasket = store.industry === 'it' ? between(r, 85, 160) : store.industry === 'hospitality' ? between(r, 24, 48) : between(r, 14, 32)
  const transactions = Math.round(revenueToday / avgBasket)

  const industry: IndustryKpi[] =
    store.industry === 'hospitality'
      ? [
          { label: 'Covers served', value: Math.round(transactions * between(r, 1.6, 2.4)), delta: between(r, -6, 14) },
          { label: 'Table turnover', value: between(r, 1.8, 3.4), decimals: 1, unit: 'x', delta: between(r, -4, 9) },
          { label: 'Kitchen time', value: between(r, 9, 19), decimals: 1, unit: 'min', delta: between(r, -12, 6) },
        ]
      : store.industry === 'it'
        ? [
            { label: 'Units sold', value: Math.round(transactions * between(r, 1.2, 1.9)), delta: between(r, -5, 12) },
            { label: 'Open repairs', value: Math.round(between(r, 3, 22)), delta: between(r, -15, 10) },
            { label: 'Subscriptions', value: Math.round(between(r, 4, 30)), delta: between(r, 0, 22) },
          ]
        : [
            { label: 'Produce sold', value: Math.round(revenueToday / between(r, 3, 5)), unit: 'kg', delta: between(r, -4, 15) },
            { label: 'Freshness waste', value: between(r, 1.2, 4.8), decimals: 1, unit: '%', delta: between(r, -20, 5) },
            { label: 'Supplier drops', value: Math.round(between(r, 2, 9)), delta: between(r, -10, 10) },
          ]

  // Profit and control figures: demo values drawn from a separate seed, so nothing above changes. Prime cost runs higher in retail than in food.
  const rc = rng(`${store.id}:control:${day.date}`)
  const [primeLo, primeHi] = store.industry === 'it' ? [66, 78] : store.industry === 'hospitality' ? [56, 68] : [58, 70]
  const control: ControlKpis = {
    lfl: between(rc, -6, 14),
    primeCost: between(rc, primeLo, primeHi),
    loss: between(rc, 1.1, 4.8),
    primeCostDelta: between(rc, -2.5, 2.5),
    lossDelta: between(rc, -1, 1),
  }

  const card = between(r, 48, 66)
  const contactless = between(r, 14, 26)
  const cash = between(r, 6, 16)
  const paymentMix = [
    { label: 'Card', value: card },
    { label: 'Contactless', value: contactless },
    { label: 'Cash', value: cash },
    { label: 'Voucher', value: Math.max(2, 100 - card - contactless - cash) },
  ]

  return {
    revenueToday,
    target,
    transactions,
    avgBasket,
    customers: Math.round(transactions * between(r, 0.82, 0.97)),
    deltas: {
      revenue: between(r, -8, 18),
      transactions: between(r, -6, 14),
      basket: between(r, -5, 9),
      customers: between(r, -7, 12),
    },
    hourly,
    hourlyLastWeek,
    paymentMix,
    control,
    topProducts: products
      .map(([name, price]) => {
        const qty = Math.round(between(r, 4, 60) * (revenueToday / scale / 8 + 0.3))
        return { name, qty, revenue: qty * price }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    industry,
    staff: Array.from({ length: 4 }, (_, i) => ({
      name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
      role: ROLES[store.industry][i],
      since: `${String(Math.floor(between(r, 6, 11))).padStart(2, '0')}:${pick(r, ['00', '15', '30', '45'])}`,
    })),
    terminals: Array.from({ length: Math.min(store.terminals, 8) }, (_, i) => {
      const roll = r()
      return {
        id: `T-${String(i + 1).padStart(2, '0')}`,
        app: APPS[i % APPS.length],
        status: store.status === 'offline' ? 'offline' : roll > 0.88 ? 'offline' : roll > 0.65 ? 'idle' : 'online',
      }
    }),
  }
}

export function randomTicket(store: Store) {
  const r = Math.random
  const products = PRODUCTS[store.industry]
  const [name, price] = products[Math.floor(r() * products.length)]
  const qty = 1 + Math.floor(r() * 3)
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    item: name,
    qty,
    amount: price * qty * (0.9 + r() * 0.3),
    method: ['Card', 'Contactless', 'Cash', 'Card', 'Contactless'][Math.floor(r() * 5)],
    terminal: `T-0${1 + Math.floor(r() * Math.min(store.terminals, 8))}`,
    at: new Date(),
  }
}

export const eur = (v: number, decimals = 0) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v)

// ───────────────── Consolidation ─────────────────

const cache = new Map<string, StoreKpis>()
/** Per-store KPIs, memoised for the day so every level consolidates the same numbers. */
export function storeKpis(store: Store, now = new Date()): StoreKpis {
  const key = store.id + businessDay(now).date
  let k = cache.get(key)
  if (!k) {
    k = buildKpis(store, now)
    cache.set(key, k)
  }
  return k
}

export interface ScopeKpis {
  storeCount: number
  revenueToday: number
  target: number
  transactions: number
  avgBasket: number
  customers: number
  deltas: StoreKpis['deltas']
  hourly: number[]
  hourlyLastWeek: number[]
  paymentMix: StoreKpis['paymentMix']
  topProducts: StoreKpis['topProducts']
  /** Only meaningful when every store in scope shares one industry. */
  industry: IndustryKpi[] | null
  status: { online: number; degraded: number; offline: number }
  terminals: { online: number; total: number }
  staffOnShift: number
  control: ControlKpis
}

const RATIO_UNITS = new Set(['x', 'min', '%'])

export function consolidate(stores: Store[]): ScopeKpis {
  const all = stores.map((s) => storeKpis(s))
  const sum = (f: (k: StoreKpis) => number) => all.reduce((a, k) => a + f(k), 0)
  const revenueToday = sum((k) => k.revenueToday)
  const transactions = sum((k) => k.transactions)
  // Deltas and shares are weighted by revenue so a big store moves the number more than a small one.
  const weighted = (f: (k: StoreKpis) => number) => (revenueToday ? all.reduce((a, k) => a + f(k) * k.revenueToday, 0) / revenueToday : 0)

  const products = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const k of all)
    for (const p of k.topProducts) {
      const cur = products.get(p.name) ?? { name: p.name, qty: 0, revenue: 0 }
      cur.qty += p.qty
      cur.revenue += p.revenue
      products.set(p.name, cur)
    }

  const industries = new Set(stores.map((s) => s.industry))
  let industry: IndustryKpi[] | null = null
  if (industries.size === 1 && all.length) {
    industry = all[0].industry.map((first, i) => {
      const values = all.map((k) => k.industry[i].value)
      const ratio = first.unit && RATIO_UNITS.has(first.unit)
      return {
        ...first,
        value: ratio ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0),
        delta: weighted((k) => k.industry[i].delta),
      }
    })
  }

  return {
    storeCount: stores.length,
    revenueToday,
    target: sum((k) => k.target),
    transactions,
    avgBasket: transactions ? revenueToday / transactions : 0,
    customers: sum((k) => k.customers),
    deltas: {
      revenue: weighted((k) => k.deltas.revenue),
      transactions: weighted((k) => k.deltas.transactions),
      basket: weighted((k) => k.deltas.basket),
      customers: weighted((k) => k.deltas.customers),
    },
    control: {
      lfl: weighted((k) => k.control.lfl),
      primeCost: weighted((k) => k.control.primeCost),
      loss: weighted((k) => k.control.loss),
      primeCostDelta: weighted((k) => k.control.primeCostDelta),
      lossDelta: weighted((k) => k.control.lossDelta),
    },
    hourly: Array.from({ length: 24 }, (_, h) => sum((k) => k.hourly[h])),
    hourlyLastWeek: Array.from({ length: 24 }, (_, h) => sum((k) => k.hourlyLastWeek[h])),
    paymentMix: (all[0]?.paymentMix ?? []).map((m, i) => ({ label: m.label, value: weighted((k) => k.paymentMix[i].value) })),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    industry,
    status: {
      online: stores.filter((s) => s.status === 'online').length,
      degraded: stores.filter((s) => s.status === 'degraded').length,
      offline: stores.filter((s) => s.status === 'offline').length,
    },
    terminals: {
      online: sum((k) => k.terminals.filter((t) => t.status === 'online').length),
      total: sum((k) => k.terminals.length),
    },
    staffOnShift: sum((k) => k.staff.length),
  }
}

export interface BreakdownRow {
  key: string
  label: string
  sub?: string
  storeCount: number
  online: number
  revenue: number
  target: number
  delta: number
}

/** Consolidated figures for each child group of a scope (industries of a holding, brands of an industry…). */
export function breakdown(stores: Store[], keyOf: (s: Store) => string, labelOf: (key: string) => string, subOf?: (key: string) => string): BreakdownRow[] {
  const groups = new Map<string, Store[]>()
  for (const s of stores) {
    const k = keyOf(s)
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const c = consolidate(group)
      return {
        key,
        label: labelOf(key),
        sub: subOf?.(key),
        storeCount: group.length,
        online: c.status.online,
        revenue: c.revenueToday,
        target: c.target,
        delta: c.deltas.revenue,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}
