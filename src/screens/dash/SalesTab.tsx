/** Sales: days, hours and time frames (to see the peak days), menu products, best sellers, online against store orders. */
import { CalendarBlank, Clock, Crown, Moon, Storefront, Globe, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { CountUp, ease } from '../../components/ui'
import type { Store } from '../../data/types'
import { eur } from '../../lib/kpis'
import { DAYS_LONG, hourRange, RANGES, salesInsights, type Range } from '../../lib/insights'
import { DayBars, Heatmap, Seg, Trend, TwoLines } from './charts'
import { money, num, pct, signed } from './format'

const card = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.05 + i * 0.05, ease },
})

export function SalesTab({ stores, range, onRange }: { stores: Store[]; range: Range; onRange: (r: Range) => void }) {
  const s = useMemo(() => salesInsights(stores, range), [stores, range])
  const [cat, setCat] = useState<string>('all')
  const products = cat === 'all' ? s.products : s.products.filter((p) => p.category === cat)
  const best = [...s.products].sort((a, b) => b.qty - a.qty).slice(0, 5)
  const maxPart = Math.max(...s.dayparts.map((d) => d.revenue), 1)
  const bestPart = s.dayparts.reduce((a, b) => (b.revenue > a.revenue ? b : a), s.dayparts[0])
  const maxProduct = Math.max(...products.map((p) => p.revenue), 1)
  const ch = s.channels
  const storeSources = ch.sources.filter((x) => x.group === 'store')
  const onlineSources = ch.sources.filter((x) => x.group === 'online')
  const maxSource = Math.max(...ch.sources.map((x) => x.share), 1)

  const kpis = [
    { label: 'Sales', value: s.total, fmt: money, trend: s.growth },
    { label: 'Orders', value: s.orders, fmt: (v: number) => num(v), trend: s.ordersGrowth },
    { label: 'Average basket', value: s.basket, fmt: (v: number) => eur(v, 2), trend: s.basketGrowth },
    { label: 'Online share', value: s.onlineShare, fmt: (v: number) => pct(v, 1), trend: s.onlineShareDelta, unit: 'pts' as const },
  ]

  return (
    <div className="dt-tab">
      <div className="dt-tab-head">
        <p className="label dim">Last {range} days, ending yesterday · compared with the {range} days before</p>
        <Seg label="Period" value={range} options={RANGES.map((r) => ({ id: r, label: `${r} days` }))} onChange={onRange} />
      </div>

      <div className="kpi-row">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="kpi" {...card(i)}>
            <span className="kpi-label label">{k.label}</span>
            <b className="kpi-value">
              <CountUp value={k.value} format={k.fmt} />
            </b>
            <div className="kpi-foot">
              <Trend v={k.trend} unit={k.unit} />
              <span className="label dim">vs previous {range} days</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="dash-grid">
        <motion.section className="panel tile span-8" {...card(4)}>
          <div className="tile-head">
            <h3>Sales by day</h3>
            <span className="label dim">The 3 busiest days in red</span>
          </div>
          <DayBars days={s.days} />
        </motion.section>

        <motion.section className="panel tile span-4" {...card(5)}>
          <div className="tile-head">
            <h3>Peak times</h3>
            <span className="label dim">Average week</span>
          </div>
          <ul className="dt-facts">
            <li>
              <CalendarBlank size={20} aria-hidden />
              <span>
                <small>Busiest day</small>
                <b>{DAYS_LONG[s.peakDay.dow]}</b>
              </span>
              <em className="up">{signed(s.peakDay.lift, 0)}</em>
            </li>
            <li>
              <Moon size={20} aria-hidden />
              <span>
                <small>Quietest day</small>
                <b>{DAYS_LONG[s.quietDay.dow]}</b>
              </span>
              <em className="down">{signed(s.quietDay.lift, 0)}</em>
            </li>
            <li>
              <Clock size={20} aria-hidden />
              <span>
                <small>Peak hour</small>
                <b>{hourRange(s.peakHour)}</b>
              </span>
              <em>every day</em>
            </li>
            <li>
              <TrendUp size={20} aria-hidden />
              <span>
                <small>Busiest slot of the week</small>
                <b>
                  {DAYS_LONG[s.peakSlot.dow]} {hourRange(s.peakSlot.h)}
                </b>
              </span>
              <em>{eur(s.peakSlot.value)}</em>
            </li>
          </ul>
          <p className="dt-note">
            {DAYS_LONG[s.peakDay.dow]} sells {signed(s.peakDay.lift, 0)} more than an average day. Plan staff and stock for it, and use {DAYS_LONG[s.quietDay.dow]} for offers.
          </p>
        </motion.section>

        <motion.section className="panel tile span-8" {...card(6)}>
          <div className="tile-head">
            <h3>Day × hour</h3>
            <span className="label dim">Average sales per hour · the busiest slot outlined</span>
          </div>
          <Heatmap heat={s.heat} peak={s.peakSlot} />
        </motion.section>

        <motion.section className="panel tile span-4" {...card(7)}>
          <div className="tile-head">
            <h3>Time frames</h3>
            <span className="label dim">Best: {bestPart?.label}</span>
          </div>
          <ul className="dt-parts">
            {s.dayparts.map((d, i) => (
              <li key={d.id}>
                <span className="dt-parts-name">
                  <b>{d.label}</b>
                  <small>
                    {String(d.from).padStart(2, '0')}:00–{String(d.to).padStart(2, '0')}:00
                  </small>
                </span>
                <span className="bar-track">
                  <motion.i initial={{ width: 0 }} animate={{ width: `${(d.revenue / maxPart) * 100}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }} />
                </span>
                <span className="dt-parts-figs">
                  <b>{pct(d.share)}</b>
                  <small>
                    {num(d.orders)} orders · {eur(d.basket, 2)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-8" {...card(8)}>
          <div className="tile-head">
            <h3>Online and store orders</h3>
            <div className="chart-legend label">
              <span>
                <i className="lg-main" /> In store
              </span>
              <span>
                <i className="lg-coral" /> Online
              </span>
            </div>
          </div>
          <div className="dt-split">
            {(
              [
                ['In store', Storefront, ch.store],
                ['Online', Globe, ch.online],
              ] as const
            ).map(([label, Icon, c]) => (
              <div key={label} className="dt-split-cell">
                <span className="dt-split-head">
                  <Icon size={18} aria-hidden /> {label}
                  <em>{pct(s.total ? (c.revenue / s.total) * 100 : 0)}</em>
                </span>
                <b>{money(c.revenue)}</b>
                <span className="dt-split-meta">
                  <Trend v={c.growth} /> <span className="label dim">vs previous {range} days</span>
                </span>
                <small>
                  {num(c.orders)} orders · basket {eur(c.basket, 2)}
                </small>
              </div>
            ))}
          </div>
          <TwoLines a={s.days.map((d) => d.revenue - d.online)} b={s.days.map((d) => d.online)} labels={['In store', 'Online']} />
        </motion.section>

        <motion.section className="panel tile span-4" {...card(9)}>
          <div className="tile-head">
            <h3>Where orders come from</h3>
          </div>
          {(
            [
              ['In store', storeSources],
              ['Online', onlineSources],
            ] as const
          ).map(([group, list]) => (
            <div key={group} className="dt-sources">
              <span className="label dim">{group}</span>
              <ul className="bars">
                {list.map((x, i) => (
                  <li key={x.id}>
                    <span className="bar-label">{x.label}</span>
                    <span className="bar-track">
                      <motion.i className={x.group === 'online' ? 'coral' : ''} initial={{ width: 0 }} animate={{ width: `${(x.share / maxSource) * 100}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }} />
                    </span>
                    <b>{pct(x.share)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.section>

        <motion.section className="panel tile span-4" {...card(10)}>
          <div className="tile-head">
            <h3>Best sellers</h3>
            <span className="label dim">By quantity</span>
          </div>
          <ol className="dt-best">
            {best.map((p, i) => (
              <li key={p.name}>
                <span className="dt-best-rank">{i === 0 ? <Crown size={16} weight="fill" aria-label="Number 1" /> : i + 1}</span>
                <span className="dt-best-name">
                  <b>{p.name}</b>
                  <small>
                    {p.category} · {eur(p.revenue)}
                  </small>
                </span>
                <span className="dt-best-qty">
                  <b>{num(p.qty)}</b>
                  <Trend v={p.trend} d={0} />
                </span>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section className="panel tile span-8" {...card(11)}>
          <div className="tile-head">
            <h3>Menu products</h3>
            <div className="dt-filter" role="group" aria-label="Category">
              {['all', ...s.categories].map((c) => (
                <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>
          <div className="dt-table-wrap">
            <table className="dt-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Sold</th>
                  <th className="num">Sales</th>
                  <th>Share</th>
                  <th className="num">Trend</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map((p) => (
                  <tr key={p.name}>
                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td className="dim">{p.category}</td>
                    <td className="num">{num(p.qty)}</td>
                    <td className="num">{eur(p.revenue)}</td>
                    <td>
                      <span className="dt-share">
                        <span className="bar-track">
                          <i style={{ width: `${(p.revenue / maxProduct) * 100}%` }} />
                        </span>
                        <small>{pct(p.share, 1)}</small>
                      </span>
                    </td>
                    <td className="num">
                      <Trend v={p.trend} d={0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length > 10 && <span className="label dim">Top 10 of {products.length} items</span>}
        </motion.section>
      </div>
    </div>
  )
}
