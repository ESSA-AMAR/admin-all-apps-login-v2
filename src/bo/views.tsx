/** The Back Office views that are more than a table: tree, floor plan, calendar, steps, board, role grid, test order, import / export. */
import { Buildings, CaretRight, Check, Circle, CookingPot, FileArrowDown, FileArrowUp, MapPin, Storefront, TreeStructure, Globe, Hash, Tag } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Holding, Store } from '../data/types'
import { cityById, countryById, industryById } from '../data/mock'
import { eur, storeKpis } from '../lib/kpis'
import { Btn, Chips, Drawer, Immediate, Pill, Seg, Section, useSay, type Tone } from './kit'

/* ───────────────────────── organisation tree ───────────────────────── */

interface TNode {
  id: string
  level: 'Group' | 'Holding' | 'Industry' | 'Brand' | 'Country' | 'City' | 'Store'
  name: string
  sub: string
  stores: Store[]
  kids: TNode[]
  facets: string[]
}

const LEVEL_ICON: Record<TNode['level'], ReactNode> = {
  Group: <TreeStructure size={18} />,
  Holding: <Buildings size={18} />,
  Industry: <Tag size={18} />,
  Brand: <Hash size={18} />,
  Country: <Globe size={18} />,
  City: <MapPin size={18} />,
  Store: <Storefront size={18} />,
}

const FACETS: Record<TNode['level'], string[]> = {
  Group: ['Legal entity'],
  Holding: ['Legal entity', 'Brand owner'],
  Industry: ['Activity'],
  Brand: ['Brand owner'],
  Country: ['Fiscal zone'],
  City: ['Geography'],
  Store: ['Site', 'Fiscal zone'],
}

function build(holdings: Holding[]): TNode {
  const group = (items: Store[], key: (s: Store) => string) => {
    const m = new Map<string, Store[]>()
    for (const s of items) m.set(key(s), [...(m.get(key(s)) ?? []), s])
    return [...m.entries()]
  }
  const mk = (id: string, level: TNode['level'], name: string, stores: Store[], kids: TNode[], sub = ''): TNode => ({ id, level, name, sub: sub || `${stores.length} ${stores.length === 1 ? 'outlet' : 'outlets'}`, stores, kids, facets: FACETS[level] })
  const holdingNode = (h: Holding) =>
    mk(h.id, 'Holding', h.name, h.stores, group(h.stores, (s) => s.industry).map(([ind, st]) =>
      mk(`${h.id}/${ind}`, 'Industry', industryById(ind as never).name, st, group(st, (s) => s.brandId).map(([bid, bs]) => {
        const b = h.brands.find((x) => x.id === bid)!
        return mk(`${h.id}/${ind}/${bid}`, 'Brand', b.name, bs, group(bs, (s) => s.countryId).map(([cid, cs]) =>
          mk(`${bid}/${cid}`, 'Country', countryById(cid).name, cs, group(cs, (s) => s.cityId).map(([cty, ys]) =>
            mk(`${bid}/${cid}/${cty}`, 'City', cityById(cty).name, ys, ys.map((s) => mk(s.id, 'Store', s.name, [s], [], s.address)))))))
      })),
    ),
    `HQ ${h.hq}`)
  const all = holdings.flatMap((h) => h.stores)
  return mk('group', 'Group', holdings.length > 1 ? 'All holdings' : 'Client group', all, holdings.map(holdingNode), `${holdings.length} ${holdings.length === 1 ? 'holding' : 'holdings'}`)
}

