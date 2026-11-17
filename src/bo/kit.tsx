/**
 * The Back Office screen kit, in the POS v3 look. Every Back Office screen is built from these:
 *  page header · toolbar (search, filter chips, segmented switch) · KPI tiles · data table with a detail drawer · status pill · cards · timeline · settings rows · banner.
 * Rules carried over from the Back Office design: a status always carries a word (colour is never the only signal), amounts carry their currency, numbers are mono and right-aligned,
 * a destructive or immediate action says so, and an empty state says what is missing and what to do.
 */
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, CaretDown, CaretUp, Lightning, Lock, MagnifyingGlass, X } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { RedWord } from '../components/ui'

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'draft' | 'neutral'

/** A message at the bottom of the screen: every demo action says what it would do. */
export const SayCtx = createContext<(msg: string) => void>(() => {})
export const useSay = () => useContext(SayCtx)

/* ───────────────────────── small pieces ───────────────────────── */

export const Pill = ({ tone = 'neutral', dashed, children }: { tone?: Tone; dashed?: boolean; children: ReactNode }) => (
  <span className={`bo-st ${tone}${dashed ? ' dashed' : ''}`}>
    <i aria-hidden="true" />
    {children}
  </span>
)

/** The word for a status that applies at once (an action during service). */
export const Immediate = () => (
  <span className="bo-imm" title="Applies immediately">
    <Lightning size={12} weight="fill" /> Applies immediately
  </span>
)

