/**
 * The Caisse Manager app catalog, roles and subscriptions.
 *
 * Three ideas drive routing (see docs/ROLE-ROUTING.md):
 *  - an APP has a scope level: the tenancy node it runs against (a store, a brand, a holding)
 *  - an APP has a kind: operated by staff, run unattended on a paired device, or used for management
 *  - a ROLE grants a set of apps; SUBSCRIPTIONS (per holding) decide which of those are unlocked
 */

export type AppId =
  | 'pos'
  | 'pos_pro'
  | 'pos_v1'
  | 'pos_v2'
  | 'pos_v3'
  | 'pos_v3_web'
  | 'customer_display'
  | 'drive_thru'
  | 'screen_menu'
  | 'pos_mobile'
  | 'table_qr'
  | 'kiosk'
  | 'kds'
  | 'kds_v2'
  | 'kitchen_monitoring'
  | 'customer_queuing'
  | 'web_app'
  | 'mobile_app'
  | 'delivery_app'
  | 'stock'
  | 'attendance'
  | 'qr_ringer'

export type AppCategory = 'sales' | 'screens' | 'kitchen' | 'ordering' | 'operations'
/** staff = a person signs in · device = an unattended screen paired to a store · management = configured at brand/holding level */
export type AppKind = 'staff' | 'device' | 'management'
export type AppLevel = 'store' | 'brand' | 'holding'

export interface AppDef {
  id: AppId
  name: string
  tagline: string
  category: AppCategory
  kind: AppKind
  level: AppLevel
  /** Path on the single domain, e.g. /pos/:store */
  path: string
  /** Live build to embed in the shell; apps without one show a placeholder. */
  url?: string
}

/** The POS build, served from public/pos (a copy of caisse-manager-login-v2.vercel.app with the hub hand-off added). */
const POS_URL = '/pos/index.html'
/** POS Pro: its own page (public/pos-pro), started as a copy of the POS; it reuses the POS assets. */
const POS_PRO_URL = '/pos-pro/index.html'
/** POS v1: the POS with the original backdrop (light strands along the bottom that draw the logo); it reuses the POS assets. */
const POS_V1_URL = '/pos-v1/index.html'
/** POS v2: a copy of POS v1 to iterate on; it reuses the POS assets. */
const POS_V2_URL = '/pos-v2/index.html'
const KDS_URL = '/kds/index.html'
/** KDS v2: the kitchen display in the POS v2 style (Dark / Light / Smart); it shares the POS ⇄ KDS ticket link with the KDS above and reuses the POS assets. */
const KDS_V2_URL = '/kds-v2/index.html'
/** POS v3: a copy of POS v2 to iterate on (POS v2 stays as it is); it reuses the POS assets. */
const POS_V3_URL = '/pos-v3/index.html'
/** POS v3 Web: the POS with a lighter web whose constellation turns into the illustrated logo (it was POS v3 before); it reuses the POS assets. */
const POS_V3_WEB_URL = '/pos-v3-web/index.html'

export const CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: 'sales', label: 'Point of sale' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'screens', label: 'Customer screens' },
  { id: 'ordering', label: 'Ordering channels' },
  { id: 'operations', label: 'Operations' },
]

