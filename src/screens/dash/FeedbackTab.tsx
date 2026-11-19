/** Customer feedback from every app and the website: receipt QR at the POS, kiosk, website and app, delivery apps, Google. */
import { ArrowBendUpLeft, CheckCircle, ChatCircleText, DeviceTablet, Globe, GoogleLogo, Moped, QrCode } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { CountUp, ease } from '../../components/ui'
import type { Store } from '../../data/types'
import { feedback, RANGES, type Range, type ReviewSource } from '../../lib/insights'
import { Seg, Stars } from './charts'
import { ago, num, pct } from './format'

const card = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.05 + i * 0.05, ease },
})

const SOURCE_ICON: Record<ReviewSource, typeof QrCode> = { receipt: QrCode, kiosk: DeviceTablet, web: Globe, delivery: Moped, google: GoogleLogo }
type Filter = 'all' | 'negative' | 'unanswered'

export function FeedbackTab({ stores, range, onRange, onSay }: { stores: Store[]; range: Range; onRange: (r: Range) => void; onSay: (msg: string) => void }) {
  const f = useMemo(() => feedback(stores, range), [stores, range])
  const [filter, setFilter] = useState<Filter>('all')
  const [replied, setReplied] = useState<Set<string>>(() => new Set())
  const isReplied = (id: string, base: boolean) => base || replied.has(id)
  const list = f.reviews.filter((r) => (filter === 'negative' ? r.stars <= 2 : filter === 'unanswered' ? !isReplied(r.id, r.replied) : true))
  const maxDist = Math.max(...f.dist, 1)
  const topics = f.topics.slice(0, 5)
  const single = stores.length === 1

  return (
    <div className="dt-tab">
      <div className="dt-tab-head">
        <p className="label dim">Ratings and comments from the POS receipt QR, the kiosk, the website and app, delivery apps and Google</p>
        <Seg label="Period" value={range} options={RANGES.map((r) => ({ id: r, label: `${r} days` }))} onChange={onRange} />
      </div>

      <div className="kpi-row">
        <motion.div className="kpi" {...card(0)}>
          <span className="kpi-label label">Average rating</span>
          <b className="kpi-value">
            <CountUp value={f.avg} format={(v) => `${num(v, 2)} ★`} />
          </b>
          <div className="kpi-foot">
            {Math.abs(f.avgDelta) < 0.005 ? (
              <span className="delta">— 0,00 ★</span>
            ) : (
              <span className={`delta ${f.avgDelta > 0 ? 'up' : 'down'}`}>
                {f.avgDelta > 0 ? '▲' : '▼'} {num(Math.abs(f.avgDelta), 2)} ★
              </span>
            )}
            <span className="label dim">vs previous {range} days</span>
          </div>
        </motion.div>
        <motion.div className="kpi" {...card(1)}>
          <span className="kpi-label label">Reviews</span>
          <b className="kpi-value">
            <CountUp value={f.count} format={(v) => num(v)} />
          </b>
          <div className="kpi-foot">
            <span className="label dim">in {range} days</span>
          </div>
        </motion.div>
        <motion.div className="kpi" {...card(2)}>
          <span className="kpi-label label">Positive</span>
          <b className="kpi-value">
            <CountUp value={f.positive} format={(v) => pct(v)} />
          </b>
          <div className="kpi-foot">
            <span className="label dim">4 and 5 stars</span>
          </div>
        </motion.div>
        <motion.div className="kpi" {...card(3)}>
          <span className="kpi-label label">Answered</span>
          <b className="kpi-value">
            <CountUp value={f.responseRate} format={(v) => pct(v)} />
          </b>
          <div className="kpi-foot">
            {f.unansweredNegative > 0 ? (
              <span className="kpi-flag bad">{f.unansweredNegative} negative without a reply</span>
            ) : (
              <span className="label dim">every negative review answered</span>
            )}
          </div>
        </motion.div>
      </div>

      <div className="dash-grid">
        <motion.section className="panel tile span-4" {...card(4)}>
          <div className="tile-head">
            <h3>Stars</h3>
            <Stars value={f.avg} />
          </div>
          <ul className="dt-dist">
            {f.dist.map((n, i) => (
              <li key={i}>
                <span>{5 - i} ★</span>
                <span className="bar-track">
                  <motion.i className={i >= 3 ? 'coral' : ''} initial={{ width: 0 }} animate={{ width: `${(n / maxDist) * 100}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }} />
                </span>
                <b>{num(n)}</b>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-4" {...card(5)}>
          <div className="tile-head">
            <h3>By source</h3>
          </div>
          <ul className="dt-src">
            {f.sources.map((s) => {
              const I = SOURCE_ICON[s.id]
              return (
                <li key={s.id}>
                  <I size={18} aria-hidden />
                  <span>
                    <b>{s.label}</b>
                    <small>{num(s.count)} reviews</small>
                  </span>
                  <em className={s.avg < 3.8 ? 'low' : ''}>{num(s.avg, 1)} ★</em>
                </li>
              )
            })}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-4" {...card(6)}>
          <div className="tile-head">
            <h3>What they talk about</h3>
            <span className="label dim">% positive</span>
          </div>
          <ul className="dt-topics">
            {topics.map((t, i) => (
              <li key={t.label}>
                <span className="dt-topic-name">
                  <b>{t.label}</b>
                  <small>{num(t.mentions)} mentions</small>
                </span>
                <span className="dt-topic-bar" aria-hidden>
                  <motion.i className="pos" initial={{ width: 0 }} animate={{ width: `${t.positive}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }} />
                </span>
                <b className={t.positive < 68 ? 'low' : ''}>{pct(t.positive)}</b>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section className="panel tile span-12" {...card(7)}>
          <div className="tile-head">
            <h3>Latest feedback</h3>
            <div className="dt-filter" role="group" aria-label="Show">
              {(
                [
                  ['all', 'All'],
                  ['negative', '1–2 ★'],
                  ['unanswered', 'No reply yet'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <p className="dt-empty">
              <CheckCircle size={18} aria-hidden /> Nothing here.
            </p>
          ) : (
            <ul className="dt-reviews">
              <AnimatePresence initial={false}>
                {list.map((r) => {
                  const I = SOURCE_ICON[r.source]
                  const done = isReplied(r.id, r.replied)
                  return (
                    <motion.li key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={r.stars <= 2 ? 'neg' : ''}>
                      <span className="dt-rev-stars">
                        <Stars value={r.stars} size={13} />
                        <small>{ago(r.minutes)}</small>
                      </span>
                      <span className="dt-rev-body">
                        <b>“{r.text}”</b>
                        <small>
                          <I size={13} aria-hidden /> {r.source === 'receipt' ? 'Receipt QR' : r.source === 'kiosk' ? 'Kiosk' : r.source === 'web' ? 'Website & app' : r.source === 'delivery' ? 'Delivery apps' : 'Google'}
                          {single ? '' : ` · ${r.store}`} · {r.topic}
                        </small>
                      </span>
                      {done ? (
                        <span className="dt-rev-done">
                          <CheckCircle size={14} weight="fill" aria-hidden /> Replied
                        </span>
                      ) : (
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setReplied((s) => new Set(s).add(r.id))
                            onSay(`Reply sent to the ${r.stars}★ review${single ? '' : ` at ${r.store}`}`)
                          }}
                        >
                          <ArrowBendUpLeft size={13} aria-hidden /> Reply
                        </button>
                      )}
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
          <span className="label dim">
            <ChatCircleText size={13} aria-hidden /> The {f.reviews.length} most recent of {num(f.count)} reviews
          </span>
        </motion.section>
      </div>
    </div>
  )
}
