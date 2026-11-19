/**
 * The floor plan the Back Office edits and the POS opens with.
 * It is kept in the browser under the key the POS v3 itself reads (`cm-floor-v1`), in the POS's own shape, so a layout saved here is the layout the till shows
 * (the Back Office and the POS are served from the same address, so they share this storage).
 * The standard layout is the POS's: a Main hall of 20 tables, a Terrace of 10 and a Bar of 6 tables and 12 stools, drawn at 1 unit = 1 cm.
 */
import { useSyncExternalStore } from 'react'

export interface FZone {
  id: string
  name: string
  /** The letter a new table in this zone is numbered with (T1, T2… in the Main hall). */
  pre: string
  /** The room outline, drawn in cm (corners), as the POS stores it. */
  pts?: number[][]
  /** The zone's canvas, in cm, once a room is drawn (the room plus a margin). */
  rw?: number
  rh?: number
}
export interface FTable {
  id: string
  /** The zone it is in. */
  z: string
  x: number
  y: number
  w: number
  h: number
  seats: number
  round: boolean
  /** Set by the POS on its own tables: the real size in cm, and the drawn size it belongs to. Kept so the POS shows the same sizes. */
  cm?: number[]
  px0?: number[]
}
export interface FDecor {
  z: string
  /** A wall or counter, or a text label (Entrance, Kitchen…). */
  k: 'wall' | 'lbl'
  x: number
  y: number
  w?: number
  h?: number
  text?: string
}
export interface Floor {
  zones: FZone[]
  tables: FTable[]
  decor: FDecor[]
}

/** Every zone is drawn on a 17.2 × 6.6 m canvas. */
export const ROOM = { w: 1720, h: 660 }

/** The real size of a table in cm, by shape and seats (the POS shows this on every table of its standard layout). */
const realSize = (t: Pick<FTable, 'round' | 'seats' | 'z'>): number[] =>
  t.round ? (t.seats <= 1 ? [40, 40] : t.seats <= 2 ? [80, 80] : t.seats <= 4 ? (t.z === 'bar' ? [90, 90] : [110, 110]) : [140, 140]) : t.seats <= 4 ? [140, 80] : t.seats <= 6 ? [200, 80] : [260, 90]

export function standardFloor(): Floor {
  const zones: FZone[] = [
    { id: 'main', name: 'Main hall', pre: 'T' },
    { id: 'terrace', name: 'Terrace', pre: 'E' },
    { id: 'bar', name: 'Bar', pre: 'B' },
  ]
  const tables: FTable[] = []
  const add = (id: string, z: string, x: number, y: number, w: number, h: number, seats: number, round = false) => tables.push({ id, z, x, y, w, h, seats, round })
  // Main hall: the window column of round twos, square fours in the middle, the long group tables on the right. Four rows of five.
  const SIZES = { r2: [120, 120, 2, true], r4: [150, 150, 4, true], s4: [160, 130, 4, false], l6: [230, 130, 6, false], l8: [290, 130, 8, false] } as const
  const rows: (keyof typeof SIZES)[][] = [
    ['r2', 's4', 's4', 'r2', 'l6'],
    ['r2', 's4', 's4', 's4', 'l6'],
    ['r2', 's4', 's4', 'r4', 'l6'],
    ['r2', 's4', 's4', 'l8', 'l6'],
  ]
  rows.forEach((row, r) =>
    row.forEach((k, c) => {
      const [w, h, seats, round] = SIZES[k]
      add(`T${r * 5 + c + 1}`, 'main', 150 + c * 345 - w / 2, 80 + r * 165 - h / 2, w, h, seats, round)
    }),
  )
  // Terrace: two rows along the street, umbrellas for twos and fours
  for (let i = 0; i < 10; i++) {
    const top = i < 5
    const w = i % 2 ? 150 : 130
    add(`E${i + 1}`, 'terrace', 150 + (i % 5) * 330 - w / 2, (top ? 150 : 400) - w / 2, w, w, i % 2 ? 4 : 2, true)
  }
  // Bar: high tables, then stools along the counter
  for (let i = 0; i < 6; i++) add(`B${i + 1}`, 'bar', 120 + i * 270, 90, 140, 140, 4, true)
  for (let i = 0; i < 12; i++) add(`S${i + 1}`, 'bar', 110 + i * 130, 400, 84, 84, 1, true)
  tables.forEach((t) => {
    t.cm = realSize(t)
    t.px0 = [t.w, t.h]
  })
  const decor: FDecor[] = [
    { z: 'main', k: 'lbl', x: 90, y: 664, text: '↑ Entrance' },
    { z: 'main', k: 'lbl', x: 1500, y: 664, text: 'Kitchen ↗' },
    { z: 'terrace', k: 'wall', x: 0, y: 580, w: 1720, h: 10 },
    { z: 'terrace', k: 'lbl', x: 6, y: 614, text: 'Street side' },
    { z: 'bar', k: 'lbl', x: 6, y: 270, text: 'High tables ↑ · Stools ↓' },
    { z: 'bar', k: 'wall', x: 60, y: 520, w: 1600, h: 44 },
    { z: 'bar', k: 'lbl', x: 70, y: 582, text: 'Bar counter' },
  ]
  return { zones, tables, decor }
}

