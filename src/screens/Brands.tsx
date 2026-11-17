import { ArrowRight } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BrandGlyph, StepHeader, ease } from '../components/ui'
import { cityById } from '../data/mock'
import type { Brand, Holding, Industry } from '../data/types'
import { consolidate, eur } from '../lib/kpis'
import { logoForBrand } from '../lib/media'

export function Brands({
  holding,
  industry,
  index,
  pulse,
  onSelect,
  onPreview = () => {},
}: {
  holding: Holding
  industry: Industry
  index: string
  pulse: ReactNode
  onSelect: (id: string) => void
  onPreview?: (id: string | null) => void
}) {
  const brands = holding.brands.filter((b) => b.industry === industry.id)
  return (
    <div className="screen pick">
      <div className="pick-main">
      <StepHeader
        index={index}
        eyebrow={`${holding.code} · ${industry.name.toUpperCase()} · BRANDS`}
        title="Select a brand"
        subtitle={`${brands.length} ${industry.name.toLowerCase()} brands operated by ${holding.name}.`}
      />
      <div className="brand-grid">
        {brands.map((b, i) => (
          <BrandCard key={b.id} brand={b} holding={holding} index={i} onSelect={() => onSelect(b.id)} onPreview={(on) => onPreview(on ? b.id : null)} />
        ))}
      </div>
      </div>
      {pulse}
    </div>
  )
}

function BrandCard({ brand, holding, index, onSelect, onPreview }: { brand: Brand; holding: Holding; index: number; onSelect: () => void; onPreview: (on: boolean) => void }) {
  const stores = holding.stores.filter((s) => s.brandId === brand.id)
  const k = consolidate(stores)
  const countries = new Set(stores.map((s) => s.countryId)).size
  const cities = [...new Set(stores.map((s) => cityById(s.cityId).name))]
  const pct = k.target ? Math.min(100, (k.revenueToday / k.target) * 100) : 0
  return (
    <motion.button
      className="brand-card"
      onClick={onSelect}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, delay: 0.3 + index * 0.1, ease }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="corner tl" />
      <span className="corner br" />
      <span className="brand-emblem">
        {logoForBrand(brand.name) ? <img className="brand-logo" src={logoForBrand(brand.name)} alt="" /> : <BrandGlyph icon={brand.icon} size={44} />}
      </span>
      <span className="brand-name">{brand.name}</span>
      <span className="brand-tag">{brand.tagline}</span>

      <span className="brand-stats">
        <span>
          <b>{stores.length}</b>
          <small>Stores</small>
        </span>
        <span>
          <b>{countries}</b>
          <small>{countries === 1 ? 'Country' : 'Countries'}</small>
        </span>
        <span>
          <b>{k.status.online}/{stores.length}</b>
          <small>Online</small>
        </span>
      </span>

      <span className="brand-rev">
        <span>
          <small className="label dim">Revenue today</small>
          <b>{eur(k.revenueToday)}</b>
        </span>
        <span className="label dim">{Math.round(pct)}% of target</span>
      </span>
      <span className="brand-bar">
        <motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.6 + index * 0.1, ease }} />
      </span>

      <span className="brand-cities label dim">{cities.slice(0, 4).join(' · ')}{cities.length > 4 ? ` +${cities.length - 4}` : ''}</span>
      <span className="hc-cta label">
        Enter brand <ArrowRight size={14} weight="bold" />
      </span>
    </motion.button>
  )
}
