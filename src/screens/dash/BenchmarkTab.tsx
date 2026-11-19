/** Benchmark: each brand (or the outlet) ranked by industry and by city against the Caisse Manager network, and whether it is in the safe or the danger zone. */
import { CheckCircle, MapPin, ShieldCheck, ShieldWarning, Trophy, WarningOctagon, XCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { ease } from '../../components/ui'
import type { Store } from '../../data/types'
import { eur } from '../../lib/kpis'
import { benchmark, METRICS, type BenchUnit, type MetricKey, type Zone } from '../../lib/insights'
import { ZoneBar, ZonePill } from './charts'
import { num, pct, signed } from './format'

const card = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.05 + i * 0.05, ease },
})

const fmt: Record<MetricKey, (v: number) => string> = {
  growth: (v) => signed(v, 1),
  perOutlet: (v) => eur(v),
  basket: (v) => eur(v, 2),
  rating: (v) => `${num(v, 2)} ★`,
  primeCost: (v) => pct(v, 1),
  loss: (v) => pct(v, 1),
}

const ZONE_ICON: Record<Zone, typeof ShieldCheck> = { safe: ShieldCheck, watch: ShieldWarning, danger: WarningOctagon }

/** Why the unit is where it is: its best and its weakest metric against the median. */
function reasons(u: BenchUnit) {
  const rel = METRICS.filter((m) => m.weight).map((m) => {
    const med = u.median[m.key] || 1
    const diff = ((u.metrics[m.key] - med) / Math.abs(med)) * (m.better === 'up' ? 1 : -1)
    return { ...m, diff }
  })
  rel.sort((a, b) => b.diff - a.diff)
  return { best: rel[0], worst: rel[rel.length - 1] }
}