export function Btn({ children, primary, danger, onClick, small, disabled, title }: { children: ReactNode; primary?: boolean; danger?: boolean; onClick?: () => void; small?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={`bo-btn${primary ? ' btn-primary' : ''}${danger ? ' danger' : ''}${small ? ' small' : ''}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

export function Banner({ tone = 'info', title, children, actions }: { tone?: Tone; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`bo-banner ${tone}`} role="status">
      <div>
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="bo-banner-act">{actions}</div>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="bo-empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  )
}

/* ───────────────────────── page ───────────────────────── */

export function PageHead({ eyebrow, title, desc, actions }: { eyebrow: [string, string]; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="bo-head2">
      <div className="bo-head2-t">
        <div className="eyebrow">
          <span className="eyebrow-index">{eyebrow[0]}</span>
          <span className="eyebrow-line" />
          <span>{eyebrow[1]}</span>
        </div>
        <h1 className="step-title">
          <RedWord text={title} />
        </h1>
        {desc && <p className="bo-head2-d">{desc}</p>}
      </div>
      {actions && <div className="bo-head2-a">{actions}</div>}
    </header>
  )
}

/** A segmented switch with a sliding pill (the POS v3 switcher). */
export function Seg<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  const id = useId()
  return (
    <div className="bo-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="tab" aria-selected={o === value} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
          {o === value && <motion.span layoutId={`seg-${id}`} className="bo-seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span>{o}</span>
        </button>
      ))}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="bo-toolbar">{children}</div>
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="bo-search">
      <MagnifyingGlass size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear the search">
          <X size={14} weight="bold" />
        </button>
      )}
    </label>
  )
}

export function Chips({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="bo-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'on' : ''} aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────── KPI tiles ───────────────────────── */

export interface Kpi {
  label: string
  value: string
  /** "+3,1 %" with whether it is going up, and whether that is good news (colour only says favourable or not; the arrow and the sign carry the rest). */
  delta?: { text: string; up: boolean; good?: boolean }
  hint?: string
  tone?: Tone
}

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="bo-kpis">
      {items.map((k) => (
        <div className={`bo-kpi${k.tone ? ' ' + k.tone : ''}`} key={k.label}>
          <small>{k.label}</small>
          <b>{k.value}</b>
          <span className="bo-kpi-f">
            {k.delta && (
              <em className={k.delta.good === undefined ? '' : k.delta.good ? 'good' : 'bad'}>
                {k.delta.up ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />}
                {k.delta.text}
              </em>
            )}
            {k.hint && <span>{k.hint}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── table ───────────────────────── */

export type CellObj = { t: string | number; tone?: Tone; sub?: string; chips?: string[]; pct?: number; n?: number; dashed?: boolean }
export type Cell = string | number | CellObj
export type Row = Record<string, Cell> & { id: string }

export interface Col {
  key: string
  label: string
  /** text (default), strong (bold), mono, num (right, mono), pill, chips, bar (a value with a bar), sub (value over a small line) */
  kind?: 'text' | 'strong' | 'mono' | 'num' | 'pill' | 'chips' | 'bar' | 'sub'
  w?: number
}

const raw = (c: Cell | undefined): string | number => (c === undefined ? '' : typeof c === 'object' ? (c.n ?? c.t) : c)
const text = (c: Cell | undefined): string => (c === undefined ? '' : typeof c === 'object' ? String(c.t) : String(c))

function CellView({ col, cell }: { col: Col; cell: Cell | undefined }) {
  const o: CellObj = typeof cell === 'object' ? cell : { t: cell ?? '' }
  switch (col.kind) {
    case 'pill':
      return <Pill tone={o.tone} dashed={o.dashed}>{o.t}</Pill>
    case 'chips':
      return (
        <span className="bo-cellchips">
          {(o.chips ?? String(o.t).split(', ').filter(Boolean)).map((c) => (
            <em key={c}>{c}</em>
          ))}
        </span>
      )
    case 'bar':
      return (
        <span className={`bo-cellbar ${o.tone ?? ''}`}>
          <span className="bo-bar">
            <i style={{ width: `${Math.max(0, Math.min(100, o.pct ?? 0))}%` }} />
          </span>
          <span>{o.t}</span>
        </span>
      )
    case 'sub':
      return (
        <span className="bo-cellsub">
          <b>{o.t}</b>
          {o.sub && <small>{o.sub}</small>}
        </span>
      )
    case 'strong':
      return <b>{o.t}</b>
    default:
      return <>{o.t}</>
  }
}

export interface TableProps {
  cols: Col[]
  rows: Row[]
  search?: string
  /** One column to filter by, as chips (the first chip, All, clears it). */
  filter?: { key: string; label: string }
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** Title of the drawer that opens on a row; without it the rows do not open. */
  drawer?: (row: Row) => { title: string; status?: ReactNode; fields?: [string, ReactNode][]; actions?: { label: string; primary?: boolean; danger?: boolean; say?: string }[] }
  total?: Record<string, Cell>
  empty?: [string, string]
  toolbarRight?: ReactNode
}

export function DataTable({ cols, rows, search, filter, initialSort, drawer, total, empty, toolbarRight }: TableProps) {
  const [q, setQ] = useState('')
  const [fv, setFv] = useState('All')
  const [sort, setSort] = useState(initialSort ?? null)
  const [open, setOpen] = useState<string | null>(null)
  const say = useSay()

  const options = useMemo(() => (filter ? ['All', ...Array.from(new Set(rows.map((r) => text(r[filter.key]))))] : []), [rows, filter])
  const shown = useMemo(() => {
    let out = rows
    if (filter && fv !== 'All') out = out.filter((r) => text(r[filter.key]) === fv)
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      out = out.filter((r) => cols.some((c) => text(r[c.key]).toLowerCase().includes(n)) || (typeof r[cols[0].key] === 'object' && String((r[cols[0].key] as CellObj).sub ?? '').toLowerCase().includes(n)))
    }
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const x = raw(a[sort.key]),
          y = raw(b[sort.key])
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir
      })
    }
    return out
  }, [rows, q, fv, sort, cols, filter])

  const sel = open ? rows.find((r) => r.id === open) : null
  const d = sel && drawer ? drawer(sel) : null

  return (
    <section className="bo-tbl">
      {(search || filter || toolbarRight) && (
        <Toolbar>
          {search && <Search value={q} onChange={setQ} placeholder={search} />}
          {filter && <Chips options={options} value={fv} onChange={setFv} label={filter.label} />}
          <span className="bo-count" aria-live="polite">
            {shown.length === rows.length ? `${rows.length} in total` : `${shown.length} of ${rows.length}`}
          </span>
          {toolbarRight}
        </Toolbar>
      )}
      <div className="bo-scroll">
        <table>
          <thead>
            <tr>
              {cols.map((c) => {
                const on = sort?.key === c.key
                return (
                  <th key={c.key} className={c.kind === 'num' ? 'r' : ''} style={c.w ? { width: c.w } : undefined} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => setSort(on && sort!.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' })}>
                      {c.label}
                      {on && (sort!.dir === 'asc' ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className={`${drawer ? 'click' : ''}${open === r.id ? ' sel' : ''}`}
                tabIndex={drawer ? 0 : undefined}
                onClick={() => drawer && setOpen(r.id)}
                onKeyDown={(e) => drawer && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(r.id))}
              >
                {cols.map((c) => (
                  <td key={c.key} className={`${c.kind === 'num' ? 'r' : ''}${c.kind === 'mono' || c.kind === 'num' ? ' mono' : ''}`}>
                    <CellView col={c} cell={r[c.key]} />
                  </td>
                ))}
              </tr>
            ))}
            {total && shown.length > 0 && (
              <tr className="total">
                {cols.map((c) => (
                  <td key={c.key} className={`${c.kind === 'num' ? 'r' : ''} mono`}>
                    {text(total[c.key])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title={empty?.[0] ?? 'Nothing matches'}>{empty?.[1] ?? 'Try another word, or clear the filter.'}</Empty>}
      </div>

      {d && (
        <Drawer title={d.title} status={d.status} onClose={() => setOpen(null)}>
          <dl className="bo-kv">
            {(d.fields ?? cols.map((c) => [c.label, <CellView key={c.key} col={c} cell={sel![c.key]} />] as [string, ReactNode])).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <footer className="bo-drawer-f">
            <Btn onClick={() => setOpen(null)}>Close</Btn>
            {(d.actions ?? []).map((a) => (
              <Btn key={a.label} primary={a.primary} danger={a.danger} onClick={() => (say(a.say ?? `${a.label}: this would apply here`), setOpen(null))}>
                {a.label}
              </Btn>
            ))}
          </footer>
        </Drawer>
      )}
    </section>
  )
}

/* ───────────────────────── drawer ───────────────────────── */

export function Drawer({ title, status, onClose, children }: { title: string; status?: ReactNode; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <>
      <div className="bo-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="bo-drawer" role="dialog" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {status}
          </div>
          <button ref={closeRef} type="button" className="bo-x" onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </header>
        {children}
      </aside>
    </>,
    document.body,
  )
}

/* ───────────────────────── cards, timeline, settings ───────────────────────── */

export interface CardItem {
  title: string
  sub?: string
  pill?: { text: string; tone?: Tone; dashed?: boolean }
  meta?: [string, string][]
  /** A switch on the card: its label and its starting state. */
  toggle?: { label: string; on: boolean; immediate?: boolean }
  actions?: { label: string; say: string; primary?: boolean }[]
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`bo-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

export function Cards({ items, cols = 3 }: { items: CardItem[]; cols?: 2 | 3 | 4 }) {
  const say = useSay()
  const [tog, setTog] = useState<Record<string, boolean>>({})
  return (
    <div className={`bo-cards c${cols}`}>
      {items.map((c) => (
        <article className="bo-card" key={c.title}>
          <header>
            <div>
              <h3>{c.title}</h3>
              {c.sub && <small>{c.sub}</small>}
            </div>
            {c.pill && <Pill tone={c.pill.tone} dashed={c.pill.dashed}>{c.pill.text}</Pill>}
          </header>
          {c.meta && (
            <dl className="bo-card-m">
              {c.meta.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {(c.toggle || c.actions) && (
            <footer>
              {c.toggle && (
                <label className="bo-tog">
                  <Switch
                    on={tog[c.title] ?? c.toggle.on}
                    label={c.toggle.label}
                    onChange={(v) => (setTog((t) => ({ ...t, [c.title]: v })), say(`${c.title}: ${c.toggle!.label} ${v ? 'on' : 'off'}${c.toggle!.immediate ? ' (applies immediately)' : ''}`))}
                  />
                  <span>{c.toggle.label}</span>
                  {c.toggle.immediate && <Immediate />}
                </label>
              )}
              {c.actions?.map((a) => (
                <Btn key={a.label} small primary={a.primary} onClick={() => say(a.say)}>
                  {a.label}
                </Btn>
              ))}
            </footer>
          )}
        </article>
      ))}
    </div>
  )
}

export interface TimelineItem {
  time: string
  who: string
  source?: string
  text: string
  obj?: string
  change?: [string, string]
  immediate?: boolean
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="bo-time">
      {items.map((t, i) => (
        <li key={i}>
          <time>{t.time}</time>
          <div>
            <p>
              <b>{t.who}</b>
              {t.source && <small>{t.source}</small>} {t.text} {t.obj && <strong>{t.obj}</strong>}
            </p>
            {t.change && (
              <span className="bo-change">
                <s>{t.change[0]}</s> → <em>{t.change[1]}</em>
              </span>
            )}
          </div>
          {t.immediate && <Immediate />}
        </li>
      ))}
    </ol>
  )
}

export interface SettingRow {
  name: string
  desc?: string
  /** switch (on/off), value (read as text), select (a few options) */
  kind: 'switch' | 'value' | 'select'
  on?: boolean
  value?: string
  options?: string[]
  /** Where the value comes from: Inherited from …, Locked by …, Defined here. */
  source?: { text: string; tone?: Tone }
  immediate?: boolean
}

export function Settings({ rows }: { rows: SettingRow[] }) {
  const say = useSay()
  const [vals, setVals] = useState<Record<string, boolean | string>>({})
  return (
    <ul className="bo-set">
      {rows.map((r) => {
        const v = vals[r.name] ?? (r.kind === 'switch' ? !!r.on : r.value)
        // A value locked by a higher level can be read here, not changed.
        const locked = !!r.source?.text.startsWith('Locked')
        return (
          <li key={r.name}>
            <div className="bo-set-n">
              <b>{r.name}</b>
              {r.desc && <small>{r.desc}</small>}
            </div>
            {r.source && <Pill tone={r.source.tone ?? 'neutral'}>{r.source.text}</Pill>}
            {r.immediate && <Immediate />}
            <div className="bo-set-v">
              {r.kind === 'switch' && <Switch on={!!v} label={r.name} disabled={locked} onChange={(x) => (setVals((s) => ({ ...s, [r.name]: x })), say(`${r.name}: ${x ? 'on' : 'off'}`))} />}
              {r.kind === 'value' && <span className="mono">{r.value}</span>}
              {r.kind === 'select' && (
                <select value={String(v)} disabled={locked} onChange={(e) => (setVals((s) => ({ ...s, [r.name]: e.target.value })), say(`${r.name}: ${e.target.value}`))} aria-label={r.name}>
                  {r.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** A horizontal list of bars (a ranking, a breakdown): label, bar, value. */
export function BarList({ rows }: { rows: { label: string; sub?: string; value: string; pct: number; tone?: Tone }[] }) {
  return (
    <ol className="bo-bars">
      {rows.map((r, i) => (
        <li key={r.label}>
          <span className="bo-rank mono">{i + 1}</span>
          <span className="bo-bars-l">
            <b>{r.label}</b>
            {r.sub && <small>{r.sub}</small>}
          </span>
          <span className={`bo-bar ${r.tone ?? ''}`}>
            <i style={{ width: `${r.pct}%` }} />
          </span>
          <span className="bo-bars-v mono">{r.value}</span>
        </li>
      ))}
    </ol>
  )
}

export function LockedCard({ group }: { group: string }) {
  const say = useSay()
  return (
    <div className="bo-locked">
      <Lock size={32} />
      <h2>{group} is not in your plan</h2>
      <p>This part of the Back Office is included with the franchise plan. Your account can see that it exists; the screens stay closed until the plan includes it.</p>
      <Btn primary onClick={() => say('We would open the plans page')}>
        See the plans
      </Btn>
    </div>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="bo-sect">
      <h2>
        {title}
        {hint && <small>{hint}</small>}
      </h2>
      {children}
    </section>
  )
}
