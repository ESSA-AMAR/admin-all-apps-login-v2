import { ArrowRight, ChartLineUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { Store } from '../data/types'
import { consolidate, eur } from '../lib/kpis'
import { CountUp, ease } from './ui'

/** Consolidated figures for the scope the user is currently standing in, with a way into its dashboard. */
export function ScopePulse({ level, name, stores, onOpen, className = '' }: { level: string; name: string; stores: Store[]; onOpen: () => void; className?: string }) {
  const k = useMemo(() => consolidate(stores), [stores])
  const pct = k.target ? (k.revenueToday / k.target) * 100 : 0
  const metrics = [
    { label: 'Revenue today', value: k.revenueToday, fmt: (v: number) => eur(v) },
    { label: 'Transactions', value: k.transactions, fmt: (v: number) => Math.round(v).toLocaleString('fr-BE') },
    { label: 'Avg basket', value: k.avgBasket, fmt: (v: number) => eur(v, 2) },
    { label: 'Of target', value: pct, fmt: (v: number) => `${Math.round(v)}%` },
    { label: 'Stores online', value: k.status.online, fmt: (v: number) => `${Math.round(v)}/${k.storeCount}` },
  ]
  return (
    <motion.section
      className={`panel pulse ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease }}
    >
      <span className="corner tl" />
      <div className="pulse-scope">
        <span className="pulse-icon">
          <ChartLineUp size={20} weight="bold" />
        </span>
        <span>
          <small className="label">Consolidated · {level}</small>
          <b>{name}</b>
        </span>
      </div>
      <div className="pulse-metrics">
        {metrics.map((m) => (
          <div key={m.label}>
            <small className="label dim">{m.label}</small>
            <b>
              <CountUp value={m.value} format={m.fmt} />
            </b>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={onOpen}>
        Open dashboard <ArrowRight size={16} weight="bold" />
      </button>
    </motion.section>
  )
}
