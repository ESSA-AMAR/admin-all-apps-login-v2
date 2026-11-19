import {
  ArrowsClockwise,
  CashRegister,
  ChartBar,
  CookingPot,
  DeviceTablet,
  Heart,
  Package,
  ShoppingCart,
  UsersThree,
  CaretRight,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CountUp, DecodeText, ease } from '../components/ui'
import { cityById, industryById } from '../data/mock'
import type { Store } from '../data/types'
import { businessDay, consolidate, eur, randomTicket, storeKpis } from '../lib/kpis'
import { LEVEL_LABEL, storesLabel, type Breakdown } from '../lib/scope'
import type { ScopeLevel } from '../state'

const APPS: { id: string; name: string; desc: string; Glyph: Icon }[] = [
  { id: 'pos', name: 'POS', desc: 'Point of sale', Glyph: CashRegister },
  { id: 'kiosk', name: 'Kiosk', desc: 'Self-order', Glyph: DeviceTablet },
  { id: 'kds', name: 'KDS', desc: 'Kitchen display', Glyph: CookingPot },
  { id: 'inv', name: 'Inventory', desc: 'Stock & supply', Glyph: Package },
  { id: 'loy', name: 'Loyalty', desc: 'Customers & CRM', Glyph: Heart },
  { id: 'hr', name: 'Workforce', desc: 'Shifts & HR', Glyph: UsersThree },
  { id: 'rep', name: 'Reports', desc: 'Accounting', Glyph: ChartBar },
  { id: 'shop', name: 'E-shop', desc: 'Online orders', Glyph: ShoppingCart },
]