/** The size a table is shown with: its real size when it is still the POS's own drawn size, otherwise its drawn size (which is its real size). */
export function sizeOf(t: FTable): [number, number] {
  const a = t.cm && t.px0 && Math.round(t.w) === t.px0[0] && Math.round(t.h) === t.px0[1] ? t.cm : [Math.round(t.w), Math.round(t.h)]
  return [a[0], a[1]]
}
export const dimsOf = (t: FTable) => {
  const [w, h] = sizeOf(t)
  return t.round ? `Ø ${w} cm` : `${w} × ${h} cm`
}

/* ───────────────────────── the store ───────────────────────── */

const KEY = 'cm-floor-v1'
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function load(): Floor {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (f?.zones?.length && Array.isArray(f.tables)) return { zones: f.zones, tables: f.tables, decor: f.decor ?? [] }
  } catch {
    /* no saved layout, or storage is blocked */
  }
  return standardFloor()
}

let current: Floor = load()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const getFloor = () => current

/** Saves the layout where the POS reads it. */
export function saveFloor(f: Floor) {
  current = clone(f)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* the layout stays for this visit only */
  }
  emit()
}

export function useFloor(): Floor {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getFloor,
    getFloor,
  )
}


/* ───────────────────────── what a table needs around it (the POS's own rules, in real centimetres) ─────────────────────────
   The chairs of a table need room behind them (SEAT; STOOL for a bar stool), and people walk between the tables (the walkway: 60, 90 or 120 cm).
   A table's "bay" is the table plus its chairs. Two bays must be at least a walkway apart; a bay must be half a walkway from the room's walls,
   and OBST from a counter or a divider. */
export const SEAT = 55
export const STOOL = 40
export const OBST = 20
/** The margin round a drawn room on its canvas. */
export const ROOM_M = 130
/** How far a fixed spot pulls a table that is dropped near it. */
export const SNAPR = 56

export interface Box {
  x: number
  y: number
  w: number
  h: number
}
/** Everything the rules need about the zone being edited. */
export interface Geo {
  tables: FTable[]
  walls: Box[]
  poly: number[][] | null
  rw: number
  rh: number
  gap: number
  snap: number
}

/** Chair room on each side [left, top, right, bottom]: rectangles seat along the top and the bottom, round tables all round. */
export function seatEdges(t: FTable): [number, number, number, number] {
  const n = t.seats || 0
  if (!n) return [0, 0, 0, 0]
  const s = n === 1 && t.round ? STOOL : SEAT
  if (t.round) return n === 1 ? [0, s, 0, 0] : n === 2 ? [0, s, 0, s] : [s, s, s, s]
  return [0, s, 0, n - Math.ceil(n / 2) ? s : 0]
}
export const bayOf = (t: FTable, x = t.x, y = t.y): Box => {
  const [l, u, r, d] = seatEdges(t)
  return { x: x - l, y: y - u, w: t.w + l + r, h: t.h + u + d }
}
/** > 0 apart, < 0 overlapping. */
export const boxGap = (a: Box, b: Box) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h))
export const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
export const polyArea = (p: number[][]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1] }, 0)) / 2
export const fmtLen = (v: number) => (v >= 100 ? `${(v / 100).toFixed(2).replace('.', ',')} m` : `${Math.round(v)} cm`)