export function BenchmarkTab({ stores }: { stores: Store[] }) {
  const units = useMemo(() => benchmark(stores), [stores])
  const [sel, setSel] = useState<string | null>(null)
  const u = units.find((x) => x.id === sel) ?? units[0]
  if (!u) return null
  const counts = { safe: units.filter((x) => x.zone === 'safe').length, watch: units.filter((x) => x.zone === 'watch').length, danger: units.filter((x) => x.zone === 'danger').length }
  const { best, worst } = reasons(u)
  const Icon = ZONE_ICON[u.zone]
  const multi = units.length > 1

  return (
    <div className="dt-tab">
      <div className="dt-tab-head">
        <p className="label dim">
          Compared with {u.kind === 'brand' ? 'brands' : 'outlets'} of the same industry across the Caisse Manager network, over the last 30 days · other clients stay anonymous
        </p>
      </div>

      <div className="kpi-row">
        {multi ? (
          <>
            {(['safe', 'watch', 'danger'] as const).map((z, i) => {
              const ZI = ZONE_ICON[z]
              return (
                <motion.div key={z} className={`kpi dt-zone-kpi ${z}`} {...card(i)}>
                  <span className="kpi-label label">{z === 'safe' ? 'Safe zone' : z === 'watch' ? 'Watch' : 'Danger zone'}</span>
                  <b className="kpi-value">{counts[z]}</b>
                  <div className="kpi-foot">
                    <ZI size={14} weight="fill" aria-hidden />
                    <span className="label dim">{counts[z] === 1 ? 'brand' : 'brands'}</span>
                  </div>
                </motion.div>
              )
            })}
            <motion.div className="kpi" {...card(3)}>
              <span className="kpi-label label">Best placed</span>
              <b className="kpi-value dt-kpi-text">{[...units].sort((a, b) => b.score - a.score)[0].name}</b>
              <div className="kpi-foot">
                <Trophy size={14} aria-hidden />
                <span className="label dim">
                  #{[...units].sort((a, b) => b.score - a.score)[0].industryRank.rank} in its industry
                </span>
              </div>
            </motion.div>
          </>
        ) : (
          <>
            <motion.div className="kpi" {...card(0)}>
              <span className="kpi-label label">Score</span>
              <b className="kpi-value">{u.score} / 100</b>
              <div className="kpi-foot">
                <ZonePill zone={u.zone} />
              </div>
            </motion.div>
            <motion.div className="kpi" {...card(1)}>
              <span className="kpi-label label">Industry rank</span>
              <b className="kpi-value">
                #{u.industryRank.rank} <small>of {u.industryRank.of}</small>
              </b>
              <div className="kpi-foot">
                <span className="label dim">{u.industryRank.label}</span>
              </div>
            </motion.div>
            <motion.div className="kpi" {...card(2)}>
              <span className="kpi-label label">City rank</span>
              <b className="kpi-value">
                #{u.cityRanks[0]?.rank ?? '—'} <small>of {u.cityRanks[0]?.of ?? '—'}</small>
              </b>
              <div className="kpi-foot">
                <span className="label dim">{u.cityRanks[0]?.label}</span>
              </div>
            </motion.div>
            <motion.div className="kpi" {...card(3)}>
              <span className="kpi-label label">{u.brandRank ? 'In its brand' : 'Outlets'}</span>
              <b className="kpi-value">{u.brandRank ? <>#{u.brandRank.rank} <small>of {u.brandRank.of}</small></> : u.outlets}</b>
              <div className="kpi-foot">
                <span className="label dim">{u.brandRank ? u.brandRank.label : 'compared together'}</span>
              </div>
            </motion.div>
          </>
        )}
      </div>

      <div className="dash-grid">
        <motion.section className="panel tile span-4" {...card(4)}>
          <div className="tile-head">
            <h3>{u.kind === 'brand' ? 'Your brands' : 'This outlet'}</h3>
            <span className="label dim">Weakest first</span>
          </div>
          <ul className="dt-units">
            {units.map((x) => (
              <li key={x.id}>
                <button className={x.id === u.id ? 'on' : ''} onClick={() => setSel(x.id)} aria-pressed={x.id === u.id}>
                  <span className="dt-unit-name">
                    <b>{x.name}</b>
                    <small>
                      #{x.industryRank.rank} of {x.industryRank.of} · {x.outlets} {x.outlets === 1 ? 'outlet' : 'outlets'}
                    </small>
                  </span>
                  <span className="dt-unit-score">{x.score}</span>
                  <ZonePill zone={x.zone} />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-8" {...card(5)}>
          <div className="tile-head">
            <h3>{u.name}</h3>
            <span className={`dt-zone big ${u.zone}`}>
              <Icon size={15} weight="fill" aria-hidden /> {u.zone === 'safe' ? 'Safe zone' : u.zone === 'watch' ? 'Watch' : 'Danger zone'} · {u.score}/100
            </span>
          </div>
          <ZoneBar score={u.score} />
          <p className="dt-note">
            Strongest on <b>{best.label.toLowerCase()}</b> ({fmt[best.key](u.metrics[best.key])} against a median of {fmt[best.key](u.median[best.key])}); weakest on{' '}
            <b>{worst.label.toLowerCase()}</b> ({fmt[worst.key](u.metrics[worst.key])} against {fmt[worst.key](u.median[worst.key])}).
          </p>
          <div className="dt-table-wrap">
            <table className="dt-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="num">{u.kind === 'brand' ? 'This brand' : 'This outlet'}</th>
                  <th className="num">Median</th>
                  <th className="num">Top 25 %</th>
                  <th className="num">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const v = u.metrics[m.key]
                  const beatsMed = m.better === 'up' ? v >= u.median[m.key] : v <= u.median[m.key]
                  const beatsTop = m.better === 'up' ? v >= u.top[m.key] : v <= u.top[m.key]
                  return (
                    <tr key={m.key}>
                      <td>
                        <b>{m.label}</b>
                        {!m.weight && <small className="dim"> · not scored</small>}
                      </td>
                      <td className="num">
                        <b>{fmt[m.key](v)}</b>
                      </td>
                      <td className="num dim">{fmt[m.key](u.median[m.key])}</td>
                      <td className="num dim">{fmt[m.key](u.top[m.key])}</td>
                      <td className="num">
                        <span className={`dt-verdict ${beatsTop ? 'top' : beatsMed ? 'ok' : 'bad'}`}>
                          {beatsMed ? <CheckCircle size={13} weight="fill" aria-hidden /> : <XCircle size={13} weight="fill" aria-hidden />}
                          {beatsTop ? 'Top 25 %' : beatsMed ? 'Above median' : 'Below median'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        <motion.section className="panel tile span-4" {...card(6)}>
          <div className="tile-head">
            <h3>Industry ranking</h3>
            <span className="label dim">{u.industryRank.label}</span>
          </div>
          <ol className="dt-board">
            {u.board.map((p) => (
              <li key={`${p.rank}-${p.name}`} className={p.own ? 'own' : ''}>
                <span className="dt-board-rank">{p.rank}</span>
                <span className="dt-board-name">{p.name}</span>
                <span className="dt-board-bar">
                  <i className={p.zone} style={{ width: `${p.score}%` }} />
                </span>
                <b>{p.score}</b>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section className="panel tile span-8" {...card(7)}>
          <div className="tile-head">
            <h3>Ranking by city</h3>
            <span className="label dim">Same industry, same city</span>
          </div>
          <ul className="dt-cities">
            {u.cityRanks.map((c) => (
              <li key={c.label}>
                <MapPin size={16} aria-hidden />
                <span className="dt-city-name">
                  <b>{c.label}</b>
                  <small>
                    #{c.rank} of {c.of}
                  </small>
                </span>
                <span className="dt-city-pos" aria-hidden>
                  {Array.from({ length: c.of }, (_, i) => (
                    <i key={i} className={i + 1 === c.rank ? `me ${c.zone}` : ''} />
                  ))}
                </span>
                <ZonePill zone={c.zone} />
              </li>
            ))}
          </ul>
        </motion.section>
      </div>
    </div>
  )
}
