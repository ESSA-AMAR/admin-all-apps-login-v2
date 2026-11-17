import { motion, useMotionValue, useTransform } from 'framer-motion'
import type { PointerEvent, ReactNode } from 'react'
import { IndustryIcon, StepHeader, ease } from '../components/ui'
import { INDUSTRIES } from '../data/mock'
import type { Holding } from '../data/types'
import { consolidate, eur } from '../lib/kpis'
import { coverForHolding } from '../lib/media'

function HoldingCard({ h, index, onSelect, onPreview }: { h: Holding; index: number; onSelect: () => void; onPreview: (on: boolean) => void }) {
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const glareX = useTransform(mx, (v) => `${v * 100}%`)
  const glareY = useTransform(my, (v) => `${v * 100}%`)

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  const reset = () => {
    mx.set(0.5)
    my.set(0.5)
  }

  const countries = new Set(h.stores.map((s) => s.countryId)).size
  const industries = INDUSTRIES.filter((i) => h.stores.some((s) => s.industry === i.id))
  const online = h.stores.filter((s) => s.status === 'online').length
  const k = consolidate(h.stores)

  return (
    <motion.button
      className="holding-card"
      onPointerMove={onMove}
      onPointerEnter={() => onPreview(true)}
      onFocus={() => onPreview(true)}
      onPointerLeave={() => (reset(), onPreview(false))}
      onClick={onSelect}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, delay: 0.25 + index * 0.12, ease }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="hc-cover" style={{ backgroundImage: `url(${coverForHolding(h.id)})` }} />
      <motion.span className="glare" style={{ '--gx': glareX, '--gy': glareY } as never} />
      <span className="corner tl" />
      <span className="corner br" />
      <div className="hc-top">
        <span className="hc-code">{h.code}</span>
        <span className="label dim">EST. {h.founded}</span>
      </div>
      <h3 className="hc-name">{h.name}</h3>
      <div className="label dim hc-hq">HQ · {h.hq}</div>

      <div className="hc-stats">
        <div>
          <b>{h.stores.length}</b>
          <span>Stores</span>
        </div>
        <div>
          <b>{countries}</b>
          <span>Countries</span>
        </div>
        <div>
          <b>{Math.round((online / h.stores.length) * 100)}%</b>
          <span>Online</span>
        </div>
      </div>

      <div className="hc-rev">
        <span>
          <small className="label dim">Revenue today</small>
          <b>{eur(k.revenueToday)}</b>
        </span>
        <span className="label dim">
          {h.brands.length} brands · {Math.round((k.revenueToday / k.target) * 100)}% of target
        </span>
      </div>

      <div className="hc-industries">
        {industries.map((i) => (
          <span key={i.id} className="hc-ind">
            <IndustryIcon id={i.id} size={18} />
            {i.name}
          </span>
        ))}
      </div>
      <div className="hc-cta label">
        ENTER HOLDING <span>→</span>
      </div>
    </motion.button>
  )
}

export function Holdings({ holdings, pulse, onSelect, onPreview = () => {} }: { holdings: Holding[]; pulse: ReactNode; onSelect: (id: string) => void; onPreview?: (id: string | null) => void }) {
  return (
    <div className="screen pick">
      <div className="pick-main">
      <StepHeader
        index="01"
        eyebrow="HOLDING SELECTION"
        title="Choose your holding"
        subtitle={`${holdings.length} holdings are linked to your identity. Select one to enter its ecosystem.`}
      />
      <div className="holding-grid">
        {holdings.map((h, i) => (
          <HoldingCard key={h.id} h={h} index={i} onSelect={() => onSelect(h.id)} onPreview={(on) => onPreview(on ? h.id : null)} />
        ))}
      </div>
      </div>
      {pulse}
    </div>
  )
}
