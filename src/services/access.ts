import { APPS, ROLES, SUBSCRIPTIONS, type AppDef, type AppId } from '../data/apps'
import type { AppAccess, Assignment, Holding, Route, User } from '../data/types'

/** Narrow holdings to what the assignment allows: brands, countries or specific stores. */
export function scopeHoldings(all: Holding[], a: Assignment): Holding[] {
  return all
    .filter((h) => a.holdingIds.includes(h.id))
    .map((h) => {
      const stores = h.stores.filter(
        (s) =>
          (!a.brandIds || a.brandIds.includes(s.brandId)) &&
          (!a.countryIds || a.countryIds.includes(s.countryId)) &&
          (!a.storeIds || a.storeIds.includes(s.id)),
      )
      return { ...h, stores, brands: h.brands.filter((b) => stores.some((s) => s.brandId === b.id)) }
    })
    .filter((h) => h.stores.length > 0)
}

export const isSubscribed = (holdingId: string, app: AppId) => SUBSCRIPTIONS[holdingId]?.apps.includes(app) ?? false
export const hasIntegration = (holdingId: string, id: string) => SUBSCRIPTIONS[holdingId]?.integrations.includes(id) ?? false

/** Apps the user sees: their role's apps, unlocked where at least one of their holdings subscribes. */
export function appAccess(user: User, holdings: Holding[]): AppAccess[] {
  const role = ROLES[user.role]
  const allowed = role.apps === 'all' ? APPS : APPS.filter((a) => (role.apps as AppId[]).includes(a.id))
  return allowed
    .map((app) => {
      const coverage = holdings.filter((h) => isSubscribed(h.id, app.id)).length
      return { app, coverage, status: coverage > 0 ? ('open' as const) : ('locked' as const) }
    })
    .filter((a) => a.status === 'open' || role.seesLocked)
}

/** Every node an app can be opened on, within the user's scope. */
export function targetsFor(app: AppDef, holdings: Holding[]): string[] {
  const subscribed = holdings.filter((h) => isSubscribed(h.id, app.id))
  if (app.level === 'holding') return subscribed.map((h) => h.id)
  if (app.level === 'brand') return subscribed.flatMap((h) => h.brands.map((b) => b.id))
  return subscribed.flatMap((h) => h.stores.map((s) => s.id))
}

/**
 * Landing rule:
 *  - front-line roles (PIN) open their first unlocked app straight away; a store picker appears only
 *    when they work in more than one store
 *  - everybody else lands on the hub, already narrowed to their apps and region
 */
export function routeFor(user: User, holdings: Holding[], apps: AppAccess[]): Route {
  const role = ROLES[user.role]
  const open = apps.filter((a) => a.status === 'open')
  if (!open.length && !role.commandCenter) return { kind: 'none' }
  if (role.pin) {
    // Role apps are listed by preference (e.g. POS Pro before POS for a cashier).
    const order = role.apps as AppId[]
    const first = order.map((id) => open.find((a) => a.app.id === id)).find(Boolean)!
    return { kind: 'direct', appId: first.app.id, targets: targetsFor(first.app, holdings) }
  }
  return { kind: 'hub' }
}