export function OrgTree({ holdings }: { holdings: Holding[] }) {
  const root = useMemo(() => build(holdings), [holdings])
  const [open, setOpen] = useState<Set<string>>(() => new Set(['group', ...root.kids.map((k) => k.id)]))
  const [sel, setSel] = useState<string>('group')
  const index = useMemo(() => {
    const m = new Map<string, TNode>()
    const walk = (n: TNode) => (m.set(n.id, n), n.kids.forEach(walk))
    walk(root)
    return m
  }, [root])
  const node = index.get(sel) ?? root
  const rev = node.stores.reduce((a, s) => a + storeKpis(s).revenueToday, 0)
  const online = node.stores.filter((s) => s.status === 'online').length
  const say = useSay()

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const row = (n: TNode, depth: number): ReactNode => (
    <li key={n.id} role="none">
      <div className={`bo-tn${sel === n.id ? ' on' : ''}`} style={{ paddingLeft: 8 + depth * 20 }} role="treeitem" aria-expanded={n.kids.length ? open.has(n.id) : undefined} aria-selected={sel === n.id}>
        <button type="button" className="bo-tn-c" onClick={() => n.kids.length && toggle(n.id)} aria-label={open.has(n.id) ? 'Collapse' : 'Expand'} disabled={!n.kids.length}>
          {n.kids.length ? <CaretRight size={14} weight="bold" className={open.has(n.id) ? 'open' : ''} /> : <i />}
        </button>
        <button type="button" className="bo-tn-b" onClick={() => setSel(n.id)}>
          <span className="bo-tn-i">{LEVEL_ICON[n.level]}</span>
          <span className="bo-tn-l">
            <b>{n.name}</b>
            <small>{n.level}</small>
          </span>
          {n.level !== 'Store' && <span className="bo-pill">{n.stores.length}</span>}
        </button>
      </div>
      {n.kids.length > 0 && open.has(n.id) && (
        <ul role="group" className="bo-tree-k">
          {n.kids.map((k) => row(k, depth + 1))}
        </ul>
      )}
    </li>
  )

  return (
    <div className="bo-tree-wrap">
      <ul className="bo-tree" role="tree" aria-label="Organisation tree">
        {row(root, 0)}
      </ul>
      <aside className="bo-insp" aria-label="Node details">
        <small className="bo-insp-k">{node.level}</small>
        <h2>{node.name}</h2>
        <p>{node.sub}</p>
        <dl className="bo-kv">
          <div>
            <dt>Outlets</dt>
            <dd className="mono">{node.stores.length}</dd>
          </div>
          <div>
            <dt>Online now</dt>
            <dd className="mono">
              {online} of {node.stores.length}
            </dd>
          </div>
          <div>
            <dt>Revenue today</dt>
            <dd className="mono">{eur(rev)}</dd>
          </div>
          <div>
            <dt>Responsible for</dt>
            <dd className="bo-cellchips">
              {node.facets.map((f) => (
                <em key={f}>{f}</em>
              ))}
            </dd>
          </div>
          {node.kids.length > 0 && (
            <div>
              <dt>Contains</dt>
              <dd>
                {node.kids.length} {node.kids[0].level.toLowerCase()}
                {node.kids.length === 1 ? '' : 's'}
              </dd>
            </div>
          )}
        </dl>
        <div className="bo-insp-a">
          <Btn small onClick={() => say(`Reassign ${node.name}: opens the move dialog`)}>Reassign</Btn>
          <Btn small onClick={() => say(`Change the type of ${node.name}`)}>Change the type</Btn>
          <Btn small danger onClick={() => say(`Delete ${node.name}: this would ask you to confirm`)}>Delete</Btn>
        </div>
      </aside>
    </div>
  )
}

/* ───────────────────────── floor plan (plan and live) ───────────────────────── */

type TState = 'free' | 'resv' | 'order' | 'dine' | 'done' | 'late' | 'clear'
const STATE_LABEL: Record<TState, string> = { free: 'Free', resv: 'Reserved', order: 'Ordering', dine: 'Dining', done: 'Finished · still seated', late: 'Over 45 min', clear: 'To clear' }
const STATE_TONE: Record<TState, Tone> = { free: 'ok', resv: 'info', order: 'warn', dine: 'neutral', done: 'draft', late: 'danger', clear: 'neutral' }

