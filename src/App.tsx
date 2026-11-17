import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { Background } from './components/Background'
import { HUD } from './components/HUD'
import { Sidebar } from './components/Sidebar'
import { ScopePulse } from './components/ScopePulse'
import { ScopeSidebar, type SidebarRow } from './components/ScopeSidebar'
import { ScopeIcon } from './components/ui'
import { appById } from './data/apps'
import { BO_HOME, BO_INDEX, RANK, type BoItem } from './data/backoffice'
import { INDUSTRIES, industryById } from './data/mock'
import type { IndustryId } from './data/types'
import { brandOf, breakdownsFor, holdingOf, LEVEL_LABEL, scopeName, scopeStores, type Breakdown } from './lib/scope'
import { AppFrame } from './screens/AppFrame'
import { Brands } from './screens/Brands'
import { BoScreen } from './bo/BoScreen'
import { Dashboard } from './screens/Dashboard'
import { GeoExplorer, loadWorld } from './screens/GeoExplorer'
import { Holdings } from './screens/Holdings'
import { Industries } from './screens/Industries'
import { Launchpad } from './screens/Launchpad'
import { TargetPicker } from './screens/TargetPicker'
import { recentTargets, rememberTarget } from './lib/recent'
import { targetsFor } from './services/access'
import { Login } from './screens/Login'
import { initialFlow, LEVELS, reducer, scopeLevel, screenOf, type Level, type ScopeLevel } from './state'

/**
 * Screens zoom through the tenancy layers: going deeper (holding → industry → brand → map) the new
 * layer grows in from behind while the old one flies past the camera; going back up reverses it.
 * Both play at once (the screens overlap), so there is never an empty frame between them: the old one
 * leaves quickly, accelerating away, while the new one settles in more gently.
 */
const screenVariants: Variants = {
  // Scale + fade only: a full-screen blur on top of the map's own zoom flight made it stutter.
  enter: (d: number) => ({ opacity: 0, scale: d >= 0 ? 0.92 : 1.08 }),
  center: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }, transitionEnd: { transform: 'none' } },
  exit: (d: number) => ({ opacity: 0, scale: d >= 0 ? 1.08 : 0.92, pointerEvents: 'none', transition: { duration: 0.45, ease: [0.4, 0, 1, 1] as const } }),
}

/** How deep a screen sits in the layer stack, for the zoom direction. */
function depthOf(v: ReturnType<typeof screenOf>, store: boolean): number {
  switch (v.kind) {
    case 'login':
    case 'launchpad':
      return 0
    case 'pick':
      return { holding: 1, industry: 2, brand: 3 }[v.level]
    case 'geo':
      return 4
    case 'dashboard':
      return store ? 6 : 5
    default:
      return 7
  }
}

