/**
 * The floor plan editor, the same as the POS's: draw the room with the pencil (real lengths), give every table the space it needs
 * (its chairs, the walkway between tables, room from the walls and counters), and tables click into a right spot when dropped (hold Alt to place freely).
 * It edits a copy; "Save floor plan" writes the layout where the POS reads it (see floor.ts), so the till opens with it.
 */
import { ArrowClockwise, ArrowCounterClockwise, Copy, MagnetStraight, PencilSimple, Trash } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Btn, Pill, Seg, useSay } from './kit'
import {
  arrangeTables,
  bayOf,
  bestSlot,
  clone,
  closeShape,
  dimsOf,
  fitRoom,
  fmtLen,
  gridSlot,
  loadPrefs,
  parseLen,
  polyArea,
  rectRoom,
  ROOM,
  saveFloor,
  savePrefs,
  seatEdges,
  setEdgeLength,
  sizeOf,
  SNAPR,
  spotState,
  standardFloor,
  useFloor,
  type Box,
  type FDecor,
  type Floor,
  type FloorPrefs,
  type FTable,
  type Geo,
  type Spot,
} from './floor'

interface Piece {
  k: string
  name: string
  sub: string
  w: number
  h: number
  seats?: number
  round?: boolean
  /** The letter its number starts with, when it is not the zone's own (stools are S1, S2…). */
  pre?: string
  decor?: 'wall' | 'lbl'
}

/** The pieces of the POS palette. A table's size is its real size in cm. */
const PIECES: Piece[] = [
  { k: 'r2', name: 'Round table', sub: '2 seats', w: 80, h: 80, seats: 2, round: true },
  { k: 'r4', name: 'Round table', sub: '4 seats', w: 110, h: 110, seats: 4, round: true },
  { k: 's4', name: 'Rectangular table', sub: '4 seats', w: 140, h: 80, seats: 4 },
  { k: 'l6', name: 'Long table', sub: '6 seats', w: 200, h: 80, seats: 6 },
  { k: 'l8', name: 'Banquet', sub: '8 seats', w: 260, h: 90, seats: 8 },
  { k: 'st', name: 'Bar stool', sub: '1 seat', w: 84, h: 84, seats: 1, round: true, pre: 'S' },
  { k: 'wall', name: 'Wall', sub: 'Divider, window', w: 300, h: 10, decor: 'wall' },
  { k: 'ctr', name: 'Counter', sub: 'Bar, pass', w: 500, h: 44, decor: 'wall' },
  { k: 'lbl', name: 'Label', sub: 'Kitchen, door…', w: 120, h: 18, decor: 'lbl' },
]

type Sel = { k: 't'; id: string } | { k: 'd'; i: number } | null
interface Drag {
  s: NonNullable<Sel>
  sx: number
  sy: number
  ox: number
  oy: number
  w: number
  h: number
  k: number
  moved: boolean
  before: string
  x: number
  y: number
}
interface Pen {
  pts: number[][]
  cur: number[] | null
  closing: boolean
}

/** The pencil's drawing area, in cm (26 × 15 m), with a metre grid. */
const PEN = { w: 2600, h: 1500 }
const LABEL = { w: 120, h: 18 }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rectOf = (t: FTable): Box => ({ x: t.x, y: t.y, w: t.w, h: t.h })
const wallsOf = (f: Floor, zid: string): Box[] => f.decor.filter((d) => d.z === zid && d.k === 'wall').map((d) => ({ x: d.x, y: d.y, w: d.w ?? 0, h: d.h ?? 0 }))

/** How many things differ between two layouts (tables added, removed, moved or changed; walls and labels; zones and rooms). */
function countChanges(a: Floor, b: Floor) {
  const A = new Map(a.tables.map((t) => [t.id, JSON.stringify(t)]))
  const B = new Map(b.tables.map((t) => [t.id, JSON.stringify(t)]))
  let n = 0
  for (const [id, v] of B) if (A.get(id) !== v) n++
  for (const id of A.keys()) if (!B.has(id)) n++
  const da = a.decor.map((d) => JSON.stringify(d))
  const db = b.decor.map((d) => JSON.stringify(d))
  n += db.filter((d) => !da.includes(d)).length + da.filter((d) => !db.includes(d)).length
  const za = new Map(a.zones.map((z) => [z.id, JSON.stringify(z)]))
  for (const z of b.zones) if (za.get(z.id) !== JSON.stringify(z)) n++
  for (const id of za.keys()) if (!b.zones.some((z) => z.id === id)) n++
  return n
}

/** The chairs of a table, in cm on the room: rectangles seat along the top and the bottom, round tables all round (as the POS draws them). */
function chairsOf(t: FTable) {
  const out: { x: number; y: number; a: number }[] = []
  const n = t.seats
  if (t.round) {
    const r = t.w / 2 + 10
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      out.push({ x: t.x + t.w / 2 + Math.cos(a) * r, y: t.y + t.h / 2 + Math.sin(a) * r, a: (a * 180) / Math.PI + 90 })
    }
  } else {
    const per = Math.ceil(n / 2)
    for (let i = 0; i < per; i++) {
      const x = t.x + (t.w / (per + 1)) * (i + 1)
      out.push({ x, y: t.y - 9, a: 0 })
      if (out.length < n) out.push({ x, y: t.y + t.h + 9, a: 0 })
    }
  }
  return out
}