const SIZES = { r2: [120, 120, 2, true, 'Ø 80 cm'], r4: [150, 150, 4, true, 'Ø 110 cm'], s4: [160, 130, 4, false, '140 × 80 cm'], l6: [230, 130, 6, false, '200 × 80 cm'], l8: [290, 130, 8, false, '260 × 90 cm'] } as const
const LAYOUT: (keyof typeof SIZES)[][] = [
  ['r2', 's4', 's4', 'r2', 'l6'],
  ['r2', 's4', 's4', 's4', 'l6'],
  ['r2', 's4', 's4', 'r4', 'l6'],
  ['r2', 's4', 's4', 'l8', 'l6'],
]
const DEMO_STATE: Record<number, TState> = { 2: 'order', 3: 'resv', 5: 'dine', 7: 'late', 9: 'done', 11: 'order', 12: 'clear', 14: 'late', 16: 'resv', 18: 'order', 19: 'resv', 20: 'done' }
const DEMO_INFO: Record<number, string> = { 2: '40 min · 4p · 350,55 €', 3: '19:25 · 4p · Alaoui', 5: '23 min · 5p · 269,00 €', 7: '66 min · 4p · 427,00 €', 9: 'Paid 16 min ago · 4p', 11: '10 min · 2p · 90,00 €', 14: '53 min · 4p · 239,00 €', 16: '20:30 · 2p · Tazi', 18: '6 min · 3p', 19: '19:50 · 8p · Bennani', 20: 'Paid 7 min ago · 5p' }

/** The 20 tables of the main hall, as in the POS: window column of twos, fours in the middle, the long group tables on the right. */
export const ALL_TABLES = LAYOUT.flatMap((row, r) =>
  row.map((k, c) => {
    const n = r * 5 + c + 1
    const [w, h, seats, round, dim] = SIZES[k]
    return { n, id: `T${n}`, kind: k, x: 150 + c * 345 - w / 2, y: 80 + r * 165 - h / 2, w, h, seats, round, dim, section: c === 0 ? 'Window' : c === 4 ? 'Groups' : 'Centre', state: DEMO_STATE[n] ?? ('free' as TState), info: DEMO_INFO[n] ?? `${seats} seats` }
  }),
)
export const TABLE_STATE_LABEL = STATE_LABEL
export const TABLE_STATE_TONE = STATE_TONE

export function FloorPlan({ mode }: { mode: 'plan' | 'live' }) {
  const tables = ALL_TABLES
  const [filter, setFilter] = useState<TState | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const t = tables.find((x) => x.id === open)
  const counts = tables.reduce<Record<string, number>>((a, x) => ((a[x.state] = (a[x.state] ?? 0) + 1), a), {})

  return (
    <div className="bo-plan-wrap">
      <div className="bo-legend" role="group" aria-label="Table states">
        {(Object.keys(STATE_LABEL) as TState[]).map((s) => (
          <button key={s} type="button" className={`${filter === s ? 'on' : ''}${counts[s] ? '' : ' zero'}`} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? null : s)}>
            <i className={`bo-sw ${s}`} />
            {STATE_LABEL[s]}
            <em>{counts[s] ?? 0}</em>
          </button>
        ))}
      </div>
      <div className="bo-plan" style={{ aspectRatio: '1720 / 660' }}>
        {tables.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`bo-tbl2 st-${x.state}${x.round ? ' round' : ''}${filter && filter !== x.state ? ' dim' : ''}`}
            style={{ left: `${(x.x / 1720) * 100}%`, top: `${(x.y / 660) * 100}%`, width: `${(x.w / 1720) * 100}%`, height: `${(x.h / 660) * 100}%` }}
            onClick={() => setOpen(x.id)}
            aria-label={`Table ${x.id}, ${STATE_LABEL[x.state]}, ${x.dim}`}
          >
            <b>{x.id}</b>
            <small>{mode === 'plan' ? `${x.seats} seats` : x.info}</small>
            <small className="dm">{x.dim}</small>
          </button>
        ))}
        <span className="bo-plan-l" style={{ left: '5%', bottom: '-6%' }}>↑ Entrance</span>
        <span className="bo-plan-l" style={{ right: '4%', bottom: '-6%' }}>Kitchen ↗</span>
      </div>
      <p className="bo-note">The back office never changes a table’s state: it only shows it. Tables are drawn to scale in the floor plan editor, on the POS.</p>
      {t && (
        <Drawer title={`Table ${t.id}`} status={<Pill tone={STATE_TONE[t.state]} dashed={t.state === 'clear'}>{STATE_LABEL[t.state]}</Pill>} onClose={() => setOpen(null)}>
          <dl className="bo-kv">
            <div><dt>Seats</dt><dd className="mono">{t.seats}</dd></div>
            <div><dt>Size</dt><dd className="mono">{t.dim}</dd></div>
            <div><dt>Section</dt><dd>{t.n % 5 === 1 ? 'Window' : t.n % 5 === 0 ? 'Groups' : 'Centre'}</dd></div>
            <div><dt>Right now</dt><dd>{t.info}</dd></div>
          </dl>
          <footer className="bo-drawer-f"><Btn onClick={() => setOpen(null)}>Close</Btn></footer>
        </Drawer>
      )}
    </div>
  )
}

