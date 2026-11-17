import { animate, motion } from 'framer-motion'
import {
  Basket,
  BowlSteam,
  Bread,
  Buildings,
  Carrot,
  Desktop,
  DeviceMobile,
  ForkKnife,
  GlobeHemisphereWest,
  Headphones,
  Laptop,
  Leaf,
  MapPin,
  OrangeSlice,
  Plant,
  SquaresFour,
  Storefront,
  Wine,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { BrandIcon, IndustryId, User } from '../data/types'
import type { ScopeLevel } from '../state'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/'

/** Text that "decrypts" from random glyphs into the final string. */
export function DecodeText({ text, delay = 0, speed = 28, className }: { text: string; delay?: number; speed?: number; className?: string }) {
  const [out, setOut] = useState(() => text.replace(/\S/g, ' '))
  useEffect(() => {
    let frame = 0
    let id: number | undefined
    const start = window.setTimeout(() => {
      id = window.setInterval(() => {
        frame++
        const revealed = Math.floor(frame / 2)
        setOut(
          text
            .split('')
            .map((ch, i) => (ch === ' ' ? ' ' : i < revealed ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(''),
        )
        if (revealed >= text.length) window.clearInterval(id)
      }, speed)
    }, delay * 1000)
    return () => {
      window.clearTimeout(start)
      if (id) window.clearInterval(id)
    }
  }, [text, delay, speed])
  return (
    <span className={className} aria-label={text}>
      {out}
    </span>
  )
}

/** Number that tweens to its value whenever it changes. */
export function CountUp({
  value,
  format = (v) => Math.round(v).toLocaleString('fr-BE'),
  duration = 1.4,
  delay = 0,
}: {
  value: number
  format?: (v: number) => string
  duration?: number
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v)
      },
    })
    prev.current = value
    return () => controls.stop()
    // format is intentionally not a dependency: callers pass inline lambdas
  }, [value, duration, delay])
  return <span ref={ref}>{format(prev.current)}</span>
}

/** Official lockup (red mark + white wordmark). Dark surfaces only, per the brand reference. */
export function BrandLockup({ height = 32 }: { height?: number }) {
  return <img src="/brand/cm-logo-lockup.svg" alt="Caisse Manager" height={height} style={{ height, width: 'auto', display: 'block' }} />
}

/** Official mark alone (#FF0000 hand-drawn checkbox). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return <img src="/brand/cm-mark.svg" alt="" aria-hidden width={size} height={size} style={{ display: 'block' }} />
}

const INDUSTRY_ICONS: Record<IndustryId, Icon> = { it: Desktop, hospitality: ForkKnife, harvest: Plant }

export function IndustryIcon({ id, size = 64, weight = 'light' }: { id: IndustryId; size?: number; weight?: IconWeight }) {
  const Glyph = INDUSTRY_ICONS[id]
  return <Glyph size={size} weight={weight} aria-hidden />
}

const BRAND_ICONS: Record<BrandIcon, Icon> = {
  bread: Bread,
  bowl: BowlSteam,
  wine: Wine,
  laptop: Laptop,
  mobile: DeviceMobile,
  headphones: Headphones,
  basket: Basket,
  carrot: Carrot,
  orange: OrangeSlice,
  leaf: Leaf,
}

export function BrandGlyph({ icon, size = 40, weight = 'light' }: { icon: BrandIcon; size?: number; weight?: IconWeight }) {
  const Glyph = BRAND_ICONS[icon]
  return <Glyph size={size} weight={weight} aria-hidden />
}

const LEVEL_ICONS: Record<Exclude<ScopeLevel, 'industry' | 'brand'>, Icon> = {
  group: SquaresFour,
  holding: Buildings,
  country: GlobeHemisphereWest,
  city: MapPin,
  store: Storefront,
}

/** Icon for a scope: the industry or brand's own glyph when there is one, otherwise the level's. */
export function ScopeIcon({ level, industry, brandIcon, size = 40 }: { level: ScopeLevel; industry?: IndustryId | null; brandIcon?: BrandIcon | null; size?: number }) {
  if (level === 'brand' && brandIcon) return <BrandGlyph icon={brandIcon} size={size} />
  if (level === 'industry' && industry) return <IndustryIcon id={industry} size={size} />
  const Glyph = LEVEL_ICONS[level === 'industry' || level === 'brand' ? 'holding' : level]
  return <Glyph size={size} weight="light" aria-hidden />
}

export function StepHeader({ index, eyebrow, title, subtitle }: { index: string; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.header
      className="step-header"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="eyebrow">
        <span className="eyebrow-index">{index}</span>
        <span className="eyebrow-line" />
        <DecodeText text={eyebrow} />
      </div>
      <h1 className="step-title">
        <RedWord text={title} />
      </h1>
      {subtitle && <p className="step-sub">{subtitle}</p>}
    </motion.header>
  )
}

/**
 * Portraits for the demo accounts that have none of their own (they come from the POS staff set, matched by first name or gender
 * only so the demo reads naturally). A real account carries `user.photo`, which always wins.
 */
const DEMO_PHOTO: Record<string, string> = {
  'u-admin': '/pos/assets/benaissa.png',
  'u-holding': '/pos/assets/salma.png',
  'u-brand': '/pos/assets/youssef.png',
  'u-region': '/pos/assets/staff/nadia.png',
  'u-store': '/pos/assets/mehdi.png',
  'u-kitchen': '/pos/assets/karim.png',
  'u-driver': '/pos/assets/staff/hamza.png',
  'u-employee': '/pos/assets/staff/leila.png',
}

export function photoOf(user: Pick<User, 'id' | 'photo'>): string | undefined {
  return user.photo ?? DEMO_PHOTO[user.id]
}

/** The POS v3 avatar (the `.me` of its top bar): the portrait in a squircle with a red ring and an ice glow; initials when there is no portrait. */
export function Avatar({ user }: { user: Pick<User, 'id' | 'name' | 'photo'> }) {
  const src = photoOf(user)
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
  return <span className={`avatar ${src ? 'has-photo' : ''}`}>{src ? <img src={src} alt="" /> : initials}</span>
}

/** A POS v3 headline: white words with the last one in red. */
export function RedWord({ text }: { text: string }) {
  const i = text.lastIndexOf(' ')
  if (i < 0) return <em>{text}</em>
  return (
    <>
      {text.slice(0, i + 1)}
      <em>{text.slice(i + 1)}</em>
    </>
  )
}

export const ease = [0.16, 1, 0.3, 1] as const