function Sparkline({ data, w = 120, h = 34 }: { data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`)
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      <motion.polyline
        points={pts.join(' ')}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease }}
      />
    </svg>
  )
}

function Delta({ v, pts, lowerIsBetter }: { v: number; /** a change in percentage points, for a ratio */ pts?: boolean; /** a rise is bad news (costs, losses): the colour flips, the arrow still follows the sign */ lowerIsBetter?: boolean }) {
  // Nothing moved: no arrow, no good or bad colour
  if (Math.abs(v) < 0.05) return <span className="delta">— 0.0{pts ? ' pts' : '%'}</span>
  const up = v >= 0
  const good = lowerIsBetter ? !up : up
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}
      {pts ? ' pts' : '%'}
    </span>
  )
}

function HourlyChart({ today, lastWeek }: { today: number[]; lastWeek: number[] }) {
  const W = 760
  const H = 260
  const P = { l: 44, r: 12, t: 16, b: 28 }
  const max = Math.max(...today, ...lastWeek, 1) * 1.1
  const x = (i: number) => P.l + (i / 23) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const curH = businessDay().hour
  const todayPts = today.map((v, i) => [x(i), y(v)] as const).filter((_, i) => i <= Math.floor(curH))
  const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')
  const lwPts = lastWeek.map((v, i) => [x(i), y(v)] as const)
  const area = todayPts.length ? `${line(todayPts)}L${todayPts[todayPts.length - 1][0]},${H - P.b}L${P.l},${H - P.b}Z` : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent2)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--accent2)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className="axis">
            {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={x(h)} y={H - 8} textAnchor="middle" className="axis">
          {String(h).padStart(2, '0')}h
        </text>
      ))}
      <motion.path
        d={line(lwPts)}
        className="line-ghost"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, ease }}
      />
      <motion.path d={area} fill="url(#area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }} />
      <motion.path
        d={line(todayPts)}
        className="line-main"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, delay: 0.2, ease }}
      />
      {todayPts.length > 0 && (
        <g transform={`translate(${todayPts[todayPts.length - 1][0]},${todayPts[todayPts.length - 1][1]})`}>
          <circle r="10" className="now-pulse" />
          <circle r="4" className="now-dot" />
        </g>
      )}
      <line x1={x(Math.min(curH, 23))} x2={x(Math.min(curH, 23))} y1={P.t} y2={H - P.b} className="now-line" />
    </svg>
  )
}

function Gauge({ value, target }: { value: number; target: number }) {
  const pct = Math.min(1, value / target)
  const R = 78
  const C = Math.PI * R * 1.5
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 180">
        <g transform="translate(100,100) rotate(135)">
          <circle r={R} className="gauge-track" strokeDasharray={`${C} 999`} />
          <motion.circle
            r={R}
            className="gauge-fill"
            strokeDasharray={`${C} 999`}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={{ duration: 2, ease }}
          />
          {Array.from({ length: 31 }, (_, i) => {
            const a = (i / 30) * Math.PI * 1.5
            return <line key={i} x1={Math.cos(a) * 92} y1={Math.sin(a) * 92} x2={Math.cos(a) * (i % 5 ? 96 : 100)} y2={Math.sin(a) * (i % 5 ? 96 : 100)} className="gauge-tick" />
          })}
        </g>
      </svg>
      <div className="gauge-center">
        <b>
          <CountUp value={pct * 100} format={(v) => `${Math.round(v)}%`} duration={2} />
        </b>
        <span className="label dim">of {eur(target)}</span>
      </div>
    </div>
  )
}

function Donut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  // Brand Book data colours: chart-aqua-blue, chart-coral-pink, archive-slate-blue, neutral-grey
  const colors = ['var(--accent2)', 'var(--cm-chart-coral)', 'var(--cm-archive-solid)', 'var(--cm-fg-faint)']
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140">
        <g transform="translate(70,70) rotate(-90)">
          {data.map((d, i) => {
            const len = (d.value / total) * C
            const off = acc
            acc += len
            return (
              <motion.circle
                key={d.label}
                r={R}
                fill="none"
                stroke={colors[i]}
                strokeWidth="14"
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${Math.max(0, len - 2)} ${C}` }}
                style={{ strokeDashoffset: -off }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease }}
              />
            )
          })}
        </g>
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.label}>
            <i style={{ background: colors[i] }} />
            {d.label}
            <b>{Math.round((d.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const card = (i: number) => ({
  initial: { opacity: 0, y: 30, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.7, delay: 0.15 + i * 0.07, ease },
})

function BreakdownTile({ b, onDrill, index }: { b: Breakdown; onDrill?: (key: string) => void; index: number }) {
  const max = Math.max(...b.rows.map((r) => r.revenue), 1)
  const total = b.rows.reduce((a, r) => a + r.revenue, 0) || 1
  return (
    <motion.section className="panel tile span-8 breakdown-tile" {...card(7 + index)}>
      <div className="tile-head">
        <h3>{b.title}</h3>
        <span className="label dim">{b.drill ? 'Select to drill down' : `${b.rows.length} groups`}</span>
      </div>
      <ul className="breakdown">
        {b.rows.map((r, i) => {
          const pct = r.target ? (r.revenue / r.target) * 100 : 0
          const body = (
            <>
              <span className="bd-rank label">{String(i + 1).padStart(2, '0')}</span>
              <span className="bd-name">
                <b>{r.label}</b>
                <small>
                  {r.sub ? `${r.sub} · ` : ''}
                  {storesLabel(r.storeCount)} · {r.online}/{r.storeCount} online
                </small>
              </span>
              <span className="bd-bar">
                <motion.i initial={{ width: 0 }} animate={{ width: `${(r.revenue / max) * 100}%` }} transition={{ duration: 1.1, delay: 0.4 + i * 0.06, ease }} />
              </span>
              <span className="bd-figs">
                <b>{eur(r.revenue)}</b>
                <small>
                  {Math.round((r.revenue / total) * 100)}% share · {Math.round(pct)}% of target
                </small>
              </span>
              <Delta v={r.delta} />
              {onDrill && <CaretRight size={16} weight="bold" className="bd-go" />}
            </>
          )
          return (
            <li key={r.key}>
              {onDrill ? (
                <button className="bd-row" onClick={() => onDrill(r.key)}>
                  {body}
                </button>
              ) : (
                <div className="bd-row">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}

export interface DashboardScope {
  level: ScopeLevel
  name: string
  /** Path above this scope, e.g. ["CMH", "Hospitality", "Crusty"]. */
  path: string[]
  icon: ReactNode
}

interface Props {
  scope: DashboardScope
  stores: Store[]
  breakdowns: Breakdown[]
  onDrill: (b: Breakdown, key: string) => void
  /** Store level only: go back to the store picker. */
  onSwitch?: () => void
}

export function Dashboard({ scope, stores, breakdowns, onDrill, onSwitch }: Props) {
  const isStore = scope.level === 'store'
  const store = isStore ? stores[0] : null
  const base = useMemo(() => consolidate(stores), [stores])
  const storeDetail = useMemo(() => (store ? storeKpis(store) : null), [store])
  const industries = useMemo(() => new Set(stores.map((s) => s.industry)), [stores])
  const [live, setLive] = useState({ revenue: base.revenueToday, tx: base.transactions })
  const [feed, setFeed] = useState(() => seedFeed(stores))
  const [clock, setClock] = useState(new Date())
  const [launched, setLaunched] = useState<string | null>(null)

  useEffect(() => {
    const live = stores.filter((s) => s.status !== 'offline')
    if (!live.length) return
    let id: number
    // More stores in scope → more tickets per second.
    const pace = Math.max(450, 3600 / Math.sqrt(live.length))
    const tick = () => {
      const s = live[Math.floor(Math.random() * live.length)]
      const t = { ...randomTicket(s), store: s.name }
      setFeed((f) => [t, ...f].slice(0, 7))
      setLive((l) => ({ revenue: l.revenue + t.amount, tx: l.tx + 1 }))
      id = window.setTimeout(tick, pace * (0.6 + Math.random() * 0.8))
    }
    id = window.setTimeout(tick, 1500)
    return () => window.clearTimeout(id)
  }, [stores])

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!launched) return
    const t = setTimeout(() => setLaunched(null), 2200)
    return () => clearTimeout(t)
  }, [launched])

  const avg = live.tx ? live.revenue / live.tx : 0
  const maxProduct = Math.max(...base.topProducts.map((p) => p.revenue), 1)
  const industry = industries.size === 1 ? industryById([...industries][0]) : null

  const kpis = [
    { label: 'Revenue today', value: live.revenue, fmt: (v: number) => eur(v), delta: base.deltas.revenue, spark: base.hourly },
    { label: 'Transactions', value: live.tx, fmt: (v: number) => Math.round(v).toLocaleString('fr-BE'), delta: base.deltas.transactions, spark: base.hourly.map((v) => v / (base.avgBasket || 1)) },
    { label: 'Average basket', value: avg, fmt: (v: number) => eur(v, 2), delta: base.deltas.basket, spark: base.hourlyLastWeek },
    { label: 'Customers', value: base.customers, fmt: (v: number) => Math.round(v).toLocaleString('fr-BE'), delta: base.deltas.customers, spark: base.hourly.map((v, i) => v * (0.8 + ((i * 7) % 5) / 10)) },
  ]

  // Profit and control: how much we keep, and what leaks. Percentages in the French format, signed where it is a growth.
  const pct1 = (v: number) => `${v.toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
  const signed1 = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
  const ctl = base.control
  const controlKpis: { label: string; hint: string; value: number; fmt: (v: number) => string; foot: ReactNode }[] = [
    {
      label: 'Like-for-like sales',
      hint: 'Sales growth on the same outlets, against the same day last year. New openings do not count.',
      value: ctl.lfl,
      fmt: signed1,
      foot: (
        <>
          <span className={`delta ${ctl.lfl >= 0 ? 'up' : 'down'}`}>{ctl.lfl >= 0 ? '▲' : '▼'}</span>
          <span className="label dim">same outlets · vs last year</span>
        </>
      ),
    },
    {
      label: 'Prime cost',
      hint: 'Product cost plus labour, as a share of sales. Lower is better.',
      value: ctl.primeCost,
      fmt: pct1,
      foot: (
        <>
          <Delta v={ctl.primeCostDelta} pts lowerIsBetter />
          <span className="label dim">of sales · vs last wk</span>
        </>
      ),
    },
    {
      label: 'Loss',
      hint: 'Voids, refunds and discounts, as a share of sales. Lower is better.',
      value: ctl.loss,
      fmt: pct1,
      foot: (
        <>
          <Delta v={ctl.lossDelta} pts lowerIsBetter />
          <span className="label dim">of sales · vs last wk</span>
        </>
      ),
    },
  ]

  const allOnline = !store && base.status.online === stores.length
  const where = store ? `${store.address}, ${cityById(store.cityId).name} · ${store.terminals} terminals · since ${store.openedYear}` : null
  const countries = new Set(stores.map((s) => s.countryId)).size

  return (
    <div className="dash">
      <motion.header className="dash-head" {...card(0)}>
        <div className="dash-title">
          <span className="dash-icon">{scope.icon}</span>
          <div>
            <h1>
              <DecodeText text={scope.name} speed={22} />
            </h1>
            <div className="dash-sub">
              {/* Everything fine: plain text, no dot, no green. Colour and a dot only when something is not online. */}
              {store
                ? store.status !== 'online' && <span className={`status ${store.status}`}>{store.status}</span>
                : !allOnline && (
                    <span className={`status ${base.status.offline ? 'offline' : 'degraded'}`}>
                      {base.status.online}/{stores.length} online
                    </span>
                  )}
              <span className="label dim">
                {where
                  ? `${store?.status === 'online' ? 'Online · ' : ''}${where}`
                  : `${storesLabel(stores.length)}${allOnline ? ' online' : ''} · ${countries} ${countries === 1 ? 'country' : 'countries'} · ${base.terminals.total} terminals`}
              </span>
            </div>
          </div>
        </div>
        <div className="dash-actions">
          <div className="clock label">
            <b>{clock.toLocaleTimeString('fr-BE')}</b>
            <span className="dim">{clock.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          {onSwitch && (
            <button className="btn-ghost" onClick={onSwitch}>
              <ArrowsClockwise size={16} weight="bold" /> Switch store
            </button>
          )}
        </div>
      </motion.header>

      <motion.section className="apps-dock" {...card(1)}>
        <span className="label dim dock-label">ECOSYSTEM APPS</span>
        <div className="apps">
          {APPS.filter((a) => a.id !== 'kds' || industries.has('hospitality')).map((a, i) => (
            <motion.button
              key={a.id}
              className={`app-tile ${launched === a.id ? 'launching' : ''}`}
              onClick={() => setLaunched(a.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.05, duration: 0.5, ease }}
            >
              <a.Glyph size={22} weight="duotone" />
              <span>
                <b>{a.name}</b>
                <small>{a.desc}</small>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      <div className="kpi-row">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="kpi" {...card(2 + i)}>
            <span className="kpi-label label">{k.label}</span>
            <b className="kpi-value">
              <CountUp value={k.value} format={k.fmt} />
            </b>
            <div className="kpi-foot">
              <Delta v={k.delta} />
              <span className="label dim">vs last wk</span>
            </div>
            <Sparkline data={k.spark} />
          </motion.div>
        ))}
      </div>

      <div className="kpi-row kpi-row-3">
        {controlKpis.map((k, i) => (
          <motion.div key={k.label} className="kpi" title={k.hint} {...card(6 + i)}>
            <span className="kpi-label label">{k.label}</span>
            <b className="kpi-value">
              <CountUp value={k.value} format={k.fmt} />
            </b>
            <div className="kpi-foot">{k.foot}</div>
          </motion.div>
        ))}
      </div>

      <div className="dash-grid">
        <motion.section className="panel tile span-8" {...card(6)}>
          <div className="tile-head">
            <h3>Revenue by hour</h3>
            <div className="chart-legend label">
              <span>
                <i className="lg-main" /> Today
              </span>
              <span>
                <i className="lg-ghost" /> Same day last week
              </span>
            </div>
          </div>
          <HourlyChart today={base.hourly} lastWeek={base.hourlyLastWeek} />
        </motion.section>

        <motion.section className="panel tile span-4" {...card(7)}>
          <div className="tile-head">
            <h3>Daily target</h3>
            <span className="label dim">{isStore ? 'Store' : 'Consolidated'}</span>
          </div>
          <Gauge value={live.revenue} target={base.target} />
        </motion.section>

        {breakdowns[0] && <BreakdownTile b={breakdowns[0]} index={0} onDrill={breakdowns[0].drill ? (key) => onDrill(breakdowns[0], key) : undefined} />}

        {!isStore && (
          <motion.section className="panel tile span-4 health-tile" {...card(8)}>
            <div className="tile-head">
              <h3>Network health</h3>
              <span className="label dim">
                {base.terminals.online}/{base.terminals.total} terminals
              </span>
            </div>
            <div className="health">
              {(['online', 'degraded', 'offline'] as const).map((st) => (
                <div key={st} className={`health-cell ${st}`}>
                  <b>
                    <CountUp value={base.status[st]} />
                  </b>
                  <span className={`status ${st}`}>{st}</span>
                </div>
              ))}
            </div>
            <div className="health-bar">
              {(['online', 'degraded', 'offline'] as const).map((st) => (
                <motion.i
                  key={st}
                  className={st}
                  initial={{ width: 0 }}
                  animate={{ width: `${(base.status[st] / stores.length) * 100}%` }}
                  transition={{ duration: 1, delay: 0.5, ease }}
                />
              ))}
            </div>
            <span className="label dim sub-head">Needs attention</span>
            <ul className="alerts">
              {stores
                .filter((s) => s.status !== 'online')
                .slice(0, 5)
                .map((s) => (
                  <li key={s.id}>
                    <WarningCircle size={16} weight="fill" className={s.status} />
                    <span>
                      <b>{s.name}</b>
                      <small className="dim">{s.address}</small>
                    </span>
                    <span className={`status ${s.status}`}>{s.status}</span>
                  </li>
                ))}
              {base.status.online === stores.length && <li className="dim">All stores operational</li>}
            </ul>
          </motion.section>
        )}

        <motion.section className="panel tile span-4 feed-tile" {...card(9)}>
          <div className="tile-head">
            <h3>Live transactions</h3>
            <span className="label live-tag">
              <i className="dot live" /> {store?.status === 'offline' ? 'OFFLINE' : 'STREAMING'}
            </span>
          </div>
          <ul className="feed">
            <AnimatePresence initial={false}>
              {feed.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(255,255,255,0.12)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255,255,255,0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="label dim">{t.at.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="feed-item">
                    {t.qty}× {t.item}
                    <small className="label dim">{isStore ? `#${t.id} · ${t.terminal} · ${t.method}` : `${t.store} · ${t.method}`}</small>
                  </span>
                  <b>{eur(t.amount, 2)}</b>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>

        <motion.section className="panel tile span-4" {...card(10)}>
          <div className="tile-head">
            <h3>Top products</h3>
          </div>
          <ul className="bars">
            {base.topProducts.map((p, i) => (
              <li key={p.name}>
                <span className="bar-label">
                  {p.name}
                  <small className="label dim">{p.qty} sold</small>
                </span>
                <span className="bar-track">
                  <motion.i initial={{ width: 0 }} animate={{ width: `${(p.revenue / maxProduct) * 100}%` }} transition={{ duration: 1.2, delay: 0.5 + i * 0.1, ease }} />
                </span>
                <b>{eur(p.revenue)}</b>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-4" {...card(11)}>
          <div className="tile-head">
            <h3>Payment mix</h3>
          </div>
          <Donut data={base.paymentMix} />
        </motion.section>

        {base.industry && industry && (
          <motion.section className="panel tile span-4" {...card(12)}>
            <div className="tile-head">
              <h3>{industry.name} metrics</h3>
              <span className="label dim">{isStore ? 'Store' : 'Consolidated'}</span>
            </div>
            <div className="ind-kpis">
              {base.industry.map((k) => (
                <div key={k.label} className="ind-kpi">
                  <span className="label dim">{k.label}</span>
                  <b>
                    <CountUp value={k.value} format={(v) => `${v.toFixed(k.decimals ?? 0)}${k.unit ? ` ${k.unit}` : ''}`} />
                  </b>
                  <Delta v={k.delta} />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {breakdowns[1] && <BreakdownTile b={breakdowns[1]} index={1} onDrill={breakdowns[1].drill ? (key) => onDrill(breakdowns[1], key) : undefined} />}

        {storeDetail && (
          <motion.section className="panel tile span-8" {...card(13)}>
            <div className="tile-head">
              <h3>Store floor</h3>
              <span className="label dim">
                {storeDetail.terminals.filter((t) => t.status === 'online').length}/{storeDetail.terminals.length} terminals online
              </span>
            </div>
            <div className="floor">
              <div className="terminals">
                {storeDetail.terminals.map((t) => (
                  <div key={t.id} className={`terminal ${t.status}`}>
                    <i />
                    <b className="label">{t.id}</b>
                    <small>{t.app}</small>
                  </div>
                ))}
              </div>
              <ul className="staff">
                {storeDetail.staff.map((s) => (
                  <li key={s.name + s.role}>
                    <span className="avatar">{s.name.split(' ').map((p) => p[0]).join('')}</span>
                    <span>
                      <b>{s.name}</b>
                      <small className="dim">{s.role}</small>
                    </span>
                    <span className="label dim">since {s.since}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}
      </div>

      <AnimatePresence>
        {launched && (
          <motion.div className="toast" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <span className="spinner" />
            <span>
              Launching <b>{APPS.find((a) => a.id === launched)?.name}</b> for {scope.name}…
              <small className="label dim">Single sign-on token forwarded · scope {LEVEL_LABEL[scope.level].toLowerCase()}</small>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function seedFeed(stores: Store[]) {
  const pool = stores.filter((s) => s.status !== 'offline')
  if (!pool.length) return []
  return Array.from({ length: 5 }, (_, i) => {
    const s = pool[i % pool.length]
    return { ...randomTicket(s), store: s.name, at: new Date(Date.now() - (i + 1) * 47000) }
  })
}