/* ───────────────────────── reservation calendar ───────────────────────── */

interface Booking { table: string; start: number; dur: number; name: string; size: number; status: 'Confirmed' | 'Arrived' | 'Waiting' | 'No-show' | 'Cancelled' }
const BOOKINGS: Record<'Lunch' | 'Dinner', { from: number; to: number; now: number; list: Booking[] }> = {
  Lunch: {
    from: 12, to: 15, now: 13.2,
    list: [
      { table: 'T1', start: 12, dur: 75, name: 'Benali', size: 2, status: 'Arrived' }, { table: 'T2', start: 12.5, dur: 90, name: 'Peeters', size: 4, status: 'Arrived' },
      { table: 'T3', start: 13, dur: 90, name: 'Alaoui', size: 4, status: 'Confirmed' }, { table: 'T4', start: 12, dur: 60, name: 'Lambert', size: 2, status: 'No-show' },
      { table: 'T5', start: 12.5, dur: 120, name: 'Atlas Co.', size: 6, status: 'Arrived' }, { table: 'T6', start: 13.5, dur: 60, name: 'Amrani', size: 2, status: 'Confirmed' },
      { table: 'T7', start: 12, dur: 90, name: 'Kaci', size: 4, status: 'Cancelled' }, { table: 'T7', start: 13.5, dur: 75, name: 'Martin', size: 3, status: 'Confirmed' },
      { table: 'T8', start: 14, dur: 60, name: 'Bakri', size: 4, status: 'Waiting' },
    ],
  },
  Dinner: {
    from: 18.5, to: 22.5, now: 19.4,
    list: [
      { table: 'T1', start: 19, dur: 90, name: 'Tazi', size: 2, status: 'Confirmed' }, { table: 'T2', start: 19.5, dur: 105, name: 'Ilyas', size: 4, status: 'Confirmed' },
      { table: 'T3', start: 18.5, dur: 90, name: 'Alaoui', size: 4, status: 'Arrived' }, { table: 'T4', start: 20, dur: 90, name: 'Chraibi', size: 2, status: 'Confirmed' },
      { table: 'T5', start: 19, dur: 150, name: 'Bennani', size: 8, status: 'Confirmed' }, { table: 'T6', start: 20.5, dur: 75, name: 'Lahlou', size: 2, status: 'Waiting' },
      { table: 'T7', start: 19.5, dur: 90, name: 'El Idrissi', size: 4, status: 'Cancelled' }, { table: 'T8', start: 21, dur: 90, name: 'Benali', size: 4, status: 'Confirmed' },
    ],
  },
}
const B_TONE: Record<Booking['status'], Tone> = { Confirmed: 'ok', Arrived: 'info', Waiting: 'warn', 'No-show': 'danger', Cancelled: 'neutral' }
const hh = (v: number) => `${String(Math.floor(v)).padStart(2, '0')}:${v % 1 ? '30' : '00'}`

