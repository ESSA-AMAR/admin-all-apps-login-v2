/** Today's live tiles: orders in progress and the suggested actions. */
import { ArrowRight, Check, CheckCircle, Clock, CookingPot, Lightbulb, Warning, WarningOctagon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { eur } from '../../lib/kpis'
import type { DashTab, SuggestedAction } from '../../lib/insights'
import { isLate as lateAt, type LiveOrder, type LiveStats } from './live-orders'

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function LiveOrdersTile({ orders, now, stats, single }: { orders: LiveOrder[]; now: number; stats: LiveStats; single: boolean }) {
  const isLate = (o: LiveOrder) => lateAt(o, now)
  // Late first (longest wait on top), then the kitchen queue, then what waits to be picked up.
  const rank = (o: LiveOrder) => (isLate(o) ? 0 : o.status === 'new' ? 1 : o.status === 'preparing' ? 2 : 3)
  const shown = [...orders].sort((a, b) => rank(a) - rank(b) || a.placed - b.placed).slice(0, 9)
  return (
    <>
      <div className="tile-head">
        <h3>Live orders</h3>
        <div className="dt-chips">
          <span className="dt-chip">
            <b>{stats.open}</b> in progress
          </span>
          {stats.late > 0 && (
            <span className="dt-chip bad">
              <Warning size={13} weight="fill" aria-hidden /> <b>{stats.late}</b> late
            </span>
          )}
          <span className="dt-chip">
            <b>{stats.ready}</b> ready
          </span>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="dt-empty">No order in progress.</p>
      ) : (
        <ul className="dt-orders">
          <AnimatePresence initial={false}>
            {shown.map((o) => {
              const late = isLate(o)
              const st = late ? 'late' : o.status
              const prog = Math.min(1, (now - o.placed) / (o.target * 60_000))
              return (
                <motion.li key={o.id + o.placed} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <span className={`dt-ostatus ${st}`}>
                    {st === 'late' ? <Warning size={13} weight="fill" aria-hidden /> : st === 'ready' ? <CheckCircle size={13} weight="fill" aria-hidden /> : st === 'preparing' ? <CookingPot size={13} aria-hidden /> : <Clock size={13} aria-hidden />}
                    {st === 'late' ? 'Late' : st === 'ready' ? 'Ready' : st === 'preparing' ? 'Preparing' : 'New'}
                  </span>
                  <span className="dt-owho">
                    <b>
                      {o.id} · {o.where}
                    </b>
                    <small>{single ? o.items : `${o.store} · ${o.items}`}</small>
                  </span>
                  <span className="dt-oprog" aria-hidden>
                    <i style={{ width: `${prog * 100}%` }} className={late ? 'late' : ''} />
                  </span>
                  <span className={`dt-otime ${late ? 'late' : ''}`}>{clock(now - o.placed)}</span>
                  <b className="dt-oamt">{eur(o.amount, 2)}</b>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </>
  )
}

const PRIORITY = {
  high: { label: 'High', Icon: WarningOctagon },
  medium: { label: 'Medium', Icon: Warning },
  low: { label: 'Idea', Icon: Lightbulb },
} as const

export function ActionsTile({ actions, onTab }: { actions: SuggestedAction[]; onTab: (t: DashTab) => void }) {
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const [all, setAll] = useState(false)
  const open = actions.filter((a) => !done.has(a.id))
  // The three most urgent fit beside the live orders; the rest are one tap away.
  const shown = all ? open : open.slice(0, 3)
  return (
    <>
      <div className="tile-head">
        <h3>Suggested actions</h3>
        <span className="label dim">{open.length ? `${open.length} to do` : 'All done'}</span>
      </div>
      {open.length === 0 ? (
        <p className="dt-empty">
          <CheckCircle size={18} aria-hidden /> Nothing urgent right now.
        </p>
      ) : (
        <ul className="dt-actions">
          <AnimatePresence initial={false}>
            {shown.map((a) => {
              const P = PRIORITY[a.priority]
              return (
                <motion.li key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
                  <span className={`dt-prio ${a.priority}`}>
                    <P.Icon size={13} weight="fill" aria-hidden /> {P.label}
                  </span>
                  <b>{a.title}</b>
                  <small>{a.why}</small>
                  <span className="dt-act-btns">
                    {a.tab && a.cta && (
                      <button className="btn-ghost" onClick={() => onTab(a.tab!)}>
                        {a.cta} <ArrowRight size={13} aria-hidden />
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => setDone((s) => new Set(s).add(a.id))} aria-label={`Mark "${a.title}" as done`}>
                      <Check size={13} aria-hidden /> Done
                    </button>
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
      {open.length > 3 && (
        <button className="dt-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show ${open.length - 3} more`}
        </button>
      )}
    </>
  )
}
