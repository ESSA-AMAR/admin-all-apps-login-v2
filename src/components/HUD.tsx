import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowUp, CaretDown, ChartLineUp, Check, Compass, Moon, SignOut, SquaresFour, Sun } from '@phosphor-icons/react'
import { cityById, countryById, industryById } from '../data/mock'
import type { Store } from '../data/types'
import type { IndustryId } from '../data/types'
import { brandOf, holdingOf, LEVEL_LABEL, storesLabel } from '../lib/scope'
import { LEVELS, type Action, type Flow, type Level } from '../state'
import { Avatar, BrandMark, ease } from './ui'

const ALL: Record<Level, string> = {
  holding: 'All holdings',
  industry: 'All industries',
  brand: 'All brands',
  country: 'All countries',
  city: 'All cities',
  store: 'All stores',
}

const PLURAL: Record<Level, string> = { holding: 'holdings', industry: 'industries', brand: 'brands', country: 'countries', city: 'cities', store: 'stores' }

type Theme = 'dark' | 'light'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#06070a' : '#eceef2')
    try {
      localStorage.setItem('cm-theme', next)
    } catch {
      /* storage can be blocked; the choice just won't persist */
    }
    setTheme(next)
  }
  return [theme, toggle]
}

/** Everything the user could pick at `level`, given what is selected above it. */
function optionsFor(flow: Flow, level: Level): { id: string; name: string; sub: string }[] {
  const holdings = flow.session?.holdings ?? []
  if (level === 'holding') return holdings.map((h) => ({ id: h.id, name: h.name, sub: storesLabel(h.stores.length) }))
  const h = holdingOf(flow)
  if (!h) return []
  const above = LEVELS.slice(1, LEVELS.indexOf(level)) as Exclude<Level, 'holding'>[]
  const key: Record<Exclude<Level, 'holding'>, (s: Store) => string> = {
    industry: (s) => s.industry,
    brand: (s) => s.brandId,
    country: (s) => s.countryId,
    city: (s) => s.cityId,
    store: (s) => s.id,
  }
  const pool = h.stores.filter((s) => above.every((l) => key[l](s) === flow[l]))
  const k = key[level as Exclude<Level, 'holding'>]
  const ids = [...new Set(pool.map(k))]
  const name = (id: string) =>
    level === 'industry'
      ? industryById(id as IndustryId).name
      : level === 'brand'
        ? (h.brands.find((b) => b.id === id)?.name ?? id)
        : level === 'country'
          ? countryById(id).name
          : level === 'city'
            ? cityById(id).name
            : (h.stores.find((s) => s.id === id)?.name ?? id)
  return ids.map((id) => ({ id, name: name(id), sub: level === 'store' ? '' : storesLabel(pool.filter((s) => k(s) === id).length) })).sort((a, b) => a.name.localeCompare(b.name))
}

