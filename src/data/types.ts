import type { AppDef, AppId, RoleDef, RoleId } from './apps'

export type IndustryId = 'it' | 'hospitality' | 'harvest'

export interface Industry {
  id: IndustryId
  name: string
  tagline: string
}

export type BrandIcon = 'bread' | 'bowl' | 'wine' | 'laptop' | 'mobile' | 'headphones' | 'basket' | 'carrot' | 'orange' | 'leaf'

export interface Brand {
  id: string
  holdingId: string
  industry: IndustryId
  name: string
  tagline: string
  icon: BrandIcon
}

export interface Country {
  /** ISO 3166-1 numeric code, matches world-atlas feature ids */
  id: string
  code: string
  name: string
}

export interface City {
  id: string
  name: string
  countryId: string
  lat: number
  lon: number
}

export type StoreStatus = 'online' | 'degraded' | 'offline'

export interface Store {
  id: string
  name: string
  holdingId: string
  industry: IndustryId
  brandId: string
  countryId: string
  cityId: string
  lat: number
  lon: number
  address: string
  status: StoreStatus
  terminals: number
  openedYear: number
}

export interface Holding {
  id: string
  name: string
  code: string
  hq: string
  founded: number
  brands: Brand[]
  stores: Store[]
}

/** Which part of the tenancy tree a user may see. Omitted filters mean "everything in the holdings". */
export interface Assignment {
  holdingIds: string[]
  brandIds?: string[]
  countryIds?: string[]
  storeIds?: string[]
}

export interface User {
  id: string
  name: string
  email: string
  role: RoleId
  title: string
  assignment: Assignment
  /** Profile photo shown on the sign-in carousel. */
  photo?: string
  /** The person's profile in the POS (public/pos), so the POS opens straight on their account. */
  posId?: string
}

export type AppStatus = 'open' | 'locked'
export interface AppAccess {
  app: AppDef
  status: AppStatus
  /** Holdings in the user's scope that subscribe to it. */
  coverage: number
}

/** Where a user lands right after signing in. */
export type Route =
  | { kind: 'hub' }
  /** Single-app roles skip the hub. `targets` are the stores (or brands/holdings) the app can open on. */
  | { kind: 'direct'; appId: AppId; targets: string[] }
  | { kind: 'none' }

export interface Session {
  user: User
  role: RoleDef
  /** Holdings already narrowed to the user's assignment. */
  holdings: Holding[]
  apps: AppAccess[]
  route: Route
  token: string
}
