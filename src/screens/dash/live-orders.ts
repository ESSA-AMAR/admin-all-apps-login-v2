/** Orders in progress across the outlets in scope: simulated, they move in real time (new → preparing → ready → handed over). */
import { useEffect, useMemo, useState } from 'react'
import type { Store } from '../../data/types'
import { menuOf } from '../../lib/insights'

/** An order is late after this many minutes without being ready. */
export const LATE_MIN = 15

export type OrderStatus = 'new' | 'preparing' | 'ready'
export interface LiveOrder {
  id: string
  store: string
  /** Table 12, Takeaway, Glovo, Kiosk 2, Click & collect… */
  where: string
  items: string
  amount: number
  placed: number
  /** Minutes the order should take. */
  target: number
  status: OrderStatus
  readyAt?: number
}

export interface LiveStats {
  open: number
  late: number
  ready: number
  preparing: number
  fresh: number
  /** The outlet with the most late orders (its name is empty for a single outlet). */
  worst: { count: number; where: string } | null
}

const DELIVERY = ['Glovo', 'Uber Eats', 'Deliveroo']
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pickOne = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

function makeOrder(s: Store, ageMin: number, now: number): LiveOrder {
  const food = s.industry === 'hospitality'
  const roll = Math.random()
  const where = food
    ? roll < 0.45
      ? `Table ${1 + Math.floor(Math.random() * 24)}`
      : roll < 0.65
        ? 'Takeaway'
        : roll < 0.88
          ? pickOne(DELIVERY)
          : `Kiosk ${1 + Math.floor(Math.random() * 3)}`
    : roll < 0.55
      ? 'Counter'
      : roll < 0.85
        ? 'Click & collect'
        : 'Home delivery'
  const menu = menuOf(s.industry)
  const lines = 1 + Math.floor(Math.random() * (food ? 3 : 2))
  let amount = 0
  const items = Array.from({ length: lines }, () => {
    const [name, , price] = pickOne(menu)
    const q = food ? 1 + Math.floor(Math.random() * 2) : 1
    amount += q * price
    return `${q}× ${name}`
  }).join(', ')
  const target = food ? rand(6, 19) : rand(4, 14)
  const placed = now - ageMin * 60_000
  const status: OrderStatus = ageMin < 0.7 ? 'new' : ageMin < target ? 'preparing' : 'ready'
  return {
    id: `#${String.fromCharCode(65 + Math.floor(Math.random() * 6))}${100 + Math.floor(Math.random() * 900)}`,
    store: s.name,
    where,
    items,
    amount,
    placed,
    target,
    status,
    readyAt: status === 'ready' ? placed + target * 60_000 : undefined,
  }
}

export const isLate = (o: LiveOrder, now: number) => o.status !== 'ready' && (now - o.placed) / 60_000 > LATE_MIN

/** Orders in progress, kept around a level that fits the number of outlets. */
export function useLiveOrders(stores: Store[]) {
  const live = useMemo(() => stores.filter((s) => s.status !== 'offline'), [stores])
  const single = stores.length === 1
  const level = Math.min(220, Math.max(6, Math.round(live.length * 4)))
  const [orders, setOrders] = useState<LiveOrder[]>(() => {
    const now = Date.now()
    if (!live.length) return []
    return Array.from({ length: level }, () => makeOrder(pickOne(live), rand(0, 24), now)).filter((o) => o.status !== 'ready' || (o.readyAt ?? 0) > now - 3 * 60_000)
  })
  const [now, setNow] = useState(() => Date.now())

  // Every second: the clock, and each order moves on. A ready order is handed over after 3 minutes.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      setOrders((list) =>
        list
          .map((o) => {
            const age = (t - o.placed) / 60_000
            if (o.status === 'new' && age > 0.7) return { ...o, status: 'preparing' as const }
            if (o.status === 'preparing' && age >= o.target) return { ...o, status: 'ready' as const, readyAt: t }
            return o
          })
          .filter((o) => o.status !== 'ready' || t - (o.readyAt ?? t) < 3 * 60_000),
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // New orders come in, faster with more outlets, and pause while the level is reached.
  useEffect(() => {
    if (!live.length) return
    let id: number
    const pace = Math.min(25_000, Math.max(2500, 900_000 / level))
    const tick = () => {
      setOrders((list) => (list.length > level * 1.15 ? list : [makeOrder(pickOne(live), 0, Date.now()), ...list]))
      id = window.setTimeout(tick, pace * rand(0.5, 1.5))
    }
    id = window.setTimeout(tick, 2000)
    return () => window.clearTimeout(id)
  }, [live, level])

  const stats = useMemo<LiveStats>(() => {
    const late = orders.filter((o) => isLate(o, now))
    const by = new Map<string, number>()
    for (const o of late) by.set(o.store, (by.get(o.store) ?? 0) + 1)
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      open: orders.length,
      late: late.length,
      ready: orders.filter((o) => o.status === 'ready').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      fresh: orders.filter((o) => o.status === 'new').length,
      worst: late.length ? (single ? { count: late.length, where: '' } : { count: top?.[1] ?? 0, where: top?.[0] ?? '' }) : null,
    }
  }, [orders, now, single])

  return { orders, now, stats }
}