export function HUD({ flow, dispatch }: { flow: Flow; dispatch: (a: Action) => void }) {
  const [menu, setMenu] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const [open, setOpen] = useState<{ level: Level; x: number; y: number } | null>(null)

  // Close the switcher on outside click; Esc closes it, and otherwise steps one layer back up.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (open && !(e.target as Element).closest('.crumb-pop, .crumb button')) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && open) return setOpen(null)
      if ((e.key === 'Escape' || e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) && flow.mode === 'explore' && !document.querySelector('.modal-scrim')) {
        const deepest = [...LEVELS].reverse().find((l) => flow[l])
        const locked = deepest === 'holding' && (flow.session?.holdings.length ?? 0) <= 1
        if (deepest && !locked) {
          e.preventDefault()
          dispatch({ type: 'repick', level: deepest })
        }
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  })
  const { session } = flow
  if (!session) return null
  const holding = holdingOf(flow)
  const multi = session.holdings.length > 1
  const insights = flow.mode !== 'explore' || !!flow.store

  const valueOf = (l: Level): string | null => {
    if (!flow[l]) return null
    switch (l) {
      case 'holding':
        return holding!.name
      case 'industry':
        return industryById(flow.industry as IndustryId).name
      case 'brand':
        return brandOf(flow)!.name
      case 'country':
        return countryById(flow.country!).name
      case 'city':
        return cityById(flow.city!).name
      case 'store':
        return holding!.stores.find((s) => s.id === flow.store)!.name
    }
  }
  const crumbs = LEVELS.map((l) => {
    const value = valueOf(l)
    // A single-holding user can't change holding; everything else can be re-opened.
    const locked = l === 'holding' && !multi
    // A done crumb opens a switcher with its siblings, so any layer can be changed in one move.
    const onClick =
      value && !locked
        ? (el: HTMLElement) => {
            const r = el.getBoundingClientRect()
            setOpen((o) => (o?.level === l ? null : { level: l, x: Math.min(r.left, window.innerWidth - 336), y: r.bottom + 10 }))
          }
        : value && locked && flow.mode !== 'explore'
          ? () => dispatch({ type: 'focus', level: l })
          : undefined
    return { key: l, label: LEVEL_LABEL[l], value, onClick }
  })
  const activeIdx = crumbs.findIndex((c) => !c.value)

  return (
    <motion.nav className="hud" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease }}>
      <div className="hud-brand">
        <BrandMark size={28} />
        <span className="hud-word">Caisse Manager</span>
        <span className="hud-product label">Command Center</span>
      </div>

      <ol className="crumbs">
        {crumbs.map((c, i) => {
          const state = c.value ? 'done' : i === activeIdx ? 'active' : 'todo'
          if (state === 'todo') return null
          return (
            // Only long names (holding, store) give up space, so short ones ("Crusty", "Belgium") stay whole.
            <li key={c.key} className={`crumb ${state}`} style={{ flexShrink: (c.value?.length ?? 0) > 12 ? 1 : 0 }}>
              <button
                disabled={!c.onClick}
                onClick={(e) => c.onClick?.(e.currentTarget)}
                aria-expanded={open?.level === c.key}
                className={open?.level === c.key ? 'open' : ''}
                title={c.onClick ? `Switch ${c.label.toLowerCase()}` : undefined}
              >
                <span className="crumb-idx label">{String(i + 1).padStart(2, '0')}</span>
                <span className="crumb-text">
                  <small className="label">{c.label}</small>
                  <AnimatePresence mode="wait">
                    <motion.b key={c.value ?? 'empty'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
                      {c.value ?? (state === 'active' ? (insights ? ALL[c.key] : 'Selecting…') : '—')}
                    </motion.b>
                  </AnimatePresence>
                </span>
                {c.value && c.onClick && <CaretDown className="crumb-caret" size={12} weight="bold" />}
              </button>
              {i < crumbs.length - 1 && crumbs[i + 1].value !== undefined && (crumbs[i + 1].value || i + 1 === activeIdx) && <span className="crumb-link" />}
            </li>
          )
        })}
      </ol>

      {/* Layer switcher: siblings of the chosen crumb, one click to jump across. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key={open.level}
            className="crumb-pop"
            style={{ left: open.x, top: open.y }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
          >
            <small className="label">Switch {LEVEL_LABEL[open.level].toLowerCase()}</small>
            <ul>
              {optionsFor(flow, open.level).map((o) => {
                const on = o.id === flow[open.level]
                return (
                  <li key={o.id}>
                    <button
                      className={on ? 'on' : ''}
                      onClick={() => {
                        const level = open.level
                        setOpen(null)
                        if (on) return
                        const brands = level === 'industry' ? (holding?.brands.filter((b) => b.industry === o.id) ?? []) : []
                        dispatch({ type: 'select', level, id: o.id, autoBrand: brands.length === 1 ? brands[0].id : undefined })
                      }}
                    >
                      <span>
                        <b>{o.name}</b>
                        {o.sub && <small>{o.sub}</small>}
                      </span>
                      {on && <Check size={14} weight="bold" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              className="crumb-pop-foot"
              onClick={() => {
                const level = open.level
                setOpen(null)
                dispatch(flow.mode === 'insights' ? { type: 'focus', level } : { type: 'repick', level })
              }}
            >
              {flow.mode === 'insights' ? (
                <>
                  <ChartLineUp size={14} weight="bold" /> Consolidate at this level
                </>
              ) : (
                <>
                  <ArrowUp size={14} weight="bold" /> Browse all {PLURAL[open.level]}
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mode-toggle" role="tablist" aria-label="View mode">
        {(
          [
            ['apps', 'Apps', SquaresFour],
            ['explore', 'Explore', Compass],
            ['insights', 'Consolidated', ChartLineUp],
          ] as const
        )
          .filter(([m]) => m === 'apps' || session.role.commandCenter)
          .map(([m, label, Glyph]) => (
          <button key={m} role="tab" aria-selected={flow.mode === m} className={flow.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'mode', mode: m })}>
            {flow.mode === m && <motion.span layoutId="mode-pill" className="mode-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <Glyph size={16} weight="bold" />
            <span>{label}</span>
          </button>
          ))}
      </div>

      <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
        {theme === 'dark' ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
      </button>

      <div className="hud-user">
        <button className="user-btn" onClick={() => setMenu((m) => !m)}>
          <Avatar user={session.user} />
          <span className="user-meta">
            <b>{session.user.name}</b>
            <small className="label dim">{session.role.label}</small>
          </span>
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div className="panel user-menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
              <div className="dr-me">
                <Avatar user={session.user} />
                <div>
                  <b>{session.user.name}</b>
                  <small>{session.role.label}</small>
                </div>
              </div>
              <div className="label dim">{session.user.email}</div>
              <div className="label dim">
                {session.holdings.length} holding{multi ? 's' : ''} · session {session.token.slice(0, 8)}
              </div>
              <button
                className="btn-ghost danger"
                onClick={() => {
                  setMenu(false)
                  dispatch({ type: 'logout' })
                }}
              >
                <SignOut size={16} weight="bold" /> Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}