export function inPoly(x: number, y: number, p: number[][]) {
  let c = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c
  return c
}
/** Liang–Barsky: does the segment cross the box. */
function segHitsBox(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number) {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dy = by - ay
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const r = q / p
      if (p < 0) {
        if (r > t1) return false
        if (r > t0) t0 = r
      } else {
        if (r < t0) return false
        if (r < t1) t1 = r
      }
    }
  }
  return true
}
function bayInRoom(b: Box, me: Box, g: Geo) {
  if (!g.poly) return me.x >= 0 && me.y >= 0 && me.x + me.w <= g.rw && me.y + me.h <= g.rh
  const pad = Math.round(g.gap / 2) - 1
  const x0 = b.x - pad
  const y0 = b.y - pad
  const x1 = b.x + b.w + pad
  const y1 = b.y + b.h + pad
  const poly = g.poly
  if (![[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(([x, y]) => inPoly(x, y, poly))) return false
  return !poly.some((a, i) => {
    const c = poly[(i + 1) % poly.length]
    return segHitsBox(a[0], a[1], c[0], c[1], x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5)
  })
}
export interface Spot {
  clash: boolean
  tight: boolean
  out: boolean
  ok: boolean
}
/** What is wrong with a table standing at (x, y): touching a table or a wall (clash), closer than the walkway (tight), outside the room (out). */
export function spotState(t: FTable, x: number, y: number, g: Geo): Spot {
  const me = { x, y, w: t.w, h: t.h }
  const bb = bayOf(t, x, y)
  let clash = false
  let tight = false
  for (const o of g.tables) {
    if (o.id === t.id) continue
    if (overlap(me, o)) {
      clash = true
      continue
    }
    if (boxGap(bb, bayOf(o)) < g.gap - 0.01) tight = true
  }
  for (const w of g.walls) {
    if (overlap(me, w)) clash = true
    else if (boxGap(bb, w) < OBST - 0.01) tight = true
  }
  const out = !bayInRoom(bb, me, g)
  return { clash, tight, out, ok: !clash && !tight && !out }
}
/** Positions on one axis that line up with, or keep the walkway from, what is around: the other tables, the counters and dividers, the room's walls. */
function slotAxis(t: FTable, ax: 'x' | 'y', g: Geo) {
  const isX = ax === 'x'
  const [l, u, r, d] = seatEdges(t)
  const lo = isX ? l : u
  const hi = isX ? r : d
  const len = isX ? t.w : t.h
  const out: number[] = []
  for (const o of g.tables) {
    if (o.id === t.id) continue
    const b = bayOf(o)
    const p = isX ? o.x : o.y
    const ol = isX ? o.w : o.h
    const bs = isX ? b.x : b.y
    const bl = isX ? b.w : b.h
    out.push(p, p + ol - len, p + (ol - len) / 2, bs + bl + g.gap + lo, bs - g.gap - hi - len)
  }
  for (const w of g.walls) {
    const ws = isX ? w.x : w.y
    const wl = isX ? w.w : w.h
    out.push(ws + wl + OBST + lo, ws - OBST - hi - len)
  }
  const c = Math.round(g.gap / 2)
  if (g.poly)
    g.poly.forEach((a, i) => {
      const b = g.poly![(i + 1) % g.poly!.length]
      if (isX ? a[0] === b[0] : a[1] === b[1]) {
        const v = isX ? a[0] : a[1]
        out.push(v + c + lo, v - c - hi - len)
      }
    })
  return out
}
/** The nearest valid position to (wx, wy) within a radius, or null. */
export function bestSlot(t: FTable, wx: number, wy: number, radius: number, g: Geo) {
  const snapN = (v: number) => (g.snap ? Math.round(v / g.snap) * g.snap : Math.round(v))
  const near = (arr: number[], c: number) => [...new Set(arr.concat([c, snapN(c)]).map(Math.round))].filter((v) => Math.abs(v - c) <= radius).sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).slice(0, 26)
  const xs = near(slotAxis(t, 'x', g), wx)
  const ys = near(slotAxis(t, 'y', g), wy)
  let best: { x: number; y: number; d: number } | null = null
  for (const x of xs) for (const y of ys) if (spotState(t, x, y, g).ok) { const d = Math.hypot(x - wx, y - wy); if (!best || d < best.d) best = { x, y, d } }
  return best
}
/** Anywhere in the zone: the valid position nearest to (wx, wy), used when nothing close is free. Tries the 10 cm grid nearest-first, so it stops at the first fit. */
export function gridSlot(t: FTable, wx: number, wy: number, g: Geo) {
  const cand: [number, number, number][] = []
  for (let y = 0; y <= g.rh - t.h; y += 10) for (let x = 0; x <= g.rw - t.w; x += 10) cand.push([x, y, Math.hypot(x - wx, y - wy)])
  cand.sort((a, b) => a[2] - b[2])
  for (const [x, y, d] of cand) if (spotState(t, x, y, g).ok) return { x, y, d }
  return null
}

/* ───────────────────────── the room outline ───────────────────────── */

/** Moves the room so it starts at the margin, and sizes the zone's canvas to hold the room and anything still outside it. Pure: returns new copies. */
export function fitRoom(f: Floor, zid: string): Floor {
  const z = f.zones.find((x) => x.id === zid)
  if (!z?.pts?.length) return f
  const xs = z.pts.map((p) => p[0])
  const ys = z.pts.map((p) => p[1])
  const dx = ROOM_M - Math.min(...xs)
  const dy = ROOM_M - Math.min(...ys)
  const pts = z.pts.map(([x, y]) => [x + dx, y + dy])
  const tables = f.tables.map((t) => (t.z === zid ? { ...t, x: Math.max(0, t.x + dx), y: Math.max(0, t.y + dy) } : t))
  const decor = f.decor.map((d) => (d.z === zid ? { ...d, x: Math.max(0, d.x + dx), y: Math.max(0, d.y + dy) } : d))
  let mx = Math.max(...pts.map((p) => p[0])) + ROOM_M
  let my = Math.max(...pts.map((p) => p[1])) + ROOM_M
  for (const t of tables) if (t.z === zid) { mx = Math.max(mx, t.x + t.w + 20); my = Math.max(my, t.y + t.h + 20) }
  for (const d of decor) if (d.z === zid && d.w) { mx = Math.max(mx, d.x + d.w + 20); my = Math.max(my, d.y + (d.h ?? 18) + 20) }
  return { ...f, zones: f.zones.map((x) => (x.id === zid ? { ...x, pts, rw: Math.round(mx), rh: Math.round(my) } : x)), tables, decor }
}
/** A rectangular room of w × d cm. */
export const rectRoom = (w: number, d: number): number[][] => [[ROOM_M, ROOM_M], [ROOM_M + w, ROOM_M], [ROOM_M + w, ROOM_M + d], [ROOM_M, ROOM_M + d]]
/** Closes a drawn outline: the last side closes square, repeated and in-line corners go. Returns the corners, or why it cannot be a room. */
export function closeShape(raw: number[][]): number[][] | string {
  let pts = raw.map((p) => [...p])
  if (pts.length < 3) return 'Click at least three corners, then close the shape.'
  const a = pts[pts.length - 1]
  const f = pts[0]
  if (a[0] !== f[0] && a[1] !== f[1]) {
    const prevH = a[1] === pts[pts.length - 2][1]
    pts.push(prevH ? [a[0], f[1]] : [f[0], a[1]])
  }
  const src = pts
  pts = src.filter((p, i) => {
    const q = src[(i + src.length - 1) % src.length]
    const r = src[(i + 1) % src.length]
    return !(p[0] === q[0] && p[1] === q[1]) && (p[0] - q[0]) * (r[1] - p[1]) !== (p[1] - q[1]) * (r[0] - p[0])
  })
  if (pts.length < 3 || polyArea(pts) < 20000) return 'That room is too small. Click the corners again.'
  return pts
}
/** A side gets a new length: its end corner slides along it, and so does the next corner when the side after it is square to this one (the room stays square). */
export function setEdgeLength(pts: number[][], i: number, c: number): number[][] {
  const p = pts.map((q) => [...q])
  const n = p.length
  const a = p[i]
  const b = p[(i + 1) % n]
  const cc = p[(i + 2) % n]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const d = c - len
  const perp = Math.abs((cc[0] - b[0]) * ux + (cc[1] - b[1]) * uy) < 1
  const mv = (q: number[]) => {
    q[0] = Math.round(q[0] + ux * d)
    q[1] = Math.round(q[1] + uy * d)
  }
  mv(b)
  if (perp) mv(cc)
  return p
}
/** Metres, or centimetres when it is 50 or more ("4,2" or "420"). */
export const parseLen = (s: string) => {
  const v = parseFloat(String(s).replace(',', '.'))
  return v > 0 ? Math.round(v >= 50 ? v : v * 100) : 0
}

/* ───────────────────────── the editor's preferences (the POS's own key) ───────────────────────── */
export interface FloorPrefs {
  gap: 60 | 90 | 120
  snap: 0 | 10 | 20
  fixed: boolean
  bays: boolean
}
const PREFS = 'cm-pos-v3-floor-prefs'
export function loadPrefs(): FloorPrefs {
  const out: FloorPrefs = { gap: 90, snap: 10, fixed: true, bays: false }
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}')
    if ([60, 90, 120].includes(p.gap)) out.gap = p.gap
    if ([0, 10, 20].includes(p.snap)) out.snap = p.snap
    if (p.fixed === false) out.fixed = false
    if (p.bays) out.bays = true
  } catch {
    /* defaults */
  }
  return out
}
export function savePrefs(p: FloorPrefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p))
  } catch {
    /* kept for this visit */
  }
}