export const APPS: AppDef[] = [
  { id: 'pos', name: 'POS', tagline: 'Counter checkout, tickets & payments', category: 'sales', kind: 'staff', level: 'store', path: '/pos', url: POS_URL },
  { id: 'pos_pro', name: 'POS Pro', tagline: 'Multi-station POS with table plans & advanced rules', category: 'sales', kind: 'staff', level: 'store', path: '/pos-pro', url: POS_PRO_URL },
  { id: 'pos_v1', name: 'POS v1', tagline: 'The POS with the original light-strand backdrop', category: 'sales', kind: 'staff', level: 'store', path: '/pos-v1', url: POS_V1_URL },
  { id: 'pos_v2', name: 'POS v2', tagline: 'A copy of POS v1 to iterate on', category: 'sales', kind: 'staff', level: 'store', path: '/pos-v2', url: POS_V2_URL },
  { id: 'pos_v3', name: 'POS v3', tagline: 'A copy of POS v2 to iterate on', category: 'sales', kind: 'staff', level: 'store', path: '/pos-v3', url: POS_V3_URL },
  { id: 'pos_v3_web', name: 'POS v3 Web', tagline: 'The POS with a lighter web and the illustrated logo', category: 'sales', kind: 'staff', level: 'store', path: '/pos-v3-web', url: POS_V3_WEB_URL },
  { id: 'pos_mobile', name: 'POS Mobile', tagline: 'Order & pay at the table from a handheld', category: 'sales', kind: 'staff', level: 'store', path: '/pos-mobile', url: POS_URL },
  { id: 'kds', name: 'KDS', tagline: 'Kitchen display: tickets by station, bump & recall', category: 'kitchen', kind: 'staff', level: 'store', path: '/kds', url: KDS_URL },
  { id: 'kds_v2', name: 'KDS v2', tagline: 'The kitchen display in the POS v2 style: order queue by stage, availability & pagers', category: 'kitchen', kind: 'staff', level: 'store', path: '/kds-v2', url: KDS_V2_URL },
  { id: 'kitchen_monitoring', name: 'Kitchen Monitoring', tagline: 'Prep times, delays & load across kitchens', category: 'kitchen', kind: 'management', level: 'store', path: '/kitchen-monitoring' },
  { id: 'customer_display', name: 'Customer Display', tagline: 'Second screen facing the customer at the till', category: 'screens', kind: 'device', level: 'store', path: '/customer-display' },
  { id: 'drive_thru', name: 'Drive Thru', tagline: 'Lane order confirmation & pickup board', category: 'screens', kind: 'device', level: 'store', path: '/drive-thru' },
  { id: 'screen_menu', name: 'Screen Menu Display', tagline: 'Digital menu boards, synced with the catalogue', category: 'screens', kind: 'device', level: 'store', path: '/menu-display' },
  { id: 'kiosk', name: 'Kiosk', tagline: 'Self-ordering terminal with integrated payment', category: 'screens', kind: 'device', level: 'store', path: '/kiosk' },
  { id: 'customer_queuing', name: 'Customer Queuing', tagline: 'Order-ready board & queue numbers', category: 'screens', kind: 'device', level: 'store', path: '/queue' },
  { id: 'qr_ringer', name: 'QR Ringer', tagline: 'Scan-to-get-notified pager, no hardware buzzers', category: 'screens', kind: 'device', level: 'store', path: '/qr-ringer' },
  { id: 'table_qr', name: 'Table QR', tagline: 'Scan, order & pay from the table', category: 'ordering', kind: 'management', level: 'brand', path: '/table-qr' },
  { id: 'web_app', name: 'Web App', tagline: 'Branded online ordering website', category: 'ordering', kind: 'management', level: 'brand', path: '/web-app' },
  { id: 'mobile_app', name: 'Mobile App', tagline: 'Branded iOS & Android ordering app', category: 'ordering', kind: 'management', level: 'brand', path: '/mobile-app' },
  { id: 'delivery_app', name: 'Delivery App', tagline: 'Own-fleet dispatch & driver app', category: 'ordering', kind: 'staff', level: 'store', path: '/delivery' },
  { id: 'stock', name: 'Gestion de Stock', tagline: 'Inventory, suppliers, transfers & recipes', category: 'operations', kind: 'management', level: 'brand', path: '/stock' },
  { id: 'attendance', name: 'Attendance App', tagline: 'Clock-in, shifts & timesheets · 1–50 employees', category: 'operations', kind: 'management', level: 'holding', path: '/attendance' },
]

export const appById = (id: AppId) => APPS.find((a) => a.id === id)!

export type IntegrationGroup = 'delivery' | 'payments' | 'crm' | 'calling' | 'scales'
export interface Integration {
  id: string
  name: string
  group: IntegrationGroup
  note: string
}
export const INTEGRATION_GROUPS: { id: IntegrationGroup; label: string }[] = [
  { id: 'delivery', label: 'Delivery platforms' },
  { id: 'payments', label: 'Payments' },
  { id: 'crm', label: 'CRM' },
  { id: 'calling', label: 'Calling systems' },
  { id: 'scales', label: 'Scales' },
]
export const INTEGRATIONS: Integration[] = [
  { id: 'glovo', name: 'Glovo App', group: 'delivery', note: 'Marketplace orders into POS & KDS' },
  { id: 'glovo_od', name: 'Glovo On Demand', group: 'delivery', note: 'Courier for your own orders' },
  { id: 'yassir', name: 'Yassir App', group: 'delivery', note: 'Marketplace orders into POS & KDS' },
  { id: 'fantastic', name: 'Fantastic App', group: 'delivery', note: 'Marketplace orders into POS & KDS' },
  { id: 'kool', name: 'KOOL App', group: 'delivery', note: 'Marketplace orders into POS & KDS' },
  { id: 'cmi_tpe', name: 'TPE intégré CMI', group: 'payments', note: 'Card terminal driven by the POS' },
  { id: 'cmi_psp', name: 'PSP CMI', group: 'payments', note: 'Online payments for Web, Mobile & QR' },
  { id: 'glory', name: 'Glory', group: 'payments', note: 'Cash recycler, automatic change' },
  { id: 'odoo', name: 'Odoo', group: 'crm', note: 'Customers, accounting & ERP sync' },
  { id: 'syscall', name: 'Syscall', group: 'calling', note: 'Guest & staff paging' },
  { id: 'brehm', name: 'Brehm', group: 'scales', note: 'Certified weighing on the POS' },
]

