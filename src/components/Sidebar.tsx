import { AppWindow, ArrowsLeftRight, BookOpen, CalendarCheck, CaretDown, CashRegister, ChartBar, CookingPot, Handshake, Lock, Package, Receipt, Scales, ShieldCheck, SidebarSimple, SquaresFour, Table, TreeStructure } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BACKOFFICE, type BoBadge, type BoGroup, type BoItem, type BoSection } from '../data/backoffice'

/** One icon per group (Phosphor, regular weight). */
const ICONS: Record<string, Icon> = {
  hierarchy: TreeStructure,
  parties: Handshake,
  governance: Scales,
  access: ShieldCheck,
  sales: Receipt,
  cash: CashRegister,
  dining: Table,
  reservations: CalendarCheck,
  kitchen: CookingPot,
  stock: Package,
  catalogue: BookOpen,
  dashboards: SquaresFour,
  reports: ChartBar,
  reconciliations: ArrowsLeftRight,
  estate: AppWindow,
}

interface Props {
  collapsed: boolean
  onToggle: () => void
  /** Id of the lit item. */
  active: string
  onNavigate: (item: BoItem, group: BoGroup, section: BoSection) => void
  /** The role's reach (see RANK) and whether it may see what is outside the plan, locked. */
  rank: number
  seesLocked: boolean
  /** Live totals that replace a demo badge, by item id. */
  counts?: Record<string, string>
}

const Pill = ({ b }: { b: BoBadge }) => <span className={`bo-pill ${b.kind}`}>{b.value}</span>

export function Sidebar({ collapsed, onToggle, active, onNavigate, rank, seesLocked, counts = {} }: Props) {
  // What this role reaches: groups it cannot act in are not drawn; a group outside the plan is locked, or not drawn for roles that cannot see locked things.
  const sections = useMemo(
    () =>
      BACKOFFICE.map((s) => ({ ...s, groups: s.groups.filter((g) => rank >= g.min && (!g.plan || seesLocked)) })).filter((s) => s.groups.length),
    [rank, seesLocked],
  )

  const groupOfActive = useMemo(() => {
    for (const s of BACKOFFICE) for (const g of s.groups) if (g.items.some((i) => i.id === active)) return g.id
    return null
  }, [active])

  const [open, setOpen] = useState<Set<string>>(() => new Set(groupOfActive ? [groupOfActive] : ['hierarchy']))
  // Arriving some other way (the top bar, a card) opens the group of the item that lights up.
  const [seenGroup, setSeenGroup] = useState(groupOfActive)
  if (groupOfActive !== seenGroup) {
    setSeenGroup(groupOfActive)
    if (groupOfActive) setOpen((o) => (o.has(groupOfActive) ? o : new Set(o).add(groupOfActive)))
  }

  // Collapsed rail: a tap on a group opens a fly-out with its items, next to the rail.
  const [fly, setFly] = useState<{ id: string; top: number } | null>(null)
  const asideRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  // The lit item stays in view when it is reached some other way (the top bar, a card).
  useEffect(() => {
    navRef.current?.querySelector('.bo-i.on')?.scrollIntoView({ block: 'nearest' })
  }, [active])
  useEffect(() => {
    if (!fly) return
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.bo-fly, .bo-g')) setFly(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setFly(null)
    addEventListener('pointerdown', away)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', away)
      removeEventListener('keydown', esc)
    }
  }, [fly])
  // Expanding or collapsing the rail closes any open fly-out.
  const [wasCollapsed, setWasCollapsed] = useState(collapsed)
  if (collapsed !== wasCollapsed) {
    setWasCollapsed(collapsed)
    setFly(null)
  }

  const toggleGroup = (g: BoGroup, el: HTMLElement) => {
    if (collapsed) {
      const r = el.getBoundingClientRect()
      setFly((f) => (f?.id === g.id ? null : { id: g.id, top: Math.max(72, Math.min(r.top, innerHeight - 56 - g.items.length * 44)) }))
      return
    }
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(g.id)) n.delete(g.id)
      else n.add(g.id)
      return n
    })
  }

  const badgeOf = (i: BoItem): BoBadge | undefined => (counts[i.id] ? { kind: 'n', value: counts[i.id] } : i.badge)
  const groupWarn = (g: BoGroup) => g.items.some((i) => badgeOf(i)?.kind === 'warn')
  const locked = (g: BoGroup) => !!g.plan

  const itemButton = (i: BoItem, g: BoGroup, s: BoSection) => {
    const b = badgeOf(i)
    return (
      <button
        key={i.id}
        type="button"
        className={`bo-i${i.id === active ? ' on' : ''}${i.soon ? ' soon' : ''}`}
        title={i.fr}
        aria-current={i.id === active ? 'page' : undefined}
        onClick={() => (setFly(null), onNavigate(i, g, s))}
      >
        <span className="bo-i-l">{i.label}</span>
        {i.soon && <span className="bo-soon">soon</span>}
        {locked(g) && <Lock size={14} aria-label="Not in your plan" />}
        {b && <Pill b={b} />}
      </button>
    )
  }

  const flyGroup = fly ? BACKOFFICE.flatMap((s) => s.groups.map((g) => ({ g, s }))).find((x) => x.g.id === fly.id) : null

  return (
    <>
    <aside ref={asideRef} className={`bo-side${collapsed ? ' rail' : ''}`} aria-label="Back Office">
      <div className="bo-head">
        {!collapsed && <span className="bo-title">Back Office</span>}
        <button type="button" className="bo-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand' : 'Collapse'}>
          <SidebarSimple size={22} />
        </button>
      </div>

      <nav ref={navRef} className="bo-nav">
        {sections.map((s) => (
          <div className="bo-sec" key={s.id}>
            {collapsed ? <i className="bo-sec-rule" aria-hidden="true" /> : <h3 className="bo-sec-t" title={s.fr}>{s.label}</h3>}
            {s.groups.map((g) => {
              const Ic = ICONS[g.id]
              const isOpen = !collapsed && open.has(g.id)
              const has = g.id === groupOfActive
              return (
                <div className="bo-grp" key={g.id}>
                  <button
                    type="button"
                    className={`bo-g${has ? ' has' : ''}${isOpen ? ' open' : ''}${fly?.id === g.id ? ' fly' : ''}`}
                    aria-expanded={collapsed ? fly?.id === g.id : isOpen}
                    title={collapsed ? `${g.label} · ${g.fr}` : g.fr}
                    onClick={(e) => toggleGroup(g, e.currentTarget)}
                  >
                    <span className="bo-g-ic">
                      <Ic size={22} />
                      {collapsed && groupWarn(g) && <i className="bo-dot" aria-hidden="true" />}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="bo-g-l">{g.label}</span>
                        {locked(g) && <Lock size={14} aria-label="Not in your plan" />}
                        {!isOpen && groupWarn(g) && <i className="bo-dot" aria-hidden="true" />}
                        <CaretDown size={14} weight="bold" className="bo-caret" />
                      </>
                    )}
                  </button>
                  {isOpen && <div className="bo-items">{g.items.map((i) => itemButton(i, g, s))}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

    </aside>
      {collapsed && fly && flyGroup && (
        <div className="bo-fly" style={{ top: fly.top }} role="menu" aria-label={flyGroup.g.label}>
          <div className="bo-fly-h">
            <small>{flyGroup.s.label}</small>
            <b>{flyGroup.g.label}</b>
          </div>
          {flyGroup.g.items.map((i) => itemButton(i, flyGroup.g, flyGroup.s))}
        </div>
      )}
    </>
  )
}