/** The POS's "Fix spacing": only the tables that are too close, outside the room or touching move, each to the nearest spot with room, one after the other. */
function fixZone(f: Floor, zid: string, prefs: FloorPrefs): { floor: Floor; moved: number; stuck: number } {
  const z = f.zones.find((x) => x.id === zid)
  if (!z) return { floor: f, moved: 0, stuck: 0 }
  const geoFor = (fl: Floor): Geo => ({ tables: fl.tables.filter((t) => t.z === zid), walls: wallsOf(fl, zid), poly: z.pts && z.pts.length >= 3 ? z.pts : null, rw: z.rw ?? ROOM.w, rh: z.rh ?? ROOM.h, gap: prefs.gap, snap: prefs.snap })
  let floor = f
  let moved = 0
  let stuck = 0
  const bad = f.tables.filter((t) => t.z === zid && !spotState(t, t.x, t.y, geoFor(f)).ok).map((t) => t.id)
  for (const id of bad) {
    const g = geoFor(floor)
    const t = g.tables.find((x) => x.id === id)!
    const s = bestSlot(t, t.x, t.y, 700, g) ?? gridSlot(t, t.x, t.y, g)
    if (!s) {
      stuck++
      continue
    }
    moved++
    floor = { ...floor, tables: floor.tables.map((x) => (x.id === id ? { ...x, x: s.x, y: s.y } : x)) }
  }
  return { floor, moved, stuck }
}

/* ───────────────────────── small fields ───────────────────────── */

/** A text field that applies on Enter or when you leave it, so one edit is one step in the undo list. Give it a `key` that changes with the value. */
function Txt({ value, onCommit, label, max = 20, className, placeholder }: { value: string; onCommit: (v: string) => void; label: string; max?: number; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  const done = () => {
    const t = v.trim()
    if (t && t !== value) onCommit(t)
    else setV(value)
  }
  return <input className={`bo-fe-in ${className ?? ''}`} value={v} maxLength={max} spellCheck={false} aria-label={label} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
}

function Num({ value, onCommit, label, min = 30, max = 600 }: { value: number; onCommit: (v: number) => void; label: string; min?: number; max?: number }) {
  const [v, setV] = useState(String(value))
  const done = () => {
    const n = clamp(Math.round(Number(v)), min, max)
    if (Number.isFinite(n) && n !== value) onCommit(n)
    else setV(String(value))
  }
  return (
    <span className="bo-fe-cm">
      <input className="bo-fe-in num" type="number" inputMode="numeric" min={min} max={max} step={5} value={v} aria-label={`${label} in centimetres`} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      <i>cm</i>
    </span>
  )
}

function Step({ value, onChange, label, min = 1, max = 20, by = 1 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; by?: number }) {
  return (
    <span className="bo-fe-stp">
      <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - by, min, max))}>
        −
      </button>
      <b>{value}</b>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + by, min, max))}>
        +
      </button>
    </span>
  )
}

