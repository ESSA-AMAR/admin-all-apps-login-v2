import { cityById, countryById, industryById } from '../data/mock'
import type { Holding, IndustryId, Store } from '../data/types'
import type { Flow, Level, ScopeLevel } from '../state'
import { breakdown, type BreakdownRow } from './kpis'

export const allHoldings = (f: Flow): Holding[] => f.session?.holdings ?? []
export const holdingOf = (f: Flow) => allHoldings(f).find((h) => h.id === f.holding) ?? null
export const brandOf = (f: Flow, id = f.brand) => holdingOf(f)?.brands.find((b) => b.id === id) ?? null

/** Every store the current selection covers. */
export function scopeStores(f: Flow): Store[] {
  const pool = f.holding ? (holdingOf(f)?.stores ?? []) : allHoldings(f).flatMap((h) => h.stores)
  return pool.filter(
    (s) =>
      (!f.industry || s.industry === f.industry) &&
      (!f.brand || s.brandId === f.brand) &&
      (!f.country || s.countryId === f.country) &&
      (!f.city || s.cityId === f.city) &&
      (!f.store || s.id === f.store),
  )
}

export function scopeName(f: Flow, level: ScopeLevel): string {
  switch (level) {
    case 'group':
      return 'All holdings'
    case 'holding':
      return holdingOf(f)!.name
    case 'industry':
      return industryById(f.industry as IndustryId).name
    case 'brand':
      return brandOf(f)!.name
    case 'country':
      return countryById(f.country!).name
    case 'city':
      return cityById(f.city!).name
    case 'store':
      return holdingOf(f)!.stores.find((s) => s.id === f.store)!.name
  }
}

export const LEVEL_LABEL: Record<ScopeLevel, string> = {
  group: 'Group',
  holding: 'Holding',
  industry: 'Industry',
  brand: 'Brand',
  country: 'Country',
  city: 'City',
  store: 'Store',
}

export interface Breakdown {
  title: string
  /** Level a row drills into, or null when the rows are informational only. */
  drill: Level | null
  rows: BreakdownRow[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The child groups shown on a consolidated dashboard: the primary one drills down the path. */
export function breakdownsFor(f: Flow, level: ScopeLevel, stores: Store[]): Breakdown[] {
  const holdings = allHoldings(f)
  const brandName = (id: string) => holdings.flatMap((h) => h.brands).find((b) => b.id === id)?.name ?? id
  const byIndustry = () => breakdown(stores, (s) => s.industry, (k) => industryById(k as IndustryId).name)
  const byCountry = () => breakdown(stores, (s) => s.countryId, (k) => countryById(k).name, (k) => countryById(k).code)
  const byCity = () => breakdown(stores, (s) => s.cityId, (k) => cityById(k).name, (k) => countryById(cityById(k).countryId).code)
  switch (level) {
    case 'group':
      return [
        { title: 'By holding', drill: 'holding', rows: breakdown(stores, (s) => s.holdingId, (k) => holdings.find((h) => h.id === k)!.name, (k) => holdings.find((h) => h.id === k)!.code) },
        { title: 'By industry', drill: null, rows: byIndustry() },
      ]
    case 'holding':
      return [
        { title: 'By industry', drill: 'industry', rows: byIndustry() },
        { title: 'By country', drill: null, rows: byCountry() },
      ]
    case 'industry':
      return [
        { title: 'By brand', drill: 'brand', rows: breakdown(stores, (s) => s.brandId, brandName, (k) => brandOf(f, k)?.tagline ?? '') },
        { title: 'By country', drill: null, rows: byCountry() },
      ]
    case 'brand':
      return [
        { title: 'By country', drill: 'country', rows: byCountry() },
        { title: 'By city', drill: null, rows: byCity() },
      ]
    case 'country':
      return [{ title: 'By city', drill: 'city', rows: byCity() }]
    case 'city':
      return [
        {
          title: 'By store',
          drill: 'store',
          rows: breakdown(stores, (s) => s.id, (k) => stores.find((s) => s.id === k)!.name, (k) => stores.find((s) => s.id === k)!.address),
        },
      ]
    case 'store':
      return []
  }
}

export const storesLabel = (n: number) => plural(n, 'store', 'stores')