export type RoleId =
  | 'super_admin'
  | 'holding_admin'
  | 'brand_manager'
  | 'regional_manager'
  | 'store_manager'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'driver'
  | 'employee'

export interface RoleDef {
  id: RoleId
  label: string
  /** Apps this role may use. Subscriptions decide which are unlocked. */
  apps: AppId[] | 'all'
  /** Can see the Command Center (hierarchy + consolidated dashboards). */
  commandCenter: boolean
  /** Sees apps the holding hasn't subscribed to, with a lock. Non-admins only see what they can open. */
  seesLocked: boolean
  /** Front-line roles sign in with a staff PIN on a store-bound terminal. */
  pin: boolean
}

const STORE_APPS: AppId[] = ['pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web', 'pos_pro', 'pos_mobile', 'kds', 'kds_v2', 'kitchen_monitoring', 'customer_display', 'drive_thru', 'screen_menu', 'kiosk', 'customer_queuing', 'qr_ringer', 'delivery_app', 'stock', 'attendance']

export const ROLES: Record<RoleId, RoleDef> = {
  super_admin: { id: 'super_admin', label: 'Super Admin', apps: 'all', commandCenter: true, seesLocked: true, pin: false },
  holding_admin: { id: 'holding_admin', label: 'Holding Admin', apps: 'all', commandCenter: true, seesLocked: true, pin: false },
  brand_manager: {
    id: 'brand_manager',
    label: 'Brand Manager',
    apps: ['web_app', 'mobile_app', 'table_qr', 'screen_menu', 'kiosk', 'stock', 'kitchen_monitoring'],
    commandCenter: true,
    seesLocked: false,
    pin: false,
  },
  regional_manager: {
    id: 'regional_manager',
    label: 'Regional Manager',
    apps: ['stock', 'attendance', 'kitchen_monitoring', 'screen_menu', 'customer_display', 'kiosk', 'pos'],
    commandCenter: true,
    seesLocked: false,
    pin: false,
  },
  store_manager: { id: 'store_manager', label: 'Store Manager', apps: STORE_APPS, commandCenter: true, seesLocked: false, pin: false },
  cashier: { id: 'cashier', label: 'Cashier', apps: ['pos_pro', 'pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web'], commandCenter: false, seesLocked: false, pin: true },
  waiter: { id: 'waiter', label: 'Waiter', apps: ['pos_mobile'], commandCenter: false, seesLocked: false, pin: true },
  kitchen: { id: 'kitchen', label: 'Kitchen Post', apps: ['kds', 'kds_v2'], commandCenter: false, seesLocked: false, pin: true },
  driver: { id: 'driver', label: 'Driver', apps: ['delivery_app'], commandCenter: false, seesLocked: false, pin: true },
  employee: { id: 'employee', label: 'Employee', apps: ['attendance'], commandCenter: false, seesLocked: false, pin: true },
}

/** What each holding pays for. Integrations are listed the same way. */
export const SUBSCRIPTIONS: Record<string, { apps: AppId[]; integrations: string[] }> = {
  cmh: {
    apps: ['pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web', 'pos_pro', 'pos_mobile', 'kds', 'kds_v2', 'kitchen_monitoring', 'customer_display', 'screen_menu', 'kiosk', 'customer_queuing', 'qr_ringer', 'table_qr', 'web_app', 'mobile_app', 'delivery_app', 'stock', 'attendance'],
    integrations: ['glovo', 'glovo_od', 'cmi_tpe', 'cmi_psp', 'glory', 'odoo', 'syscall'],
  },
  nlv: {
    apps: ['pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web', 'pos_pro', 'customer_display', 'web_app', 'stock', 'attendance'],
    integrations: ['odoo', 'brehm'],
  },
  ahg: {
    apps: ['pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web', 'pos_mobile', 'kds', 'kds_v2', 'kitchen_monitoring', 'customer_display', 'drive_thru', 'screen_menu', 'kiosk', 'customer_queuing', 'table_qr', 'delivery_app', 'attendance'],
    integrations: ['glovo', 'yassir', 'kool', 'cmi_tpe', 'cmi_psp', 'syscall'],
  },
  lmn: {
    apps: ['pos', 'pos_v1', 'pos_v2', 'pos_v3', 'pos_v3_web', 'kds', 'kds_v2', 'customer_display', 'qr_ringer', 'stock', 'attendance'],
    integrations: ['fantastic', 'cmi_tpe'],
  },
}
