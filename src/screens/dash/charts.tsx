/** Small charts and controls shared by the first page's tabs. Colours come from the theme, so Dark and Light both work. */
import { Star, StarHalf } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { ease } from '../../components/ui'
import { eur } from '../../lib/kpis'
import { DAYS, type Zone } from '../../lib/insights'
import { num, pts, signed } from './format'

/** Growth with an arrow; red when it goes the wrong way. Never colour alone: the sign and the arrow carry it too. */
export function Trend({ v, unit = '%', lowerIsBetter, d = 1 }: { v: number; unit?: '%' | 'pts'; lowerIsBetter?: boolean; d?: number }) {
  // Below what the shown decimals can say, it did not move: no arrow, no colour.
  if (Math.abs(v) < 0.5 * 10 ** -d) return <span className="delta">— 0{unit === 'pts' ? ' pts' : ' %'}</span>
  const up = v > 0
  const good = lowerIsBetter ? !up : up
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {unit === 'pts' ? pts(v, d).slice(1) : signed(v, d).slice(1)}
    </span>
  )
}

/** A segmented switch: the range of a tab, a filter. */
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="dt-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Sales per day: one bar a day, the three busiest in red. */
export function DayBars({ days }: { days: { date: Date; revenue: number }[] }) {
  const W = 760
  const H = 220
  const P = { l: 46, r: 8, t: 12, b: 28 }
  const max = Math.max(...days.map((d) => d.revenue), 1) * 1.08
  const bw = (W - P.l - P.r) / days.length
  const top3 = new Set([...days].sort((a, b) => b.revenue - a.revenue).slice(0, 3).map((d) => d.date.getTime()))
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const every = days.length <= 7 ? 1 : days.length <= 30 ? 5 : 15
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart dt-days" preserveAspectRatio="none" role="img" aria-label="Sales per day">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t * max)} y2={y(t * max)} className="grid-line" />
          <text x={P.l - 8} y={y(t * max) + 4} textAnchor="end" className="axis">
            {t ? `${num((t * max) / 1000, 0)}k` : '0'}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const h = H - P.b - y(d.revenue)
        const peak = top3.has(d.date.getTime())
        return (
          <g key={d.date.getTime()}>
            <motion.rect
              x={P.l + i * bw + bw * 0.14}
              y={y(d.revenue)}
              width={Math.max(1, bw * 0.72)}
              height={h}
              rx={Math.min(3, bw * 0.2)}
              className={peak ? 'dt-bar peak' : 'dt-bar'}
              style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.1 + i * (0.5 / days.length), ease }}
            >
              <title>{`${d.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${eur(d.revenue)}`}</title>
            </motion.rect>
            {(days.length - 1 - i) % every === 0 && (
              <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="axis">
                {days.length <= 7 ? DAYS[(d.date.getDay() + 6) % 7] : d.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Weekday × hour: when the sales come in. The busiest slot is outlined. */
export function Heatmap({ heat, peak }: { heat: number[][]; peak: { dow: number; h: number } }) {
  const totals = Array.from({ length: 24 }, (_, h) => heat.reduce((a, row) => a + row[h], 0))
  const max = Math.max(...heat.flat(), 1)
  const open = totals.map((t) => t > Math.max(...totals) * 0.02)
  const first = open.indexOf(true)
  const last = open.lastIndexOf(true)
  const hours = first < 0 ? [] : Array.from({ length: last - first + 1 }, (_, i) => first + i)
  return (
    <div className="dt-heat" style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(0, 1fr))` }} role="img" aria-label="Sales by weekday and hour">
      {heat.map((row, dow) => (
        <div key={dow} className="dt-heat-row">
          <span className="dt-heat-day">{DAYS[dow]}</span>
          {hours.map((h) => {
            const v = row[h] / max
            return (
              <i
                key={h}
                className={peak.dow === dow && peak.h === h ? 'peak' : ''}
                style={{ background: `color-mix(in srgb, var(--accent2) ${Math.round(6 + v * 88)}%, transparent)` }}
                title={`${DAYS[dow]} ${String(h).padStart(2, '0')}:00 · ${eur(row[h])} on average`}
              />
            )
          })}
        </div>
      ))}
      <div className="dt-heat-row dt-heat-axis">
        <span />
        {hours.map((h) => (
          <span key={h}>{h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** Two lines over the same days (store and online). */
export function TwoLines({ a, b, labels }: { a: number[]; b: number[]; labels: [string, string] }) {
  const W = 760
  const H = 200
  const P = { l: 46, r: 10, t: 12, b: 16 }
  const max = Math.max(...a, ...b, 1) * 1.1
  const x = (i: number) => P.l + (i / Math.max(1, a.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart dt-lines" preserveAspectRatio="none" role="img" aria-label={`${labels[0]} and ${labels[1]} per day`}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t * max)} y2={y(t * max)} className="grid-line" />
          <text x={P.l - 8} y={y(t * max) + 4} textAnchor="end" className="axis">
            {t ? `${num((t * max) / 1000, 0)}k` : '0'}
          </text>
        </g>
      ))}
      <motion.path d={path(a)} className="dt-line a" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease }} />
      <motion.path d={path(b)} className="dt-line b" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.2, ease }} />
    </svg>
  )
}

/** Danger 0–39, watch 40–59, safe 60–100, with a marker at the score. */
export function ZoneBar({ score }: { score: number }) {
  return (
    <div className="dt-zonebar" role="img" aria-label={`Score ${score} out of 100`}>
      <div className="dt-zonebar-track">
        <i className="danger" style={{ width: '40%' }} />
        <i className="watch" style={{ width: '20%' }} />
        <i className="safe" style={{ width: '40%' }} />
        <motion.b initial={{ left: '0%' }} animate={{ left: `${score}%` }} transition={{ duration: 1.1, ease }} />
      </div>
      <div className="dt-zonebar-legend">
        <span>Danger · 0–39</span>
        <span>Watch · 40–59</span>
        <span>Safe · 60–100</span>
      </div>
    </div>
  )
}

/** The zone as a pill: an icon-free label plus its colour dot, never colour alone. */
export function ZonePill({ zone, label }: { zone: Zone; label?: string }) {
  return <span className={`dt-zone ${zone}`}>{label ?? (zone === 'safe' ? 'Safe zone' : zone === 'watch' ? 'Watch' : 'Danger zone')}</span>
}

/** Five stars, with halves. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="dt-stars" aria-label={`${num(value, 1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) =>
        value >= i - 0.25 ? (
          <Star key={i} size={size} weight="fill" aria-hidden />
        ) : value >= i - 0.75 ? (
          <StarHalf key={i} size={size} weight="fill" aria-hidden />
        ) : (
          <Star key={i} size={size} weight="regular" className="off" aria-hidden />
        ),
      )}
    </span>
  )
}
