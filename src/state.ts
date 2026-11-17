import type { AppId } from './data/apps'
import type { Session } from './data/types'

/** The tenancy path, top to bottom. */
export const LEVELS = ['holding', 'industry', 'brand', 'country', 'city', 'store'] as const
export type Level = (typeof LEVELS)[number]
/** "group" is the consolidated view across every holding of a multi-holding user. */
export type ScopeLevel = 'group' | Level

/** apps = launchpad; explore = pick the next level; insights = consolidated dashboard of the current scope. */
export type Mode = 'apps' | 'explore' | 'insights'

/** An app being opened. `target` is the store/brand/holding id, null while the user still has to pick one. */
export interface Launch {
  appId: AppId
  target: string | null
}

export interface Flow {
  session: Session | null
  mode: Mode
  holding: string | null
  industry: string | null
  brand: string | null
  country: string | null
  city: string | null
  store: string | null
  launch: Launch | null
  /** A Back Office sidebar item that has no screen of its own yet (a concept page), or null. */
  page: string | null
}

export type Action =
  | { type: 'login'; session: Session }
  | { type: 'select'; level: Level; id: string; autoBrand?: string }
  /** Re-open the picker for `level` (clears it and everything below). */
  | { type: 'repick'; level: Level }
  /** Keep `level` selected, drop everything below it. */
  | { type: 'focus'; level: Level }
  | { type: 'mode'; mode: Mode }
  | { type: 'launch'; appId: AppId; target: string | null }
  | { type: 'close-app' }
  /** Open a Back Office concept page (or leave it with null). */
  | { type: 'page'; key: string | null }
  | { type: 'logout' }

export const initialFlow: Flow = {
  session: null,
  mode: 'explore',
  holding: null,
  industry: null,
  brand: null,
  country: null,
  city: null,
  store: null,
  launch: null,
  page: null,
}

const clearFrom = (s: Flow, from: number): Flow => {
  const next = { ...s }
  for (const l of LEVELS.slice(from)) next[l] = null
  return next
}

/**
 * Walk down the path while each level has exactly one option: nobody should pick from a list of one.
 * A store manager therefore lands pinned to their store; a brand manager to their brand.
 */
function descend(s: Flow): Flow {
  const next = { ...s }
  const holdings = s.session?.holdings ?? []
  if (!next.holding) {
    if (holdings.length !== 1) return next
    next.holding = holdings[0].id
  }
  const h = holdings.find((x) => x.id === next.holding)
  if (!h) return next
  let pool = h.stores
  const keyOf: Record<Exclude<Level, 'holding'>, (st: (typeof pool)[number]) => string> = {
    industry: (st) => st.industry,
    brand: (st) => st.brandId,
    country: (st) => st.countryId,
    city: (st) => st.cityId,
    store: (st) => st.id,
  }
  for (const l of ['industry', 'brand', 'country', 'city', 'store'] as const) {
    if (!next[l]) {
      const options = [...new Set(pool.map(keyOf[l]))]
      if (options.length !== 1) return next
      next[l] = options[0]
    }
    pool = pool.filter((st) => keyOf[l](st) === next[l])
  }
  return next
}

export function reducer(s: Flow, a: Action): Flow {
  switch (a.type) {
    case 'login': {
      const base = descend({ ...initialFlow, session: a.session })
      const r = a.session.route
      if (r.kind === 'direct') {
        // Front-line roles go straight into their app; with several stores they pick one first.
        return { ...base, launch: { appId: r.appId, target: r.targets.length === 1 ? r.targets[0] : null } }
      }
      // Command-center roles start at the top of the tenancy path (holding → industry → brand → map).
      return { ...base, mode: a.session.role.commandCenter ? 'explore' : 'apps' }
    }
    case 'select': {
      const next = clearFrom(s, LEVELS.indexOf(a.level) + 1)
      next[a.level] = a.id
      next.page = null
      if (a.level === 'industry' && a.autoBrand) next.brand = a.autoBrand
      return a.level === 'holding' ? descend(next) : next
    }
    case 'launch':
      return { ...s, page: null, launch: { appId: a.appId, target: a.target } }
    case 'close-app':
      return { ...s, launch: null, page: null, mode: 'apps' }
    case 'page':
      return { ...s, page: a.key }
    case 'repick':
      return { ...clearFrom(s, LEVELS.indexOf(a.level)), page: null, mode: s.mode === 'apps' ? 'apps' : 'explore' }
    case 'focus':
      return { ...clearFrom(s, LEVELS.indexOf(a.level) + 1), page: null }
    case 'mode':
      return { ...s, mode: a.mode, page: null }
    case 'logout':
      return initialFlow
  }
}

export type Screen =
  | { kind: 'login' }
  | { kind: 'launchpad' }
  | { kind: 'target' }
  | { kind: 'app' }
  | { kind: 'pick'; level: 'holding' | 'industry' | 'brand' }
  | { kind: 'geo' }
  | { kind: 'dashboard'; level: ScopeLevel }
  | { kind: 'page'; key: string }

/** The deepest level that is currently selected, or "group" when nothing is. */
export function scopeLevel(f: Flow): ScopeLevel {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (f[LEVELS[i]]) return LEVELS[i]
  return 'group'
}

export function screenOf(f: Flow): Screen {
  if (!f.session) return { kind: 'login' }
  if (f.launch) return { kind: f.launch.target ? 'app' : 'target' }
  if (f.page) return { kind: 'page', key: f.page }
  if (f.mode === 'apps') return { kind: 'launchpad' }
  if (f.store) return { kind: 'dashboard', level: 'store' }
  if (f.mode === 'insights') return { kind: 'dashboard', level: scopeLevel(f) }
  if (!f.holding) return { kind: 'pick', level: 'holding' }
  if (!f.industry) return { kind: 'pick', level: 'industry' }
  if (!f.brand) return { kind: 'pick', level: 'brand' }
  return { kind: 'geo' }
}