/* ───────────────────────── arranging (the POS's "Arrange" and "Fix spacing") ───────────────────────── */

/** The free stretches of the room between y0 and y1 (inside the outline, kept `edge` from its walls). */
function spansAt(y0: number, y1: number, edge: number, poly: number[][] | null, rw: number): number[][] {
  if (!poly) return [[edge, rw - edge]]
  const sample = [y0 + 1, y1 - 1]
  poly.forEach((p) => {
    if (p[1] > y0 && p[1] < y1) sample.push(p[1] - 1, p[1] + 1)
  })
  let acc: number[][] | null = null
  for (const y of sample) {
    const xs: number[] = []
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]
      if (a[1] <= y !== b[1] <= y) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    })
    xs.sort((p, q) => p - q)
    const iv: number[][] = []
    for (let i = 0; i + 1 < xs.length; i += 2) iv.push([xs[i], xs[i + 1]])
    acc = acc ? acc.flatMap(([a0, a1]) => iv.map(([b0, b1]) => [Math.max(a0, b0), Math.min(a1, b1)]).filter(([u, v]) => v - u > 0)) : iv
    if (!acc.length) return []
  }
  return (acc ?? []).map(([a, b]) => [a + edge, b - edge]).filter(([a, b]) => b - a > 30)
}
/** The bays of a row, in order, into the free stretches: the tables of each stretch, or null when they do not fit. */
function packRow(row: FTable[], spans: number[][], g: number) {
  const out: FTable[][] = spans.map(() => [])
  const used = spans.map(() => 0)
  let s = 0
  for (const t of row) {
    const w = bayOf(t).w
    while (s < spans.length && used[s] + (out[s].length ? g : 0) + w > spans[s][1] - spans[s][0]) s++
    if (s >= spans.length) return null
    used[s] += (out[s].length ? g : 0) + w
    out[s].push(t)
  }
  return { out, used }
}
function flowRows(order: FTable[], brk: Set<string>, honour: boolean, y0: number, bottom: number, g: number, edge: number, poly: number[][] | null, rw: number) {
  const put: { id: string; x: number; y: number }[] = []
  let y = y0
  let i = 0
  let rows = 0
  while (i < order.length) {
    let row: FTable[] = []
    let h = 0
    let pk: { out: FTable[][]; used: number[] } | null = null
    let sp: number[][] | null = null
    while (i < order.length) {
      const t = order[i]
      if (row.length && honour && brk.has(t.id)) break
      const nh = Math.max(h, bayOf(t).h)
      if (y + nh > bottom) break
      const s2 = spansAt(y, y + nh, edge, poly, rw)
      const trial = row.concat([t])
      const pk2 = s2.length ? packRow(trial, s2, g) : null
      if (!pk2) break
      row = trial
      h = nh
      pk = pk2
      sp = s2
      i++
    }
    if (!row.length || !pk || !sp) {
      if (y + 20 > bottom) break
      y += 20
      continue
    }
    const packed = pk
    sp.forEach(([a, b], si) => {
      const list = packed.out[si]
      if (!list.length) return
      let x = a + Math.round((b - a - packed.used[si]) / 2)
      list.forEach((t) => {
        const bb = bayOf(t)
        const [l, u] = seatEdges(t)
        put.push({ id: t.id, x: Math.round(x + l), y: Math.round(y + (h - bb.h) / 2 + u) })
        x += bb.w + g
      })
    })
    y += h + g
    rows++
  }
  return { put, left: order.slice(i), rows, usedH: y - g - y0 }
}
/** Arranges every table of a zone in rows, in reading order, with the walkway and room for the chairs. Tables that do not fit wait below the room;
 *  with no room drawn the zone grows downwards (up to 15 m) until they fit. */
