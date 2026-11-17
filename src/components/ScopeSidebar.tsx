import { ArrowRight, ChartLineUp, Eye } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { Store } from '../data/types'
import { consolidate, eur } from '../lib/kpis'
import { CountUp, ease } from './ui'

export interface SidebarRow {
  id: string
  name: string
  stores: Store[]
}

interface Props {
  /** "Group", "Holding", "Industry"… */
  level: string
  name: string
  stores: Store[]
  /** What the level below splits into (holdings, industries, brands), for the ranking. */
  rows: SidebarRow[]
  rowsLabel: string
  /** An option the user is hovering on the left: the sidebar previews it instead of the current scope. */
  preview?: { name: string; level: string; stores: Store[] } | null
  onDetails: () => void
}

const pct = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%`

/**
 * Right-hand KPI sidebar for the selection steps (holding → industry → brand): the key figures of
 * the scope you're standing in, a ranking of what's below it, and a way into the full dashboard.
 * Hovering an option on the left previews that option's figures here. The layout never changes
 * between the two, so the sidebar (and the cards stretched beside it) keeps one height.
 */
export function ScopeSidebar({ level, name, stores, rows, rowsLabel, preview, onDetails }: Props) {
  const shown = preview ?? { name, level, stores }
  const k = useMemo(() => consolidate(shown.stores), [shown.stores])
  const target = k.target ? Math.min(100, (k.revenueToday / k.target) * 100) : 0
  const ranked = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, revenue: r.stores.length ? consolidate(r.stores).revenueToday : 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    [rows],
  )
  const top = Math.max(1, ...ranked.map((r) => r.revenue))
  const spark = useMemo(() => {
    const h = k.hourly
    const max = Math.max(1, ...h)
    return h.map((v, i) => `${(i / (h.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ')
  }, [k.hourly])

  return (
    <motion.aside className="panel scope-side" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2, ease }}>
      {/* Swapped in place (no exit gap), so the height never dips while the figures change. */}
      <motion.div key={shown.name} className="ss-body" initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <header className="ss-head">
          <span className="ss-icon">{preview ? <Eye size={18} weight="bold" /> : <ChartLineUp size={18} weight="bold" />}</span>
          <span className="ss-title">
            <small className="label">{preview ? `Preview · ${shown.level}` : `Consolidated · ${shown.level}`}</small>
            <b>{shown.name}</b>
          </span>
        </header>

        <div className="ss-hero">
          <small className="label dim">Revenue today</small>
          <b>
            <CountUp value={k.revenueToday} format={(v) => eur(v)} duration={0.8} />
          </b>
          <span className={`ss-delta ${k.deltas.revenue >= 0 ? 'up' : 'down'}`}>{pct(k.deltas.revenue)} vs last week</span>
          <svg className="ss-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
            <polyline points={spark} />
          </svg>
        </div>

        <div className="ss-target">
          <span>
            <small className="label dim">Daily target</small>
            <b>{Math.round(target)}%</b>
          </span>
          <span className="ss-bar">
            <motion.i initial={{ width: 0 }} animate={{ width: `${target}%` }} transition={{ duration: 0.9, ease }} />
          </span>
        </div>

        <div className="ss-grid">
          <div>
            <small className="label dim">Transactions</small>
            <b>{Math.round(k.transactions).toLocaleString('fr-BE')}</b>
          </div>
          <div>
            <small className="label dim">Avg basket</small>
            <b>{eur(k.avgBasket, 2)}</b>
          </div>
          <div>
            <small className="label dim">Customers</small>
            <b>{Math.round(k.customers).toLocaleString('fr-BE')}</b>
          </div>
          <div>
            <small className="label dim">Stores online</small>
            <b>
              {k.status.online}/{k.storeCount}
            </b>
          </div>
        </div>

        {ranked.length > 1 && (
          <div className="ss-rank">
            <small className="label dim">Top {rowsLabel} today</small>
            <ul>
              {ranked.map((r) => (
                <li key={r.id} className={preview && r.name === preview.name ? 'on' : undefined}>
                  <span className="ss-rank-row">
                    <span>{r.name}</span>
                    <b>{eur(r.revenue)}</b>
                  </span>
                  <span className="ss-bar thin">
                    <i style={{ width: `${(r.revenue / top) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      <button className="btn-primary ss-cta" onClick={onDetails}>
        See full details <ArrowRight size={16} weight="bold" />
      </button>
    </motion.aside>
  )
}