export default function App() {
  const [flow, dispatch] = useReducer(reducer, initialFlow)
  const [warp, setWarp] = useState(false)
  const view = screenOf(flow)
  // Direction of travel through the layers (+1 deeper, -1 back up), kept until the depth changes again.
  const depth = depthOf(view, !!flow.store)
  const lastDepth = useRef(depth)
  const dirRef = useRef(1)
  if (depth !== lastDepth.current) {
    dirRef.current = depth > lastDepth.current ? 1 : -1
    lastDepth.current = depth
  }
  const dir = dirRef.current
  const screen = { variants: screenVariants, custom: dir, initial: 'enter', animate: 'center', exit: 'exit' }
  const level = scopeLevel(flow)
  const scopeId = level === 'group' ? 'group' : flow[level]

  useEffect(() => {
    loadWorld() // warm the map data while the user signs in
  }, [])

  // Short warp burst whenever the screen or scope changes.
  const viewKey = `${view.kind}-${'level' in view ? view.level : ''}-${flow.holding}-${flow.industry}-${flow.brand}`
  useEffect(() => {
    if (view.kind === 'login') return
    setWarp(true)
    const t = setTimeout(() => setWarp(false), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])

  const holding = holdingOf(flow)
  const industry = flow.industry ? industryById(flow.industry as IndustryId) : null
  const brand = brandOf(flow)
  const stores = useMemo(() => scopeStores(flow), [flow])
  const multi = (flow.session?.holdings.length ?? 0) > 1
  const launchOrigin = useRef<DOMRect | null>(null)
  const hubUser = flow.session?.route.kind === 'hub'

  // The Back Office sidebar: a 264px panel, or a 64px rail with fly-outs. The choice is remembered on this device.
  const [boCollapsed, setBoCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cm-bo-collapsed') === '1'
    } catch {
      return false
    }
  })
  // Below 1100px there is no room for the panel: the rail is used whatever was chosen.
  const narrow = useSyncExternalStore(
    (cb) => {
      const m = matchMedia('(max-width: 1100px)')
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia('(max-width: 1100px)').matches,
    () => false,
  )
  const boRail = boCollapsed || narrow
  const toggleBo = () =>
    setBoCollapsed((c) => {
      try {
        localStorage.setItem('cm-bo-collapsed', c ? '0' : '1')
      } catch {
        /* the choice just is not remembered */
      }
      return !c
    })
  const showBo = hubUser && view.kind !== 'login' && view.kind !== 'app' && view.kind !== 'target'
  const boRank = flow.session ? (RANK[flow.session.role.id] ?? 0) : 0
  const boSeesLocked = !!flow.session?.role.seesLocked
  /** The sidebar item that is lit: the concept page open, or the item that stands for the screen in view. */
  const boActive = view.kind === 'page' ? view.key : view.kind === 'launchpad' ? BO_HOME.apps : view.kind === 'dashboard' ? BO_HOME.insights : BO_HOME.explore
  const boGo = (item: BoItem) => (item.to ? dispatch({ type: 'mode', mode: item.to }) : dispatch({ type: 'page', key: item.id }))

  /** Holdings narrowed to the scope in view: what the launchpad and app targets work against. */
  const scoped = useMemo(() => {
    const ids = new Set(stores.map((s) => s.id))
    return (flow.session?.holdings ?? [])
      .map((h) => {
        const st = h.stores.filter((s) => ids.has(s.id))
        return { ...h, stores: st, brands: h.brands.filter((b) => st.some((s) => s.brandId === b.id)) }
      })
      .filter((h) => h.stores.length)
  }, [flow.session, stores])

  /** Select a level, skipping the brand picker when an industry has a single brand. */
  const select = (l: Level, id: string) => {
    if (l === 'industry' && holding) {
      const brands = holding.brands.filter((b) => b.industry === id)
      dispatch({ type: 'select', level: l, id, autoBrand: brands.length === 1 ? brands[0].id : undefined })
    } else dispatch({ type: 'select', level: l, id })
  }

  /** Drilling from a consolidated row. City rows under a brand also need their country selected. */
  const drill = (b: Breakdown, key: string) => {
    if (!b.drill) return
    if (b.drill === 'city' && !flow.country) {
      const s = stores.find((x) => x.cityId === key)
      if (s) dispatch({ type: 'select', level: 'country', id: s.countryId })
    }
    select(b.drill, key)
  }

  // Selection steps: KPI sidebar on the right, previewing whichever option is hovered on the left.
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => setPreview(null), [viewKey])
  const sidebar = (l: 'group' | 'holding' | 'industry') => {
    let rows: SidebarRow[] = []
    let rowsLabel = ''
    let rowLevel = ''
    if (l === 'group') {
      rows = (flow.session?.holdings ?? []).map((h) => ({ id: h.id, name: h.name, stores: h.stores }))
      rowsLabel = 'holdings'
      rowLevel = 'Holding'
    } else if (l === 'holding' && holding) {
      rows = INDUSTRIES.map((i) => ({ id: i.id, name: i.name, stores: holding.stores.filter((s) => s.industry === i.id) })).filter((r) => r.stores.length)
      rowsLabel = 'industries'
      rowLevel = 'Industry'
    } else if (l === 'industry' && holding && industry) {
      rows = holding.brands
        .filter((b) => b.industry === industry.id)
        .map((b) => ({ id: b.id, name: b.name, stores: holding.stores.filter((s) => s.brandId === b.id) }))
      rowsLabel = 'brands'
      rowLevel = 'Brand'
    }
    const p = rows.find((r) => r.id === preview)
    return (
      <ScopeSidebar
        level={LEVEL_LABEL[l]}
        name={scopeName(flow, l)}
        stores={stores}
        rows={rows}
        rowsLabel={rowsLabel}
        preview={p ? { name: p.name, level: rowLevel, stores: p.stores } : null}
        onDetails={() => dispatch({ type: 'mode', mode: 'insights' })}
      />
    )
  }

  const pulse = (l: ScopeLevel) => (
    <ScopePulse level={LEVEL_LABEL[l]} name={scopeName(flow, l)} stores={stores} onOpen={() => dispatch({ type: 'mode', mode: 'insights' })} />
  )

  /** Labels of the levels above `l`, e.g. ["CMH", "Hospitality", "Crusty"]. */
  const path = (l: ScopeLevel) =>
    l === 'group'
      ? [`${flow.session?.holdings.length} holdings`]
      : LEVELS.slice(0, LEVELS.indexOf(l))
          .filter((x) => flow[x])
          .map((x) => (x === 'holding' ? holding!.code : scopeName(flow, x)))

  return (
    <div className={`app${showBo ? ' has-bo' : ''}${showBo && boRail ? ' bo-rail' : ''}`}>
      <Background intensity={warp ? 1 : 0} />
      <AnimatePresence>{view.kind !== 'login' && view.kind !== 'app' && hubUser && <HUD flow={flow} dispatch={dispatch} />}</AnimatePresence>
      {showBo && (
        <Sidebar
          collapsed={boRail}
          onToggle={toggleBo}
          active={boActive}
          onNavigate={boGo}
          rank={boRank}
          seesLocked={boSeesLocked}
          counts={{ 'hierarchy.outlets': String(stores.length) }}
        />
      )}

      <main className="stage">
        <AnimatePresence custom={dir}>
          {view.kind === 'login' && (
            <motion.div key="login" className="stage-inner" {...screen}>
              <Login onAuthenticated={(session) => dispatch({ type: 'login', session })} />
            </motion.div>
          )}

          {(view.kind === 'launchpad' || (view.kind === 'target' && hubUser)) && flow.session && (
            <motion.div key={`launchpad-${scopeId}`} className="stage-inner scroll" {...screen}>
              <Launchpad
                session={flow.session}
                scoped={scoped}
                scopeName={scopeName(flow, level)}
                scopePath={path(level)}
                stores={stores}
                onLaunch={(app, origin) => {
                  launchOrigin.current = origin
                  const targets = targetsFor(app, scoped)
                  dispatch({ type: 'launch', appId: app.id, target: targets.length === 1 ? targets[0] : null })
                }}
                onCommand={(mode) => dispatch({ type: 'mode', mode })}
                onChangeScope={() => dispatch({ type: 'mode', mode: 'explore' })}
              />
            </motion.div>
          )}

          {view.kind === 'app' && flow.session && flow.launch?.target && (
            <motion.div key={`app-${flow.launch.appId}-${flow.launch.target}`} className="stage-inner app-host" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AppFrame
                app={appById(flow.launch.appId)}
                target={flow.launch.target}
                session={flow.session}
                origin={launchOrigin.current}
                onBack={hubUser ? () => dispatch({ type: 'close-app' }) : undefined}
                onSignOut={() => dispatch({ type: 'logout' })}
              />
            </motion.div>
          )}

          {view.kind === 'pick' && view.level === 'holding' && flow.session && (
            <motion.div key="pick-holding" className="stage-inner" {...screen}>
              <Holdings holdings={flow.session.holdings} pulse={sidebar('group')} onSelect={(id) => select('holding', id)} onPreview={setPreview} />
            </motion.div>
          )}

          {view.kind === 'pick' && view.level === 'industry' && holding && (
            <motion.div key={`pick-industry-${holding.id}`} className="stage-inner" {...screen}>
              <Industries holding={holding} single={!multi} pulse={sidebar('holding')} onSelect={(id) => select('industry', id)} onPreview={setPreview} />
            </motion.div>
          )}

          {view.kind === 'pick' && view.level === 'brand' && holding && industry && (
            <motion.div key={`pick-brand-${holding.id}-${industry.id}`} className="stage-inner" {...screen}>
              <Brands holding={holding} industry={industry} index={multi ? '03' : '02'} pulse={sidebar('industry')} onSelect={(id) => select('brand', id)} onPreview={setPreview} />
            </motion.div>
          )}

          {view.kind === 'geo' && holding && industry && brand && (
            <motion.div key={`geo-${brand.id}`} className="stage-inner full" {...screen}>
              <GeoExplorer
                stores={holding.stores.filter((s) => s.brandId === brand.id)}
                industry={industry}
                brandName={brand.name}
                countryId={flow.country}
                cityId={flow.city}
                onCountry={(id) => (id ? select('country', id) : dispatch({ type: 'repick', level: 'country' }))}
                onCity={(id) => (id ? select('city', id) : dispatch({ type: 'repick', level: 'city' }))}
                onStore={(id) => select('store', id)}
                onWarp={setWarp}
                pulse={pulse(level)}
              />
            </motion.div>
          )}

          {view.kind === 'page' && BO_INDEX.has(view.key) && (
            <motion.div key={`page-${view.key}`} className="stage-inner scroll" {...screen}>
              <BoScreen id={view.key} ctx={{ stores, holdings: scoped, scopeName: scopeName(flow, level) }} onPick={boGo} dispatch={dispatch} locked={!!BO_INDEX.get(view.key)?.group.plan} />
            </motion.div>
          )}

          {view.kind === 'dashboard' && stores.length > 0 && (
            <motion.div key={`dash-${view.level}-${scopeId}`} className="stage-inner scroll" {...screen}>
              <Dashboard
                scope={{
                  level: view.level,
                  name: scopeName(flow, view.level),
                  path: path(view.level),
                  icon: <ScopeIcon level={view.level} industry={flow.industry as IndustryId | null} brandIcon={brand?.icon} size={40} />,
                }}
                stores={stores}
                breakdowns={breakdownsFor(flow, view.level, stores)}
                onDrill={drill}
                onSwitch={view.level === 'store' ? () => dispatch({ type: 'repick', level: 'store' }) : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view.kind === 'target' && flow.session && flow.launch && (
            <TargetPicker
              key="picker"
              app={appById(flow.launch.appId)}
              holdings={hubUser ? scoped : flow.session.holdings}
              recent={recentTargets(flow.session.user.id)}
              onPick={(id) => {
                rememberTarget(flow.session!.user.id, id)
                launchOrigin.current = null
                dispatch({ type: 'launch', appId: flow.launch!.appId, target: id })
              }}
              onCancel={hubUser ? () => dispatch({ type: 'close-app' }) : undefined}
              onSignOut={() => dispatch({ type: 'logout' })}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
