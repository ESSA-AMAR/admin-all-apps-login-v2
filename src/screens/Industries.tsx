import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { IndustryIcon, StepHeader, ease } from '../components/ui'
import { INDUSTRIES } from '../data/mock'
import type { Holding, IndustryId } from '../data/types'
import { consolidate, eur } from '../lib/kpis'

export function Industries({
  holding,
  single,
  pulse,
  onSelect,
  onPreview = () => {},
}: {
  holding: Holding
  single: boolean
  pulse: ReactNode
  onSelect: (id: IndustryId) => void
  onPreview?: (id: IndustryId | null) => void
}) {
  const [hover, setHoverState] = useState<IndustryId | null>(null)
  const setHover = (id: IndustryId | null) => {
    setHoverState(id)
    onPreview(id)
  }

  return (
    <div className="screen pick">
      <div className="pick-main">
      <StepHeader
        index={single ? '01' : '02'}
        eyebrow={`${holding.code} · INDUSTRY VECTOR`}
        title="Select your industry"
        subtitle={
          single
            ? `Linked directly to ${holding.name}. Pick the sector you are operating in today.`
            : `Sectors operated by ${holding.name}.`
        }
      />
      <div className="industry-row" onPointerLeave={() => setHover(null)}>
        {INDUSTRIES.map((ind, i) => {
          const stores = holding.stores.filter((s) => s.industry === ind.id)
          const countries = new Set(stores.map((s) => s.countryId)).size
          const cities = new Set(stores.map((s) => s.cityId)).size
          const brands = holding.brands.filter((b) => b.industry === ind.id)
          const revenue = stores.length ? consolidate(stores).revenueToday : 0
          const disabled = stores.length === 0
          const active = hover === ind.id
          return (
            <motion.button
              key={ind.id}
              className={`portal ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`}
              disabled={disabled}
              onPointerEnter={() => !disabled && setHover(ind.id)}
              onFocus={() => !disabled && setHover(ind.id)}
              onClick={() => onSelect(ind.id)}
              initial={{ opacity: 0, y: 80, scaleY: 0.6 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, delay: hover === null ? 0.2 + i * 0.12 : 0, ease }}
            >
              <span className="portal-bg" />
              <span className="portal-rings">
                <i />
                <i />
                <i />
              </span>
              <span className="portal-beam" />
              <span className="portal-index label">0{i + 1}</span>
              <span className="portal-icon">
                <IndustryIcon id={ind.id} size={86} />
              </span>
              <span className="portal-body">
                <span className="portal-name">{ind.name}</span>
                <span className="portal-tag">{ind.tagline}</span>
                {disabled ? (
                  <span className="portal-stats label">NO OPERATIONS IN THIS HOLDING</span>
                ) : (
                  <span className="portal-stats label">
                    <span>
                      <b>{stores.length}</b> {stores.length === 1 ? 'store' : 'stores'}
                    </span>
                    <span>
                      <b>{cities}</b> {cities === 1 ? 'city' : 'cities'}
                    </span>
                    <span>
                      <b>{countries}</b> {countries === 1 ? 'country' : 'countries'}
                    </span>
                  </span>
                )}
                {!disabled && (
                  <span className="portal-rev">
                    <b>{eur(revenue)}</b>
                    <small className="label dim">today · {brands.map((b) => b.name).join(' · ')}</small>
                  </span>
                )}
                {!disabled && <span className="portal-cta label">INITIALISE →</span>}
              </span>
            </motion.button>
          )
        })}
      </div>
      </div>
      {pulse}
    </div>
  )
}