export function ReservationCalendar() {
  const [svc, setSvc] = useState<'Lunch' | 'Dinner'>('Lunch')
  const [open, setOpen] = useState<Booking | null>(null)
  const { from, to, now, list } = BOOKINGS[svc]
  const span = to - from
  const slots = Array.from({ length: span * 2 + 1 }, (_, i) => from + i / 2)
  const tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']
  const pos = (v: number) => `${((v - from) / span) * 100}%`
  return (
    <div className="bo-cal-wrap">
      <div className="bo-cal-bar">
        <Seg options={['Lunch', 'Dinner'] as const} value={svc} onChange={setSvc} label="Service" />
        <span className="bo-note">Today · one row per table, one column per half hour</span>
      </div>
      <div className="bo-cal">
        <div className="bo-cal-h">
          <span />
          <div>{slots.filter((_, i) => i % 2 === 0).map((s) => <span key={s} style={{ left: pos(s) }}>{hh(s)}</span>)}</div>
        </div>
        {tables.map((t) => (
          <div className="bo-cal-r" key={t}>
            <b className="mono">{t}</b>
            <div className="bo-cal-g" style={{ backgroundSize: `${100 / (span * 2)}% 100%` }}>
              {list.filter((b) => b.table === t).map((b) => (
                <button key={b.name + b.start} type="button" className={`bo-bk ${B_TONE[b.status]}${b.status === 'Cancelled' ? ' cx' : ''}`} style={{ left: pos(b.start), width: `${(b.dur / 60 / span) * 100}%` }} onClick={() => setOpen(b)} title={`${b.name} · ${b.size} · ${b.status}`}>
                  <b>{b.name}</b>
                  <small>{b.size} · {b.status}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
        <i className="bo-now" style={{ left: `calc(64px + (100% - 64px) * ${(now - from) / span})` }} aria-label="Now" />
      </div>
      {open && (
        <Drawer title={`${open.name} · ${open.size} guests`} status={<Pill tone={B_TONE[open.status]} dashed={open.status === 'Cancelled'}>{open.status}</Pill>} onClose={() => setOpen(null)}>
          <dl className="bo-kv">
            <div><dt>Table</dt><dd className="mono">{open.table}</dd></div>
            <div><dt>From</dt><dd className="mono">{hh(open.start)}</dd></div>
            <div><dt>Until</dt><dd className="mono">{hh(open.start + open.dur / 60)}</dd></div>
            <div><dt>Guests</dt><dd className="mono">{open.size}</dd></div>
          </dl>
          <footer className="bo-drawer-f"><Btn onClick={() => setOpen(null)}>Close</Btn></footer>
        </Drawer>
      )}
    </div>
  )
}

/* ───────────────────────── steps (openings & go-live) ───────────────────────── */

export function OpeningSteps({ outlets }: { outlets: { id: string; name: string; sub: string; done: number }[] }) {
  const [sel, setSel] = useState(outlets[0]?.id)
  const o = outlets.find((x) => x.id === sel) ?? outlets[0]
  const STEPS = [
    ['Identity', 'Name, address, brand and opening date'],
    ['Fiscal', 'Legal entity, tax zone and receipt numbering'],
    ['Devices', 'Terminals, printers and kitchen screens paired'],
    ['Menu & prices', 'The brand menu, with this outlet’s prices'],
    ['Staff & roles', 'Accounts, roles and PINs'],
    ['Go-live', 'A test ticket, then open to the public'],
  ]
  const [done, setDone] = useState<Record<string, number>>({})
  const d = done[o.id] ?? o.done
  const say = useSay()
  return (
    <div className="bo-steps">
      <Chips options={outlets.map((x) => x.name)} value={o.name} onChange={(v) => setSel(outlets.find((x) => x.name === v)!.id)} label="Outlet in opening" />
      <ol>
        {STEPS.map(([t, s], i) => {
          const st = i < d ? 'done' : i === d ? 'now' : 'todo'
          return (
            <li key={t} className={st}>
              <span className="bo-step-n">{st === 'done' ? <Check size={14} weight="bold" /> : i + 1}</span>
              <div>
                <b>{t}</b>
                <small>{s}</small>
              </div>
              <Pill tone={st === 'done' ? 'ok' : st === 'now' ? 'warn' : 'neutral'} dashed={st === 'todo'}>{st === 'done' ? 'Done' : st === 'now' ? 'Current step' : 'To do'}</Pill>
              {st === 'now' && <Btn small primary onClick={() => (setDone((x) => ({ ...x, [o.id]: d + 1 })), say(`${t} done for ${o.name}`))}>{i === STEPS.length - 1 ? 'Go live' : 'Mark as done'}</Btn>}
            </li>
          )
        })}
      </ol>
      <p className="bo-note">{o.sub} · {Math.min(d, STEPS.length)} of {STEPS.length} steps done</p>
    </div>
  )
}

/* ───────────────────────── board (stages, orders) ───────────────────────── */

export interface BoardCol { title: string; tone: Tone; items: { id: string; title: string; meta: string; tag?: string; late?: boolean }[] }

export function Board({ cols }: { cols: BoardCol[] }) {
  return (
    <div className="bo-board">
      {cols.map((c) => (
        <section key={c.title} className={`bo-col ${c.tone}`}>
          <header>
            <b>{c.title}</b>
            <span className="bo-pill">{c.items.length}</span>
          </header>
          <ul>
            {c.items.map((i) => (
              <li key={i.id} className={i.late ? 'late' : ''}>
                <div>
                  <b className="mono">{i.id}</b>
                  {i.tag && <Pill tone={i.late ? 'danger' : 'neutral'}>{i.tag}</Pill>}
                </div>
                <p>{i.title}</p>
                <small>{i.meta}</small>
              </li>
            ))}
            {c.items.length === 0 && <li className="none">Nothing here</li>}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ───────────────────────── roles & permissions ───────────────────────── */

const DOMAINS: { name: string; perms: [string, 'read' | 'write', string][] }[] = [
  { name: 'Organisation', perms: [['See the organisation tree', 'read', 'Hierarchy'], ['Edit nodes and facets', 'write', 'Hierarchy'], ['Open an outlet', 'write', 'Openings']] },
  { name: 'Operations', perms: [['See tickets and orders', 'read', 'Sales'], ['Approve refunds', 'write', 'Sales'], ['Close a cash session', 'write', 'Cash'], ['Change the floor plan', 'write', 'Dining room'], ['Manage reservations', 'write', 'Reservations'], ['Adjust stock', 'write', 'Stock']] },
  { name: 'Analytics', perms: [['See dashboards', 'read', 'Dashboards'], ['Export reports', 'read', 'Reports'], ['Run a reconciliation', 'write', 'Reconciliations']] },
  { name: 'Platform', perms: [['See applications', 'read', 'Application estate'], ['Change entitlements', 'write', 'Application estate']] },
]
const ROLE_SETS: { name: string; system?: boolean; members: number; all?: boolean; off?: string[] }[] = [
  { name: 'Super Admin', system: true, members: 2, all: true },
  { name: 'Holding Admin', system: true, members: 3, off: ['Change entitlements'] },
  { name: 'Brand Manager', members: 6, off: ['Change entitlements', 'See applications', 'Edit nodes and facets', 'Open an outlet'] },
  { name: 'Regional Manager', members: 9, off: ['Change entitlements', 'See applications', 'Edit nodes and facets', 'Open an outlet', 'Change the floor plan'] },
  { name: 'Store Manager', members: 58, off: ['Change entitlements', 'See applications', 'Edit nodes and facets', 'Open an outlet', 'Run a reconciliation', 'Export reports'] },
]

export function RoleGrid() {
  const [role, setRole] = useState(ROLE_SETS[2].name)
  const r = ROLE_SETS.find((x) => x.name === role)!
  const say = useSay()
  const [extra, setExtra] = useState<Record<string, boolean>>({})
  const has = (p: string) => (extra[`${role}|${p}`] ?? (r.all || !r.off?.includes(p)))
  return (
    <div className="bo-roles">
      <ul className="bo-rolelist">
        {ROLE_SETS.map((x) => (
          <li key={x.name}>
            <button type="button" className={x.name === role ? 'on' : ''} onClick={() => setRole(x.name)}>
              <b>{x.name}</b>
              <small>{x.members} {x.members === 1 ? 'account' : 'accounts'}{x.system ? ' · system role' : ''}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="bo-perms">
        {r.system && <p className="bo-note">System roles are shown for reference and cannot be edited.</p>}
        {DOMAINS.map((d) => {
          const n = d.perms.filter(([p]) => has(p)).length
          return (
            <fieldset key={d.name} disabled={r.system}>
              <legend>{d.name} <em className="mono">{n} of {d.perms.length}</em></legend>
              {d.perms.map(([p, kind, screen]) => (
                <label key={p} className="bo-perm">
                  <input type="checkbox" checked={has(p)} onChange={(e) => (setExtra((x) => ({ ...x, [`${role}|${p}`]: e.target.checked })), say(`${role}: “${p}” ${e.target.checked ? 'granted' : 'removed'}`))} />
                  <span>{p}</span>
                  <Pill tone={kind === 'write' ? 'warn' : 'neutral'}>{kind === 'write' ? 'Write' : 'Read'}</Pill>
                  <small>{screen}</small>
                </label>
              ))}
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── test an order ───────────────────────── */

const MENU: [string, string][] = [['Signature Burger', 'Grill'], ['Truffle Risotto', 'Hot line'], ['Caesar Salad', 'Cold line'], ['Espresso Tonic', 'Bar'], ['Brunch Formula', 'Hot line'], ['Chocolate Cake', 'Pastry'], ['Natural Wine (gl.)', 'Bar'], ['Fries', 'Fryer']]

export function TestOrder() {
  const [picked, setPicked] = useState<string[]>(['Signature Burger', 'Espresso Tonic'])
  const [ran, setRan] = useState(false)
  const toggle = (m: string) => (setRan(false), setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m])))
  const byStation = picked.reduce<Record<string, string[]>>((a, m) => {
    const st = MENU.find((x) => x[0] === m)![1]
    a[st] = [...(a[st] ?? []), m]
    return a
  }, {})
  return (
    <div className="bo-test">
      <Section title="1 · Pick the items of a test order" hint="Nothing is sent: this only shows where the order would go.">
        <div className="bo-chips wrap" role="group" aria-label="Items">
          {MENU.map(([m]) => (
            <button key={m} type="button" className={picked.includes(m) ? 'on' : ''} aria-pressed={picked.includes(m)} onClick={() => toggle(m)}>{m}</button>
          ))}
        </div>
        <Btn primary disabled={!picked.length} onClick={() => setRan(true)}>Show the routing</Btn>
      </Section>
      {ran && (
        <Section title="2 · Where it goes">
          <ul className="bo-route">
            {Object.entries(byStation).map(([st, items]) => (
              <li key={st}>
                <span className="bo-tn-i"><CookingPot size={18} /></span>
                <b>{st}</b>
                <span className="bo-cellchips">{items.map((i) => <em key={i}>{i}</em>)}</span>
                <Pill tone="ok">Routed</Pill>
              </li>
            ))}
          </ul>
          <p className="bo-note">Every item reached a station. An item that reached none would be listed here as “Not routed”.</p>
        </Section>
      )}
    </div>
  )
}

/* ───────────────────────── import / export ───────────────────────── */

export function ImportExport() {
  const say = useSay()
  const [scope, setScope] = useState<'Whole client' | 'This scope'>('This scope')
  const [fmt, setFmt] = useState<'CSV' | 'JSON'>('CSV')
  const [file, setFile] = useState<string | null>(null)
  return (
    <div className="bo-io">
      <article className="bo-card">
        <header><div><h3><FileArrowDown size={20} /> Export the policies</h3><small>A file you can read, edit and bring back</small></div></header>
        <div className="bo-io-f"><Seg options={['Whole client', 'This scope'] as const} value={scope} onChange={setScope} label="What to export" /><Seg options={['CSV', 'JSON'] as const} value={fmt} onChange={setFmt} label="Format" /></div>
        <footer><Btn primary onClick={() => say(`policies-${scope === 'This scope' ? 'scope' : 'client'}.${fmt.toLowerCase()} would download`)}>Export</Btn></footer>
      </article>
      <article className="bo-card">
        <header><div><h3><FileArrowUp size={20} /> Import policies</h3><small>Checked first; nothing changes until you publish</small></div></header>
        {!file ? (
          <button type="button" className="bo-drop" onClick={() => setFile('policies-edited.csv')}>
            <FileArrowUp size={28} />
            <b>Choose a file</b>
            <small>CSV or JSON, 5 MB at most</small>
          </button>
        ) : (
          <ul className="bo-route">
            <li><b>policies-edited.csv</b><Pill tone="neutral">28 rows</Pill></li>
            <li><b>Format and columns</b><Pill tone="ok">Valid</Pill></li>
            <li><b>Known policies</b><Pill tone="ok">26 of 28</Pill></li>
            <li><b>Unknown policy names</b><Pill tone="warn">2 to review</Pill></li>
            <li><b>Changes against today</b><Pill tone="draft">9 in the draft</Pill></li>
          </ul>
        )}
        <footer>{file && <><Btn onClick={() => setFile(null)}>Start over</Btn><Btn primary onClick={() => (say('9 changes added to the draft'), setFile(null))}>Add to the draft</Btn></>}</footer>
      </article>
    </div>
  )
}

/* ───────────────────────── a small status line used by several screens ───────────────────────── */

export function Dot({ tone }: { tone: Tone }) {
  return <Circle size={10} weight="fill" className={`bo-dotc ${tone}`} />
}
export { Immediate }
