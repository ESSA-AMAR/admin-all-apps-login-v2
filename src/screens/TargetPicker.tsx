import { MagnifyingGlass, SignOut, X } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { AppGlyph } from '../components/appIcons'
import { ease } from '../components/ui'
import type { AppDef } from '../data/apps'
import { cityById } from '../data/mock'
import type { Holding } from '../data/types'
import { targetsFor } from '../services/access'

interface Option {
  id: string
  name: string
  sub: string
  group: string
  status?: string
}

/** Resolve a store/brand/holding id to a display name within the given holdings. */
export function targetName(id: string, holdings: Holding[]): string {
  for (const h of holdings) {
    if (h.id === id) return h.name
    const b = h.brands.find((x) => x.id === id)
    if (b) return b.name
    const s = h.stores.find((x) => x.id === id)
    if (s) return s.name
  }
  return id
}

/** "Where are you working today?" — shown when an app can open on more than one store/brand/holding. */
export function TargetPicker({
  app,
  holdings,
  onPick,
  onCancel,
  onSignOut,
  recent = [],
}: {
  app: AppDef
  holdings: Holding[]
  /** Ids opened recently by this user: shown first. */
  recent?: string[]
  onPick: (id: string) => void
  onCancel?: () => void
  onSignOut?: () => void
}) {
  const [q, setQ] = useState('')
  const options: Option[] = useMemo(() => {
    const ids = new Set(targetsFor(app, holdings))
    return holdings.flatMap((h) => {
      if (app.level === 'holding') return ids.has(h.id) ? [{ id: h.id, name: h.name, sub: h.hq, group: 'Holdings' }] : []
      if (app.level === 'brand')
        return h.brands.filter((b) => ids.has(b.id)).map((b) => ({ id: b.id, name: b.name, sub: b.tagline, group: h.name }))
      return h.stores
        .filter((s) => ids.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          sub: `${s.address}, ${cityById(s.cityId).name}`,
          group: `${h.code} · ${h.brands.find((b) => b.id === s.brandId)?.name}`,
          status: s.status,
        }))
    })
  }, [app, holdings])

  const RECENT = 'Recent'
  const recentOptions = recent.map((id) => options.find((o) => o.id === id)).filter((o): o is Option => !!o).map((o) => ({ ...o, group: RECENT }))
  const filtered = [...(q ? [] : recentOptions), ...options].filter((o) => `${o.name} ${o.sub} ${o.group}`.toLowerCase().includes(q.toLowerCase()))
  const groups = [...new Set(filtered.map((o) => o.group))]
  const noun = app.level === 'store' ? 'store' : app.level === 'brand' ? 'brand' : 'holding'

  return (
    <motion.div className="modal-scrim picker-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className="panel picker"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a ${noun}`}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.45, ease }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="corner tl" />
        <span className="corner br" />
        <div className="picker-head">
          <span className="app-icon">
            <AppGlyph id={app.id} size={26} />
          </span>
          <div>
            <small className="label red">{app.name}</small>
            <h2>{onCancel ? `Open on which ${noun}?` : `Where are you working today?`}</h2>
          </div>
          {onCancel ? (
            <button className="modal-x" onClick={onCancel} aria-label="Close">
              <X size={18} />
            </button>
          ) : (
            onSignOut && (
              <button className="btn-ghost" onClick={onSignOut}>
                <SignOut size={16} weight="bold" /> Sign out
              </button>
            )
          )}
        </div>
        {options.length > 6 && (
          <div className="search">
            <MagnifyingGlass size={18} />
            <input autoFocus placeholder={`Search ${noun}s…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="picker-list">
          {groups.map((g) => (
            <div key={g}>
              <small className="label dim picker-group">{g}</small>
              {filtered
                .filter((o) => o.group === g)
                .map((o, i) => (
                  <motion.button
                    key={`${g}-${o.id}`}
                    className={`picker-item ${g === RECENT ? 'recent' : ''}`}
                    onClick={() => onPick(o.id)}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.03, ease }}
                  >
                    <span>
                      <b>{o.name}</b>
                      <small className="dim">{o.sub}</small>
                    </span>
                    {o.status && <span className={`status ${o.status}`}>{o.status}</span>}
                  </motion.button>
                ))}
            </div>
          ))}
          {!filtered.length && <p className="dim">No match</p>}
        </div>
      </motion.div>
    </motion.div>
  )
}
