import { ArrowRight, ChartLineUp, Compass, Link, LockSimple, MagnifyingGlass, PaperPlaneTilt, X } from '@phosphor-icons/react'
import { sceneForApp } from '../lib/media'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { AppGlyph, IntegrationGlyph } from '../components/appIcons'
import { CountUp, DecodeText, ease } from '../components/ui'
import { CATEGORIES, INTEGRATION_GROUPS, INTEGRATIONS, type AppCategory, type AppDef, type AppKind } from '../data/apps'
import type { AppAccess, Holding, Session, Store } from '../data/types'
import { consolidate, eur } from '../lib/kpis'
import { hasIntegration, isSubscribed, targetsFor } from '../services/access'

interface Props {
  session: Session
  /** Holdings narrowed to the current scope (stores outside it removed). */
  scoped: Holding[]
  scopeName: string
  scopePath: string[]
  stores: Store[]
  onLaunch: (app: AppDef, origin: DOMRect) => void
  onCommand: (mode: 'explore' | 'insights') => void
  onChangeScope: () => void
}

const KIND_LABEL: Record<AppKind, string> = { staff: 'Staff app', device: 'Paired screen', management: 'Back office' }

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Launchpad({ session, scoped, scopeName, scopePath, stores, onLaunch, onCommand, onChangeScope }: Props) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<AppCategory | 'all'>('all')
  const [request, setRequest] = useState<AppDef | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const { role, user } = session

  // Status is re-evaluated for the scope in view: an app open for the group may be locked for one holding.
  const access: AppAccess[] = useMemo(
    () =>
      session.apps
        .map((a) => {
          const coverage = scoped.filter((h) => isSubscribed(h.id, a.app.id)).length
          return { ...a, coverage, status: coverage > 0 ? ('open' as const) : ('locked' as const) }
        })
        .filter((a) => a.status === 'open' || role.seesLocked),
    [session.apps, scoped, role.seesLocked],
  )

  const q = query.trim().toLowerCase()
  const visible = access.filter(
    (a) => (cat === 'all' || a.app.category === cat) && (!q || `${a.app.name} ${a.app.tagline} ${a.app.category}`.toLowerCase().includes(q)),
  )
  const openCount = access.filter((a) => a.status === 'open').length
  const lockedCount = access.length - openCount

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const launchFirst = () => {
    const first = visible.find((a) => a.status === 'open')
    const el = first && document.querySelector<HTMLElement>(`[data-app="${first.app.id}"]`)
    if (first && el) onLaunch(first.app, el.getBoundingClientRect())
  }

  const k = useMemo(() => consolidate(stores), [stores])
  const showIntegrations = role.seesLocked

  return (
    <div className="screen launchpad">
      <motion.header className="lp-head" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
        <div>
          <div className="eyebrow">
            <span className="eyebrow-index">{role.label.toUpperCase()}</span>
            <span className="eyebrow-line" />
            <DecodeText text="LAUNCHPAD" />
          </div>
          <h1 className="step-title">
            {greeting()}, <em>{user.name.split(' ')[0]}</em>
          </h1>
          <p className="step-sub">
            {openCount} {openCount === 1 ? 'app' : 'apps'} ready
            {lockedCount > 0 && `, ${lockedCount} available to add`} · signed in once, every app opens without a second login.
          </p>
        </div>
        <button className="scope-pill" onClick={onChangeScope} title="Change scope">
          <small className="label">Scope</small>
          <b>{scopeName}</b>
          <span className="label dim">{scopePath.join(' · ') || `${stores.length} stores`}</span>
        </button>
      </motion.header>

      <motion.div className="lp-toolbar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease }}>
        <div className="search lp-search">
          <MagnifyingGlass size={18} />
          <input
            ref={searchRef}
            placeholder="Search apps…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && launchFirst()}
          />
          <kbd className="label">⌘K</kbd>
        </div>
        <div className="lp-cats" role="tablist">
          {[{ id: 'all' as const, label: 'All' }, ...CATEGORIES].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              {cat === c.id && <motion.span layoutId="cat-pill" className="cat-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {role.commandCenter && cat === 'all' && !q && (
        <motion.section className="command-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease }}>
          <span className="corner tl" />
          <span className="corner br" />
          <div className="cc-orbit" aria-hidden>
            <i />
            <i />
            <ChartLineUp size={34} weight="duotone" />
          </div>
          <div className="cc-copy">
            <small className="label">Command Center</small>
            <h2>{stores.length > 1 ? `${stores.length} stores in one view` : `${scopeName}, live`}</h2>
            <p className="dim">{stores.length > 1 ? 'Walk the network on the map or open consolidated KPIs at any level.' : 'Sales, target, terminals and staff for your store.'}</p>
          </div>
          <div className="cc-figs">
            <div>
              <small className="label dim">Revenue today</small>
              <b>
                <CountUp value={k.revenueToday} format={(v) => eur(v)} />
              </b>
            </div>
            <div>
              <small className="label dim">Stores online</small>
              <b>
                {k.status.online}/{k.storeCount}
              </b>
            </div>
          </div>
          <div className="cc-actions">
            <button className="btn-secondary" onClick={() => onCommand('explore')}>
              <Compass size={16} weight="bold" /> Explore
            </button>
            <button className="btn-primary cc-primary" onClick={() => onCommand('insights')}>
              <ChartLineUp size={16} weight="bold" /> Consolidated
            </button>
          </div>
        </motion.section>
      )}

      {visible.length > 0 && (
        <section className="lp-section">
          <div className="lp-section-head">
            <h3 className="label">{cat === 'all' ? 'All apps' : CATEGORIES.find((c) => c.id === cat)?.label}</h3>
            <span className="lp-rule" />
            <span className="label dim">
              {visible.filter((a) => a.status === 'open').length}/{visible.length}
            </span>
          </div>
          <div className="app-grid">
            {CATEGORIES.flatMap((c) => visible.filter((a) => a.app.category === c.id)).map((a, i) => (
              <AppCard
                key={a.app.id}
                access={a}
                targets={a.status === 'open' ? targetsFor(a.app, scoped).length : 0}
                delay={0.15 + Math.min(i, 12) * 0.04}
                requested={sent.includes(a.app.id)}
                onLaunch={(rect) => onLaunch(a.app, rect)}
                onRequest={() => setRequest(a.app)}
              />
            ))}
          </div>
        </section>
      )}

      {visible.length === 0 && <p className="dim lp-empty">No app matches “{query}”.</p>}

      {showIntegrations && cat === 'all' && !q && (
        <section className="lp-section">
          <div className="lp-section-head">
            <h3 className="label">Integrations</h3>
            <span className="lp-rule" />
            <span className="label dim">
              {INTEGRATIONS.filter((it) => scoped.some((h) => hasIntegration(h.id, it.id))).length}/{INTEGRATIONS.length} connected
            </span>
          </div>
          <div className="int-groups">
            {INTEGRATION_GROUPS.map((g, gi) => (
              <motion.div
                key={g.id}
                className="panel int-group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 + gi * 0.06, ease }}
              >
                <div className="int-head">
                  <span className="int-icon">
                    <IntegrationGlyph group={g.id} />
                  </span>
                  <b>{g.label}</b>
                </div>
                <ul>
                  {INTEGRATIONS.filter((it) => it.group === g.id).map((it) => {
                    const on = scoped.some((h) => hasIntegration(h.id, it.id))
                    return (
                      <li key={it.id} className={on ? 'on' : ''}>
                        <span className="int-mono">{it.name.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                        <span className="int-name">
                          <b>{it.name}</b>
                          <small className="dim">{it.note}</small>
                        </span>
                        <span className={`int-state label ${on ? 'on' : ''}`}>
                          {on ? (
                            <>
                              <Link size={12} weight="bold" /> Connected
                            </>
                          ) : (
                            'Available'
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {request && (
          <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRequest(null)}>
            <motion.div
              className="panel modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Request ${request.name}`}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.35, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="corner tl" />
              <button className="modal-x" onClick={() => setRequest(null)} aria-label="Close">
                <X size={18} />
              </button>
              <span className="app-icon locked big">
                <AppGlyph id={request.id} size={36} />
                <LockSimple size={16} weight="fill" className="lock-badge" />
              </span>
              <small className="label red">Not in your plan</small>
              <h2>Add {request.name}</h2>
              <p className="dim">{request.tagline}.</p>
              <ul className="modal-facts">
                <li>
                  <span className="dim">Runs on</span>
                  <b>{request.level === 'store' ? 'Each store' : request.level === 'brand' ? 'Each brand' : 'The holding'}</b>
                </li>
                <li>
                  <span className="dim">Type</span>
                  <b>{KIND_LABEL[request.kind]}</b>
                </li>
                <li>
                  <span className="dim">For</span>
                  <b>{scopeName}</b>
                </li>
              </ul>
              <button
                className="btn-primary"
                onClick={() => {
                  setSent((s) => [...s, request.id])
                  setRequest(null)
                }}
              >
                <PaperPlaneTilt size={18} weight="bold" /> Request activation
              </button>
              <small className="dim modal-note">Your Caisse Manager account manager gets the request with the scope above.</small>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AppCard({
  access,
  targets,
  delay,
  requested,
  onLaunch,
  onRequest,
}: {
  access: AppAccess
  targets: number
  delay: number
  requested: boolean
  onLaunch: (rect: DOMRect) => void
  onRequest: () => void
}) {
  const { app, status } = access
  const locked = status === 'locked'
  const unit = app.level === 'store' ? 'store' : app.level === 'brand' ? 'brand' : 'holding'
  const onMove = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <motion.button
      data-app={app.id}
      className={`app-card ${locked ? 'locked' : ''}`}
      onMouseMove={onMove}
      onClick={(e) => {
        if (locked) onRequest()
        else onLaunch(e.currentTarget.querySelector('.app-icon')!.getBoundingClientRect())
      }}
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease }}
      whileTap={{ scale: 0.97 }}
      aria-label={locked ? `${app.name}, locked. Request access` : `Open ${app.name}`}
    >
      <span className="app-cover" style={{ backgroundImage: `url(${sceneForApp(app.id)})` }} />
      <span className="app-cat label">{CATEGORIES.find((c) => c.id === app.category)?.label}</span>
      <span className="app-sheen" />
      <span className={`app-icon ${locked ? 'locked' : ''}`}>
        <AppGlyph id={app.id} />
        {locked && <LockSimple size={14} weight="fill" className="lock-badge" />}
      </span>
      <span className="app-name">{app.name}</span>
      <span className="app-tag">{app.tagline}</span>
      <span className="app-foot">
        {locked ? (
          <span className="label app-lock">{requested ? 'Requested' : 'Request access'}</span>
        ) : (
          <span className="label dim">
            {targets} {unit}
            {targets === 1 ? '' : 's'} · {KIND_LABEL[app.kind]}
          </span>
        )}
        <span className="app-go">{locked ? <LockSimple size={14} weight="bold" /> : <ArrowRight size={14} weight="bold" />}</span>
      </span>
    </motion.button>
  )
}