/** The room's width × depth, in metres; applies when both are filled in. */
function RoomSize({ w, d, onCommit }: { w: string; d: string; onCommit: (w: number, d: number) => void }) {
  const [a, setA] = useState(w)
  const [b, setB] = useState(d)
  const done = () => {
    const wc = parseLen(a)
    const dc = parseLen(b)
    if (wc && dc && (a !== w || b !== d)) onCommit(wc, dc)
  }
  const key = (e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && done()
  return (
    <span className="bo-fe-dims">
      <input className="bo-fe-in num" inputMode="decimal" placeholder="8,40" value={a} aria-label="Room width in metres" onChange={(e) => setA(e.target.value)} onBlur={done} onKeyDown={key} />
      <em>×</em>
      <input className="bo-fe-in num" inputMode="decimal" placeholder="6,00" value={b} aria-label="Room depth in metres" onChange={(e) => setB(e.target.value)} onBlur={done} onKeyDown={key} />
      <i>m</i>
    </span>
  )
}

/* ───────────────────────── the editor ───────────────────────── */

export function FloorEditor() {
  const saved = useFloor()
  const say = useSay()
  const [draft, setDraft] = useState<Floor>(() => clone(saved))
  const [zone, setZone] = useState(() => saved.zones[0]?.id ?? 'main')
  const [sel, setSel] = useState<Sel>(null)
  const [hist, setHist] = useState<string[]>([])
  const [prefs, setPrefs] = useState<FloorPrefs>(loadPrefs)
  const [pen, setPen] = useState<Pen | null>(null)
  const [penLen, setPenLen] = useState('')
  const [edge, setEdge] = useState<{ i: number; v: string } | null>(null)
  const room = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])
  const z = draft.zones.find((x) => x.id === zone) ?? draft.zones[0]
  const zt = draft.tables.filter((t) => t.z === z.id)
  const poly = z.pts && z.pts.length >= 3 ? z.pts : null
  const RW = pen ? PEN.w : (z.rw ?? ROOM.w)
  const RH = pen ? PEN.h : (z.rh ?? ROOM.h)
  const geo: Geo = { tables: zt, walls: wallsOf(draft, z.id), poly, rw: RW, rh: RH, gap: prefs.gap, snap: prefs.snap }
  const states = new Map<string, Spot>(zt.map((t) => [t.id, spotState(t, t.x, t.y, geo)]))
  const problems = zt.filter((t) => !states.get(t.id)!.ok).length
  const selT = sel?.k === 't' ? draft.tables.find((t) => t.id === sel.id) : undefined
  const selD = sel?.k === 'd' ? draft.decor[sel.i] : undefined
  const snapTo = (v: number) => (prefs.snap ? Math.round(v / prefs.snap) * prefs.snap : Math.round(v))
  const setPref = (patch: Partial<FloorPrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    savePrefs(next)
  }

  /* history */
  const commit = (next: Floor) => {
    setHist((h) => [...h.slice(-79), JSON.stringify(draft)])
    setDraft(next)
  }
  const undo = () => {
    const last = hist[hist.length - 1]
    if (!last) return
    const prev: Floor = JSON.parse(last)
    setDraft(prev)
    setHist(hist.slice(0, -1))
    setSel(null)
    if (!prev.zones.some((x) => x.id === zone)) setZone(prev.zones[0].id)
  }
  const cancel = () => {
    setDraft(clone(saved))
    setHist([])
    setSel(null)
    setPen(null)
    if (!saved.zones.some((x) => x.id === zone)) setZone(saved.zones[0].id)
  }
  const save = () => {
    const n = countChanges(saved, draft)
    saveFloor(draft)
    setHist([])
    say(`Floor plan saved: ${n} ${n === 1 ? 'change' : 'changes'}. The POS opens with it.`)
  }

  /* edits */
  const patchTable = (id: string, patch: Partial<FTable>) => commit({ ...draft, tables: draft.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  /** A size typed by hand is a real size: the POS's own "drawn size" no longer applies. */
  const resize = (id: string, patch: Partial<FTable>) => patchTable(id, { ...patch, cm: undefined, px0: undefined })
  const patchDecor = (i: number, patch: Partial<FDecor>) => commit({ ...draft, decor: draft.decor.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  const nextId = (pre: string) => {
    const nums = draft.tables.map((t) => (t.id.startsWith(pre) ? Number(t.id.slice(pre.length)) : NaN)).filter(Number.isFinite)
    return `${pre}${(nums.length ? Math.max(...nums) : 0) + 1}`
  }
  const addPiece = (p: Piece) => {
    setPen(null)
    const ox = poly ? Math.min(...poly.map((q) => q[0])) : 0
    const oy = poly ? Math.min(...poly.map((q) => q[1])) : 0
    if (p.decor) {
      const d: FDecor = p.decor === 'lbl' ? { z: z.id, k: 'lbl', x: ox + 80, y: oy + 80, text: 'Label' } : { z: z.id, k: 'wall', x: ox + 80, y: oy + 300, w: p.w, h: p.h }
      commit({ ...draft, decor: [...draft.decor, d] })
      setSel({ k: 'd', i: draft.decor.length })
      return
    }
    const id = nextId(p.pre ?? z.pre)
    const t: FTable = { id, z: z.id, x: 0, y: 0, w: p.w, h: p.round ? p.w : p.h, seats: p.seats ?? 2, round: !!p.round }
    const s = gridSlot(t, ox, oy, geo)
    commit({ ...draft, tables: [...draft.tables, { ...t, x: s?.x ?? (RW - t.w) / 2, y: s?.y ?? (RH - t.h) / 2 }] })
    setSel({ k: 't', id })
    if (!s) say(`${id} added, but there is no free spot left: make the room bigger or the walkway narrower.`)
  }
  const duplicate = () => {
    if (selT) {
      const id = nextId(selT.id.replace(/\d+$/, '') || z.pre)
      const copy = { ...selT, id }
      const s = bestSlot(copy, selT.x + 30, selT.y + 30, 400, geo) ?? gridSlot(copy, selT.x, selT.y, geo)
      commit({ ...draft, tables: [...draft.tables, { ...copy, x: s?.x ?? clamp(selT.x + 30, 0, RW - selT.w), y: s?.y ?? clamp(selT.y + 30, 0, RH - selT.h) }] })
      setSel({ k: 't', id })
    } else if (selD) {
      commit({ ...draft, decor: [...draft.decor, { ...selD, x: selD.x + 30, y: selD.y + 30 }] })
      setSel({ k: 'd', i: draft.decor.length })
    }
  }
  const remove = () => {
    if (selT) commit({ ...draft, tables: draft.tables.filter((t) => t.id !== selT.id) })
    else if (sel?.k === 'd') commit({ ...draft, decor: draft.decor.filter((_, i) => i !== sel.i) })
    setSel(null)
  }
  const rotate = () => {
    if (selT && !selT.round) resize(selT.id, { w: selT.h, h: selT.w })
    else if (selD?.k === 'wall' && sel?.k === 'd') patchDecor(sel.i, { w: selD.h, h: selD.w })
  }
  const moveToRightSpot = (t: FTable) => {
    const s = bestSlot(t, t.x, t.y, 400, geo) ?? gridSlot(t, t.x, t.y, geo)
    if (!s) return say('No free spot for this table: make the room bigger, the walkway narrower, or remove a table.')
    patchTable(t.id, { x: s.x, y: s.y })
  }
  const arrange = () => {
    const r = arrangeTables(draft, z.id, prefs.gap)
    if (!r.total) return say('No tables in this zone yet.')
    commit(r.floor)
    say(
      r.left
        ? `${r.placed} of ${r.total} tables placed with ${prefs.gap} cm walkways. ${r.left} do not fit: make the room bigger, use a tighter walkway or remove some tables.`
        : `${r.total} tables arranged in ${r.rows} ${r.rows === 1 ? 'row' : 'rows'}, ${prefs.gap} cm walkways and room for the chairs${r.grown ? ' (the zone grew to fit them)' : ''}.`,
    )
  }
  const fixSpacing = () => {
    const r = fixZone(draft, z.id, prefs)
    if (!r.moved && !r.stuck) return say('Every table already has room to walk.')
    if (r.moved) commit(r.floor)
    say(r.stuck ? `${r.moved} ${r.moved === 1 ? 'table' : 'tables'} moved. ${r.stuck} still ${r.stuck === 1 ? 'has' : 'have'} no spot: the room is too small.` : `${r.moved} ${r.moved === 1 ? 'table' : 'tables'} moved to a spot with room to walk.`)
  }
  const addZone = () => {
    const n = draft.zones.length + 1
    const id = `zone${Date.now() % 100000}`
    commit({ ...draft, zones: [...draft.zones, { id, name: `Zone ${n}`, pre: 'Z' }] })
    setZone(id)
    setSel(null)
    setPen(null)
  }
  const removeZone = () => {
    if (draft.zones.length < 2 || zt.length) return
    const rest = draft.zones.filter((x) => x.id !== z.id)
    commit({ ...draft, zones: rest, decor: draft.decor.filter((d) => d.z !== z.id) })
    setZone(rest[0].id)
    setSel(null)
  }
  const rename = (t: FTable, name: string) => {
    if (draft.tables.some((x) => x.id === name && x !== t)) return say(`${name} is already a table. Pick another name.`)
    commit({ ...draft, tables: draft.tables.map((x) => (x === t ? { ...x, id: name } : x)) })
    setSel({ k: 't', id: name })
  }

  /* the room */
  const withRoom = (pts: number[][], what: string) => {
    let next = fitRoom({ ...draft, zones: draft.zones.map((x) => (x.id === z.id ? { ...x, pts } : x)) }, z.id)
    const nz = next.zones.find((x) => x.id === z.id)!
    const g: Geo = { tables: next.tables.filter((t) => t.z === z.id), walls: wallsOf(next, z.id), poly: nz.pts!, rw: nz.rw ?? ROOM.w, rh: nz.rh ?? ROOM.h, gap: prefs.gap, snap: prefs.snap }
    const out = g.tables.filter((t) => !spotState(t, t.x, t.y, g).ok).length
    const r = out ? arrangeTables(next, z.id, prefs.gap) : null
    if (r) next = r.floor
    commit(next)
    const area = (polyArea(next.zones.find((x) => x.id === z.id)!.pts!) / 1e4).toFixed(1).replace('.', ',')
    say(`${what}: ${area} m².${r ? (r.left ? ` The tables were arranged inside it; ${r.left} do not fit and wait below the room.` : ' The tables were arranged inside it.') : ''}`)
  }
  const clearRoom = () => {
    commit({ ...draft, zones: draft.zones.map((x) => (x.id === z.id ? { id: x.id, name: x.name, pre: x.pre } : x)) })
    say('Room cleared: the zone is the standard 17,2 × 6,6 m again.')
  }
  const rect = !!poly && poly.length === 4 && poly.every((p, i) => { const q = poly[(i + 1) % 4]; return p[0] === q[0] || p[1] === q[1] })
  const mTxt = (v: number) => (v / 100).toFixed(2).replace(/0$/, '').replace('.', ',')
  const roomW = rect ? mTxt(Math.max(...poly!.map((p) => p[0])) - Math.min(...poly!.map((p) => p[0]))) : ''
  const roomD = rect ? mTxt(Math.max(...poly!.map((p) => p[1])) - Math.min(...poly!.map((p) => p[1]))) : ''

  /* the pencil */
  const roomPt = (e: PointerEvent<HTMLElement>) => {
    const r = room.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * RW, y: ((e.clientY - r.top) / r.height) * RH, k: r.width / RW }
  }
  const penPoint = (e: PointerEvent<HTMLElement>, p: Pen): { pt: number[]; closing: boolean } => {
    const q = roomPt(e)
    const last = p.pts[p.pts.length - 1]
    const first = p.pts[0]
    let x = Math.round(q.x / 5) * 5
    let y = Math.round(q.y / 5) * 5
    if (last && !e.shiftKey) {
      if (Math.abs(x - last[0]) >= Math.abs(y - last[1])) y = last[1]
      else x = last[0]
    }
    x = clamp(x, 0, PEN.w)
    y = clamp(y, 0, PEN.h)
    const closing = !!(first && p.pts.length >= 3 && Math.hypot(q.x - first[0], q.y - first[1]) < 24 / q.k)
    return closing ? { pt: [first[0], first[1]], closing } : { pt: [x, y], closing }
  }
  const startPen = () => {
    setSel(null)
    setEdge(null)
    setPen({ pts: [], cur: null, closing: false })
    setPenLen('')
  }
  const closePen = (pts: number[][]) => {
    const res = closeShape(pts)
    if (typeof res === 'string') return say(res)
    setPen(null)
    withRoom(res, 'Room drawn')
  }
  const penLength = () => {
    if (!pen) return
    const c = parseLen(penLen)
    if (!c) return say('Type a length in metres, for example 4,20.')
    const last = pen.pts[pen.pts.length - 1]
    if (!last) return say('Click the first corner on the plan, then type the length of each side.')
    let dx = 1
    let dy = 0
    if (pen.cur) {
      const ex = pen.cur[0] - last[0]
      const ey = pen.cur[1] - last[1]
      const m = Math.hypot(ex, ey)
      if (m > 1) {
        dx = ex / m
        dy = ey / m
      }
    }
    setPen({ ...pen, pts: [...pen.pts, [clamp(Math.round(last[0] + dx * c), 0, PEN.w), clamp(Math.round(last[1] + dy * c), 0, PEN.h)]] })
    setPenLen('')
  }

  /* drag */
  const startDrag = (e: PointerEvent<HTMLElement>, s: NonNullable<Sel>, r: Box) => {
    if (pen) return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* the pointer is gone (a touch ended); the drag simply does not start */
    }
    setSel(s)
    setEdge(null)
    drag.current = { s, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, w: r.w, h: r.h, k: room.current!.getBoundingClientRect().width / RW, moved: false, before: JSON.stringify(draft), x: r.x, y: r.y }
  }
  const moveDrag = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / d.k
    const dy = (e.clientY - d.sy) / d.k
    if (!d.moved && Math.hypot(dx, dy) * d.k < 3) return
    d.moved = true
    const x = clamp(snapTo(d.ox + dx), 0, RW - d.w)
    const y = clamp(snapTo(d.oy + dy), 0, RH - d.h)
    d.x = x
    d.y = y
    const s = d.s
    setDraft((cur) => (s.k === 't' ? { ...cur, tables: cur.tables.map((t) => (t.id === s.id ? { ...t, x, y } : t)) } : { ...cur, decor: cur.decor.map((o, i) => (i === s.i ? { ...o, x, y } : o)) }))
  }
  const endDrag = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    setHist((h) => [...h.slice(-79), d.before])
    // a dropped table clicks into the nearest right spot (Alt places it freely)
    if (d.s.k === 't' && prefs.fixed && !e.altKey) {
      const id = d.s.id
      const t = draft.tables.find((x) => x.id === id)
      if (!t) return
      const at = { ...t, x: d.x, y: d.y }
      const g: Geo = { ...geo, tables: zt.map((x) => (x.id === id ? at : x)) }
      const s = bestSlot(at, d.x, d.y, SNAPR, g)
      if (s && (s.x !== d.x || s.y !== d.y)) setDraft((cur) => ({ ...cur, tables: cur.tables.map((x) => (x.id === id ? { ...x, x: s.x, y: s.y } : x)) }))
    }
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault()
      undo()
    } else if (typing) return
    else if (e.key === 'Escape') {
      if (pen) setPen(null)
      setSel(null)
      setEdge(null)
    } else if (pen && e.key === 'Enter') closePen(pen.pts)
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
      e.preventDefault()
      remove()
    } else if (e.key.startsWith('Arrow') && sel) {
      e.preventDefault()
      const step = (prefs.snap || 10) * (e.shiftKey ? 5 : 1)
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      if (selT) patchTable(selT.id, { x: clamp(selT.x + dx, 0, RW - selT.w), y: clamp(selT.y + dy, 0, RH - selT.h) })
      else if (selD && sel.k === 'd') patchDecor(sel.i, { x: clamp(selD.x + dx, 0, RW - (selD.w ?? LABEL.w)), y: clamp(selD.y + dy, 0, RH - (selD.h ?? LABEL.h)) })
    }
  }

  const px = (v: number) => `${(v / RW) * 100}%`
  const py = (v: number) => `${(v / RH) * 100}%`
  const seatsIn = zt.reduce((n, t) => n + t.seats, 0)
  const statusText = (st: Spot) => (st.ok ? 'Room to walk all round' : st.out ? 'Outside the room' : st.clash ? 'Touching another table or a wall' : `Closer than ${prefs.gap} cm to a neighbour`)
  const seatText = (t: FTable) => {
    const se = seatEdges(t)
    return se.some(Boolean) ? `${Math.max(...se)} cm of chairs on ${se[0] && se[1] ? 'every side' : se[1] && se[3] ? 'two sides' : 'one side'}` : 'no chairs'
  }
  const penAll = pen ? (pen.cur ? [...pen.pts, pen.cur] : pen.pts) : []

  return (
    <div className="bo-fe" onKeyDown={onKey}>
      <div className="bo-fe-bar">
        <div className="bo-fe-zones" role="tablist" aria-label="Zones">
          {draft.zones.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === z.id} className={x.id === z.id ? 'on' : ''} onClick={() => (setZone(x.id), setSel(null), setPen(null), setEdge(null))}>
              {x.name}
              <em>{draft.tables.filter((t) => t.z === x.id).length}</em>
            </button>
          ))}
          <button type="button" className="add" onClick={addZone}>
            + Zone
          </button>
        </div>
        <div className="bo-fe-act">
          {problems > 0 && !pen && (
            <Pill tone="warn">
              {problems} {problems === 1 ? 'table needs' : 'tables need'} room
            </Pill>
          )}
          {dirty && <Pill tone="draft">Unsaved changes</Pill>}
          <Btn small onClick={undo} disabled={!hist.length}>
            <ArrowCounterClockwise size={16} /> Undo
          </Btn>
          <Btn small onClick={cancel} disabled={!dirty}>
            Cancel
          </Btn>
          <Btn small primary onClick={save} disabled={!dirty || !!pen}>
            Save floor plan
          </Btn>
        </div>
      </div>

      <div className="bo-fe-pal" role="group" aria-label="Add to the plan">
        <span className="bo-fe-cap">Room</span>
        <button type="button" className={`bo-fe-item${pen ? ' on' : ''}`} onClick={() => (pen ? setPen(null) : startPen())} title="Draw the room with real lengths">
          <span className="shp">
            <PencilSimple size={22} />
          </span>
          <span>
            <b>Draw the room</b>
            <small>Pencil · real lengths</small>
          </span>
        </button>
        <span className="bo-fe-cap">Add</span>
        {PIECES.map((p) => (
          <button key={p.k} type="button" className="bo-fe-item" onClick={() => addPiece(p)} title={`Add: ${p.name}`}>
            <span className="shp">{p.decor === 'lbl' ? <small>ABC</small> : <i className={p.round ? 'round' : ''} style={{ width: Math.min(34, p.w * 0.2), height: p.round ? Math.min(34, p.w * 0.2) : Math.max(5, Math.min(24, p.h * 0.2)) }} />}</span>
            <span>
              <b>{p.name}</b>
              <small>{p.decor ? p.sub : `${p.sub} · ${p.round ? `Ø ${p.w}` : `${p.w}×${p.h}`} cm`}</small>
            </span>
          </button>
        ))}
      </div>

      {pen && (
        <div className="bo-fe-penbar" role="status">
          <span>
            <PencilSimple size={16} /> <b>Drawing the room</b> · click each corner, or type the length of the next side and press Enter. Shift draws at any angle.
          </span>
          <span className="bo-fe-cm">
            <input className="bo-fe-in num" inputMode="decimal" placeholder="4,20" value={penLen} aria-label="Length of the next side, in metres" onChange={(e) => setPenLen(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.stopPropagation(), penLength())} />
            <i>m</i>
          </span>
          <Btn small primary onClick={() => closePen(pen.pts)} disabled={pen.pts.length < 3}>
            Close the shape
          </Btn>
          <Btn small onClick={() => setPen(null)}>
            Cancel
          </Btn>
        </div>
      )}

      <div className="bo-fe-main">
        <div>
          <div
            className={`bo-fe-room${pen ? ' pen' : ''}${poly && !pen ? ' has-room' : ''}`}
            ref={room}
            tabIndex={0}
            aria-label={`${z.name}, drawn to scale`}
            style={{ aspectRatio: `${RW} / ${RH}`, backgroundSize: `${(100 / RW) * 100}% ${(100 / RH) * 100}%` }}
            onPointerDown={(e) => {
              if (pen) {
                const r = penPoint(e, pen)
                if (r.closing) closePen(pen.pts)
                else setPen({ ...pen, pts: [...pen.pts, r.pt], cur: r.pt })
              } else if (e.target === e.currentTarget) setSel(null)
            }}
            onPointerMove={(e) => {
              if (pen) {
                const r = penPoint(e, pen)
                setPen({ ...pen, cur: r.pt, closing: r.closing })
              }
            }}
          >
            {/* the room outline, and the length of every side (tap one to type the real length) */}
            {poly && !pen && (
              <svg className="bo-fe-poly" viewBox={`0 0 ${RW} ${RH}`} preserveAspectRatio="none" aria-hidden="true">
                <polygon points={poly.map((p) => p.join(',')).join(' ')} />
              </svg>
            )}
            {poly &&
              !pen &&
              poly.map((a, i) => {
                const b = poly[(i + 1) % poly.length]
                const len = Math.hypot(b[0] - a[0], b[1] - a[1])
                if (len < 60) return null
                const mx = (a[0] + b[0]) / 2
                const my = (a[1] + b[1]) / 2
                return edge?.i === i ? (
                  <input
                    key={`e${i}`}
                    className="bo-fe-in bo-fe-edgein"
                    style={{ left: px(mx), top: py(my) }}
                    autoFocus
                    inputMode="decimal"
                    value={edge.v}
                    aria-label="Length of this side, in metres"
                    onChange={(e) => setEdge({ i, v: e.target.value })}
                    onBlur={() => setEdge(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEdge(null)
                      if (e.key !== 'Enter') return
                      const c = parseLen(edge.v)
                      if (!c) return say('Type a length in metres, for example 4,20.')
                      setEdge(null)
                      withRoom(setEdgeLength(poly, i, clamp(c, 30, 10000)), 'Side set')
                    }}
                  />
                ) : (
                  <button key={`e${i}`} type="button" className="bo-fe-edge" style={{ left: px(mx), top: py(my) }} onPointerDown={(e) => e.stopPropagation()} onClick={() => setEdge({ i, v: (len / 100).toFixed(2).replace('.', ',') })} title="Type the real length">
                    {fmtLen(len)}
                  </button>
                )
              })}

            {/* the pencil's drawing */}
            {pen && (
              <svg className="bo-fe-pen" viewBox={`0 0 ${RW} ${RH}`} preserveAspectRatio="none" aria-hidden="true">
                {penAll.length > 1 && <polyline points={penAll.map((p) => p.join(',')).join(' ')} />}
                {pen.pts.map((p, i) => (
                  <circle key={i} className={i === 0 ? 'first' : ''} cx={p[0]} cy={p[1]} r={i === 0 ? 14 : 9} />
                ))}
              </svg>
            )}
            {pen &&
              penAll.map((p, i) => {
                if (!i) return null
                const a = penAll[i - 1]
                const len = Math.hypot(p[0] - a[0], p[1] - a[1])
                return len < 40 ? null : (
                  <span key={`l${i}`} className="bo-fe-edge live" style={{ left: px((a[0] + p[0]) / 2), top: py((a[1] + p[1]) / 2) }}>
                    {fmtLen(len)}
                  </span>
                )
              })}

            {/* walls, counters, labels */}
            {draft.decor.map((d, i) =>
              d.z !== z.id ? null : d.k === 'wall' ? (
                <div key={`d${i}`} className={`bo-fe-wall${sel?.k === 'd' && sel.i === i ? ' sel' : ''}`} style={{ left: px(d.x), top: py(d.y), width: px(d.w ?? 0), height: py(d.h ?? 0) }} onPointerDown={(e) => startDrag(e, { k: 'd', i }, { x: d.x, y: d.y, w: d.w ?? 0, h: d.h ?? 0 })} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />
              ) : (
                <div key={`d${i}`} className={`bo-fe-lbl${sel?.k === 'd' && sel.i === i ? ' sel' : ''}`} style={{ left: px(d.x), top: py(d.y) }} onPointerDown={(e) => startDrag(e, { k: 'd', i }, { x: d.x, y: d.y, ...LABEL })} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                  {d.text}
                </div>
              ),
            )}

            {/* the chair zone of each table (on, or for the selected one) */}
            {!pen &&
              zt.map((t) => {
                if (!prefs.bays && selT?.id !== t.id) return null
                const b = bayOf(t)
                const st = states.get(t.id)!
                return <span key={`b${t.id}`} className={`bo-fe-bay${st.ok ? '' : ' bad'}`} style={{ left: px(b.x), top: py(b.y), width: px(b.w), height: py(b.h) }} aria-hidden="true" />
              })}
            {/* the chairs */}
            {!pen &&
              zt.flatMap((t) =>
                chairsOf(t).map((c, i) => <i key={`c${t.id}-${i}`} className="bo-fe-ch" style={{ left: px(c.x - 9), top: py(c.y - 3), width: px(18), height: py(6), transform: c.a ? `rotate(${c.a}deg)` : undefined }} aria-hidden="true" />),
              )}

            {zt.map((t) => {
              const st = states.get(t.id)!
              const cls = st.ok ? '' : st.clash ? ' clash' : st.out ? ' out' : ' tight'
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`bo-fe-t${t.round ? ' round' : ''}${selT === t ? ' sel' : ''}${cls}`}
                  style={{ left: px(t.x), top: py(t.y), width: px(t.w), height: py(t.h) }}
                  aria-label={`Table ${t.id}, ${t.seats} seats, ${dimsOf(t)}, ${statusText(st).toLowerCase()}`}
                  onPointerDown={(e) => startDrag(e, { k: 't', id: t.id }, rectOf(t))}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel({ k: 't', id: t.id }))}
                >
                  <b>{t.id}</b>
                  <small>
                    {t.seats} {t.seats === 1 ? 'seat' : 'seats'}
                  </small>
                  <small className="dm">{dimsOf(t)}</small>
                </button>
              )
            })}
          </div>
          <p className="bo-note">
            Drag a table to move it: it clicks into a spot with room for its chairs and the walkway{prefs.fixed ? '' : ' (fixed spots are off)'}. Hold Alt to place it freely. Arrow keys nudge, Delete removes, ⌘Z undoes. Saved layouts are what the POS opens with, on this device.
          </p>
        </div>

        <aside className="bo-insp bo-fe-ins" aria-label="Details">
          {selT ? (
            <>
              <small className="bo-insp-k">Selected table</small>
              <h2>{selT.id}</h2>
              <p>
                {selT.round ? 'Round' : 'Rectangular'} · {selT.seats} {selT.seats === 1 ? 'seat' : 'seats'} · {z.name}
              </p>
              <div className="bo-fe-rows">
                <div>
                  <label>Name</label>
                  <Txt key={`n-${selT.id}`} value={selT.id} max={5} label="Table name" className="short" onCommit={(v) => rename(selT, v)} />
                </div>
                <div>
                  <label>Seats</label>
                  <Step key={`s-${selT.id}-${selT.seats}`} value={selT.seats} label="seats" onChange={(v) => patchTable(selT.id, { seats: v })} />
                </div>
                <div>
                  <label>Shape</label>
                  <Seg options={['Round', 'Square'] as const} value={selT.round ? 'Round' : 'Square'} label="Shape" onChange={(v) => resize(selT.id, v === 'Round' ? { round: true, h: sizeOf(selT)[0], w: sizeOf(selT)[0] } : { round: false, w: sizeOf(selT)[0], h: Math.round(sizeOf(selT)[0] * 0.6) })} />
                </div>
                <div>
                  <label>{selT.round ? 'Diameter' : 'Width'}</label>
                  <Num key={`w-${selT.id}-${sizeOf(selT)[0]}`} value={sizeOf(selT)[0]} label={selT.round ? 'Diameter' : 'Width'} onCommit={(v) => resize(selT.id, selT.round ? { w: v, h: v } : { w: v, h: sizeOf(selT)[1] })} />
                </div>
                {!selT.round && (
                  <div>
                    <label>Depth</label>
                    <Num key={`h-${selT.id}-${sizeOf(selT)[1]}`} value={sizeOf(selT)[1]} label="Depth" onCommit={(v) => resize(selT.id, { w: sizeOf(selT)[0], h: v })} />
                  </div>
                )}
                <div>
                  <label>Zone</label>
                  <select className="bo-fe-in" value={selT.z} aria-label="Zone" onChange={(e) => patchTable(selT.id, { z: e.target.value })}>
                    {draft.zones.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                const st = states.get(selT.id) ?? spotState(selT, selT.x, selT.y, geo)
                return (
                  <div className={`bo-fe-chk${st.ok ? ' ok' : ''}`}>
                    <Pill tone={st.ok ? 'ok' : 'warn'}>{statusText(st)}</Pill>
                    <small>
                      {seatText(selT)} · walkway {prefs.gap} cm
                    </small>
                    {!st.ok && (
                      <Btn small onClick={() => moveToRightSpot(selT)}>
                        <MagnetStraight size={16} /> Move to a right spot
                      </Btn>
                    )}
                  </div>
                )
              })()}
              <div className="bo-insp-a">
                <Btn small onClick={rotate} disabled={selT.round}>
                  <ArrowClockwise size={16} /> Rotate
                </Btn>
                <Btn small onClick={duplicate}>
                  <Copy size={16} /> Duplicate
                </Btn>
                <Btn small danger onClick={remove}>
                  <Trash size={16} /> Remove
                </Btn>
              </div>
            </>
          ) : selD && sel?.k === 'd' ? (
            <>
              <small className="bo-insp-k">Selected</small>
              <h2>{selD.k === 'lbl' ? 'Label' : 'Wall or counter'}</h2>
              <p>Drag it anywhere on the floor. Tables keep {selD.k === 'wall' ? '20 cm' : 'no space'} from it.</p>
              <div className="bo-fe-rows">
                {selD.k === 'lbl' ? (
                  <div>
                    <label>Text</label>
                    <Txt key={`t-${sel.i}-${selD.text}`} value={selD.text ?? ''} max={30} label="Label text" onCommit={(v) => patchDecor(sel.i, { text: v })} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label>Length</label>
                      <Step key={`l-${sel.i}-${selD.w}`} value={selD.w ?? 0} min={10} max={RW} by={10} label="length" onChange={(v) => patchDecor(sel.i, { w: v })} />
                    </div>
                    <div>
                      <label>Thickness</label>
                      <Step key={`k-${sel.i}-${selD.h}`} value={selD.h ?? 0} min={5} max={600} by={5} label="thickness" onChange={(v) => patchDecor(sel.i, { h: v })} />
                    </div>
                  </>
                )}
              </div>
              <div className="bo-insp-a">
                {selD.k === 'wall' && (
                  <Btn small onClick={rotate}>
                    <ArrowClockwise size={16} /> Rotate
                  </Btn>
                )}
                <Btn small onClick={duplicate}>
                  <Copy size={16} /> Duplicate
                </Btn>
                <Btn small danger onClick={remove}>
                  <Trash size={16} /> Remove
                </Btn>
              </div>
            </>
          ) : (
            <>
              <small className="bo-insp-k">Zone</small>
              <h2>{z.name}</h2>
              <p>{poly ? 'Pick a table type above to add it, or drag one on the plan.' : 'Plan the room first: draw it with the pencil, or type its size. Then add tables.'}</p>
              <dl className="bo-kv">
                <div>
                  <dt>Tables</dt>
                  <dd className="mono">{zt.length}</dd>
                </div>
                <div>
                  <dt>Seats</dt>
                  <dd className="mono">{seatsIn}</dd>
                </div>
                <div>
                  <dt>Room</dt>
                  <dd className="mono">{poly ? `${(polyArea(poly) / 1e4).toFixed(1).replace('.', ',')} m² · ${poly.length} sides` : 'Not drawn · 17,2 × 6,6 m'}</dd>
                </div>
                <div>
                  <dt>Need room</dt>
                  <dd className="mono">{problems}</dd>
                </div>
              </dl>
              <div className="bo-fe-rows">
                <div>
                  <label>Zone name</label>
                  <Txt key={`zn-${z.id}-${z.name}`} value={z.name} max={18} label="Zone name" onCommit={(v) => commit({ ...draft, zones: draft.zones.map((x) => (x.id === z.id ? { ...x, name: v } : x)) })} />
                </div>
                <div>
                  <label>Table letter</label>
                  <Txt key={`zp-${z.id}-${z.pre}`} value={z.pre} max={2} label="Table letter" className="short" onCommit={(v) => commit({ ...draft, zones: draft.zones.map((x) => (x.id === z.id ? { ...x, pre: v.toUpperCase() } : x)) })} />
                </div>
                {(!poly || rect) && (
                  <div>
                    <label>Room size</label>
                    <RoomSize key={`rs-${z.id}-${roomW}-${roomD}`} w={roomW} d={roomD} onCommit={(w, d) => withRoom(rectRoom(clamp(w, 200, 10000), clamp(d, 200, 10000)), `Room set to ${fmtLen(w)} × ${fmtLen(d)}`)} />
                  </div>
                )}
                <div>
                  <label>Walkway</label>
                  <Seg options={['60 cm', '90 cm', '120 cm'] as const} value={`${prefs.gap} cm` as '60 cm' | '90 cm' | '120 cm'} label="Walkway between tables" onChange={(v) => setPref({ gap: parseInt(v) as FloorPrefs['gap'] })} />
                </div>
                <div>
                  <label>Snap</label>
                  <Seg options={['Off', '10 cm', '20 cm'] as const} value={prefs.snap ? (`${prefs.snap} cm` as '10 cm' | '20 cm') : 'Off'} label="Snap to grid" onChange={(v) => setPref({ snap: (v === 'Off' ? 0 : parseInt(v)) as FloorPrefs['snap'] })} />
                </div>
                <div>
                  <label>Fixed spots</label>
                  <Seg options={['On', 'Off'] as const} value={prefs.fixed ? 'On' : 'Off'} label="Tables click into a right spot" onChange={(v) => setPref({ fixed: v === 'On' })} />
                </div>
                <div>
                  <label>Chair zones</label>
                  <Seg options={['Show', 'Hide'] as const} value={prefs.bays ? 'Show' : 'Hide'} label="Show the room each table's chairs need" onChange={(v) => setPref({ bays: v === 'Show' })} />
                </div>
              </div>
              <div className="bo-insp-a">
                <Btn small onClick={startPen}>
                  <PencilSimple size={16} /> Draw the room
                </Btn>
                {poly && (
                  <Btn small onClick={clearRoom}>
                    Clear room
                  </Btn>
                )}
                {zt.length > 0 && (
                  <Btn small primary={problems > 0} onClick={arrange}>
                    <MagnetStraight size={16} /> Arrange the tables
                  </Btn>
                )}
                {problems > 0 && (
                  <Btn small onClick={fixSpacing}>
                    Fix spacing
                  </Btn>
                )}
                <Btn small onClick={() => (commit(standardFloor()), setSel(null), setZone('main'))}>
                  Restore the standard layout
                </Btn>
                <Btn small danger onClick={removeZone} disabled={draft.zones.length < 2 || zt.length > 0} title={zt.length ? 'Move or remove its tables first' : undefined}>
                  Remove zone
                </Btn>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