export function arrangeTables(f: Floor, zid: string, gap: number) {
  const z = f.zones.find((x) => x.id === zid)
  const zt = f.tables.filter((t) => t.z === zid)
  if (!z || !zt.length) return { floor: f, placed: 0, left: 0, rows: 0, grown: 0, total: zt.length }
  const poly = z.pts && z.pts.length >= 3 ? z.pts : null
  const rw = z.rw ?? ROOM.w
  let rh = z.rh ?? ROOM.h
  const edge = Math.round(gap / 2) + (poly ? 0 : 20)
  const top0 = (poly ? Math.min(...poly.map((p) => p[1])) : 0) + edge
  let bottom = (poly ? Math.max(...poly.map((p) => p[1])) : rh) - edge
  const byY = [...zt].sort((p, q) => p.y - q.y || p.x - q.x)
  const bands: { y: number; items: FTable[] }[] = []
  for (const t of byY) {
    const b = bands.find((r) => Math.abs(r.y - t.y) < 60)
    if (b) {
      b.items.push(t)
      b.y = b.items.reduce((n, o) => n + o.y, 0) / b.items.length
    } else bands.push({ y: t.y, items: [t] })
  }
  bands.sort((p, q) => p.y - q.y)
  const order: FTable[] = []
  const brk = new Set<string>()
  bands.forEach((b) =>
    b.items
      .sort((p, q) => p.x - q.x)
      .forEach((t, i) => {
        if (!i) brk.add(t.id)
        order.push(t)
      }),
  )
  const attempt = (honour: boolean) => {
    const a = flowRows(order, brk, honour, top0, bottom, gap, edge, poly, rw)
    if (a.left.length) return a
    const shift = Math.floor((bottom - top0 - a.usedH) / 2)
    const b = shift > 0 ? flowRows(order, brk, honour, top0 + shift, bottom, gap, edge, poly, rw) : a
    return b.left.length ? a : b
  }
  const best = () => {
    let res = attempt(true)
    if (res.left.length) {
      const r2 = attempt(false)
      if (r2.left.length < res.left.length) res = r2
    }
    return res
  }
  let res = best()
  let grown = 0
  while (res.left.length && !poly && rh < 1500) {
    rh += 120
    bottom = rh - edge
    grown++
    res = best()
  }
  const pos = new Map(res.put.map((p) => [p.id, p]))
  // tables that do not fit wait below the room, outside it, so they never sit on top of the others
  if (res.left.length && poly) {
    let x = 40
    let y = Math.max(...poly.map((p) => p[1])) + 70
    let rowH = 0
    for (const t of res.left) {
      if (x + t.w > rw - 40 && x > 40) {
        x = 40
        y += rowH + 30
        rowH = 0
      }
      pos.set(t.id, { id: t.id, x: Math.max(0, Math.min(x, rw - t.w)), y })
      x += t.w + 30
      rowH = Math.max(rowH, t.h)
    }
  }
  let floor: Floor = {
    ...f,
    zones: f.zones.map((x) => (x.id === zid && !poly && grown ? { ...x, rh } : x)),
    tables: f.tables.map((t) => {
      const p = pos.get(t.id)
      if (!p || t.z !== zid) return t
      const inRoom = res.put.some((q) => q.id === t.id)
      return { ...t, x: inRoom ? clampV(p.x, 0, rw - t.w) : p.x, y: inRoom ? clampV(p.y, 0, rh - t.h) : p.y }
    }),
  }
  if (poly) floor = fitRoom(floor, zid)
  return { floor, placed: res.put.length, left: res.left.length, rows: res.rows, grown, total: zt.length }
}
const clampV = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
