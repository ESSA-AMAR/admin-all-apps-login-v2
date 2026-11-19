/**
 * The Back Office sidebar concept: 5 sections, 15 groups, 65 items.
 * Source: the "Migrated Design" workspace (Constructeur de hiérarchie), where the sidebar is defined. English names come from that
 * workspace's own translations; the original French name stays on each entry (`fr`) and is shown as the tooltip.
 *
 * Rules carried over from that design:
 *  - navigation follows from actions: a role only sees a group it can do something in (`min`, a rank, see RANK);
 *  - a group outside the client's plan is shown locked to the roles that may see locked things, and hidden from the others;
 *  - an item that is not built yet carries "soon";
 *  - counters: grey = a plain total, red pill = something to handle, violet pill = changes waiting in the draft.
 */
import type { RoleId } from './apps'

export type BoBadge = { kind: 'n' | 'warn' | 'draft'; value: string }

export interface BoItem {
  id: string
  label: string
  fr: string
  /** Where it goes inside this app today; items without it open a concept page. */
  to?: 'apps' | 'explore' | 'insights'
  soon?: boolean
  badge?: BoBadge
}

export interface BoGroup {
  id: string
  label: string
  fr: string
  /** What the group holds, in one sentence (shown on its concept pages). */
  desc: string
  /** Lowest role rank that sees the group (see RANK). */
  min: number
  /** Outside the client's plan: locked for roles that see locked things, hidden for the others. */
  plan?: boolean
  items: BoItem[]
}

export interface BoSection {
  id: string
  label: string
  fr: string
  groups: BoGroup[]
}

/** How much of the Back Office a command-center role reaches. */
export const RANK: Partial<Record<RoleId, number>> = {
  super_admin: 4,
  holding_admin: 3,
  brand_manager: 2,
  regional_manager: 1,
  store_manager: 0,
}

const item = (id: string, label: string, fr: string, x: Partial<BoItem> = {}): BoItem => ({ id, label, fr, ...x })

export const BACKOFFICE: BoSection[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    fr: 'Organisation',
    groups: [
      {
        id: 'hierarchy',
        label: 'Hierarchy',
        fr: 'Hiérarchie',
        desc: 'The whole structure of the client, level by level. Each node has a type (the client’s own word) and the facets it is responsible for.',
        min: 0,
        items: [
          item('hierarchy.tree', 'Organisation tree', 'Arbre d’organisation'),
          item('hierarchy.profile', 'Activities & profiles', 'Activités & profils'),
          item('hierarchy.outlets', 'Outlets', 'Points d’exploitation'),
          item('hierarchy.opening', 'Openings & go-live', 'Ouverture & mise en service'),
        ],
      },
      {
        id: 'parties',
        label: 'Third parties & ownership',
        fr: 'Tiers & propriété',
        desc: 'Suppliers, franchisees and partners; who owns and who operates each outlet; their contracts and territories.',
        min: 3,
        plan: true,
        items: [
          item('parties.suppliers', 'Suppliers', 'Fournisseurs'),
          item('parties.directory', 'Third-party directory', 'Annuaire des tiers'),
          item('parties.ownership', 'Ownership & operation', 'Propriété & exploitation'),
          item('parties.contracts', 'Contracts & territories', 'Contrats & territoires'),
        ],
      },
      {
        id: 'governance',
        label: 'Governance',
        fr: 'Gouvernance',
        desc: 'The policies that flow down from the client’s root node: what they are, the value that applies where, and what has drifted.',
        min: 3,
        items: [
          item('governance.registry', 'Policy registry', 'Registre des politiques', { badge: { kind: 'n', value: '24' } }),
          item('governance.effective', 'Effective values', 'Valeurs effectives'),
          item('governance.deviations', 'Configuration deviations', 'Écarts de configuration', { badge: { kind: 'n', value: '6' } }),
          item('governance.io', 'Import / Export', 'Import / Export'),
          item('governance.log', 'Activity log', 'Journal d’activité', { badge: { kind: 'n', value: '128' } }),
          item('governance.publishing', 'Publishing', 'Publication', { badge: { kind: 'draft', value: '3' } }),
          item('governance.taxes', 'Taxes & rounding', 'Taxes & arrondis', { soon: true }),
        ],
      },
      {
        id: 'access',
        label: 'Access & roles',
        fr: 'Accès & rôles',
        desc: 'Back-office accounts, roles and permissions. A role is granted on a node and covers its whole sub-tree.',
        min: 3,
        items: [
          item('access.accounts', 'Back-office accounts', 'Comptes back-office', { badge: { kind: 'warn', value: '1' } }),
          item('access.roles', 'Roles & permissions', 'Rôles & permissions'),
          item('access.scopes', 'Access scopes', 'Portées d’accès'),
          item('access.security', 'Security & authentication', 'Sécurité & authentification'),
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    fr: 'Exploitation',
    groups: [
      {
        id: 'sales',
        label: 'Sales',
        fr: 'Ventes',
        desc: 'Tickets, open orders, refunds and credit notes across the scope in view.',
        min: 0,
        items: [
          item('sales.tickets', 'Tickets', 'Tickets'),
          item('sales.orders', 'Open orders', 'Commandes ouvertes'),
          item('sales.refunds', 'Refunds & credit notes', 'Remboursements & avoirs', { badge: { kind: 'warn', value: '2' } }),
        ],
      },
      {
        id: 'cash',
        label: 'Cash',
        fr: 'Caisse',
        desc: 'Cash sessions, fund movements, closes and reconciliation, and the platform sessions.',
        min: 0,
        items: [
          item('cash.sessions', 'Cash sessions', 'Sessions de caisse', { badge: { kind: 'warn', value: '2' } }),
          item('cash.movements', 'Cash movements', 'Mouvements de fonds'),
          item('cash.closes', 'Closes & reconciliation', 'Clôtures & rapprochement'),
          item('cash.platforms', 'Platform sessions', 'Sessions plateformes'),
        ],
      },
      {
        id: 'dining',
        label: 'Dining room',
        fr: 'Salle',
        desc: 'The floor plan, the tables and sections, and the live state of every table. The back office never changes a table’s state.',
        min: 0,
        items: [
          item('dining.plan', 'Floor plan', 'Plan de salle'),
          item('dining.tables', 'Tables & sections', 'Tables & sections'),
          item('dining.live', 'Live table status', 'État des tables en direct', { badge: { kind: 'warn', value: '3' } }),
        ],
      },
      {
        id: 'reservations',
        label: 'Reservations',
        fr: 'Réservations',
        desc: 'The calendar, the services and their availability, the waitlist and the pager stations.',
        min: 0,
        items: [
          item('reservations.calendar', 'Calendar', 'Calendrier'),
          item('reservations.services', 'Services & availability', 'Services & disponibilités'),
          item('reservations.waitlist', 'Waitlist', 'Liste d’attente'),
          item('reservations.pagers', 'Pager stations', 'Bornes de bipeurs'),
        ],
      },
      {
        id: 'kitchen',
        label: 'Kitchen',
        fr: 'Cuisine',
        desc: 'The kitchen as it runs today: the stages of the day, rush mode, what is sold out, and a way to test an order.',
        min: 0,
        items: [
          item('kitchen.stages', 'Today’s stages', 'Étapes du jour'),
          item('kitchen.rush', 'Rush mode', 'Mode affluence'),
          item('kitchen.soldout', 'Sold out / back on sale', 'Épuisé / remise en vente'),
          item('kitchen.test', 'Test an order', 'Tester une commande'),
        ],
      },
      {
        id: 'stock',
        label: 'Stock',
        fr: 'Stock',
        desc: 'Stock levels, supplier receipts, order cycles, transfers between sites and physical inventory.',
        min: 0,
        items: [
          item('stock.levels', 'Stock levels', 'Niveaux de stock'),
          item('stock.receipts', 'Supplier receipts', 'Réceptions fournisseurs'),
          item('stock.cycles', 'Order cycles', 'Cycles de commande'),
          item('stock.transfers', 'Transfers between sites', 'Transferts entre sites'),
          item('stock.inventory', 'Physical inventory', 'Inventaire physique'),
        ],
      },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    fr: 'Commerce',
    groups: [
      {
        id: 'catalogue',
        label: 'Catalogue',
        fr: 'Catalogue',
        desc: 'The articles sold, with their prices and where they are offered.',
        min: 2,
        items: [item('catalogue.articles', 'Articles', 'Articles · stub', { soon: true })],
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    fr: 'Analyse',
    groups: [
      {
        id: 'dashboards',
        label: 'Dashboards',
        fr: 'Tableaux de bord',
        desc: 'The scope in view at a glance, and how its parts compare. Nothing in Analytics changes an amount.',
        min: 0,
        items: [
          item('dashboards.overview', 'Overview', 'Vue d’ensemble', { to: 'insights' }),
          item('dashboards.ranking', 'Ranking & comparison', 'Classement & comparaison'),
          item('dashboards.currencies', 'Currencies & exchange rates', 'Devises & taux de conversion'),
        ],
      },
      {
        id: 'reports',
        label: 'Reports',
        fr: 'Rapports',
        desc: 'Printable reports by period, channel and currency: sales, products, payments, cash, kitchen, stock and employees.',
        min: 0,
        items: [
          item('reports.sales', 'Sales', 'Ventes'),
          item('reports.products', 'Products', 'Produits'),
          item('reports.payments', 'Payments', 'Paiements'),
          item('reports.cash', 'Cash & variances', 'Caisse & écarts'),
          item('reports.kitchen', 'Kitchen', 'Cuisine'),
          item('reports.stock', 'Stock', 'Stock'),
          item('reports.employees', 'Employees', 'Employés'),
        ],
      },
      {
        id: 'reconciliations',
        label: 'Reconciliations',
        fr: 'Rapprochements',
        desc: 'What the books say against what the bank, the platforms and the card terminals say.',
        min: 1,
        items: [
          item('reconciliations.bank', 'Bank reconciliation', 'Rapprochement bancaire'),
          item('reconciliations.invoices', 'Platform invoices', 'Factures plateformes'),
          item('reconciliations.cards', 'Card-terminal reconciliation', 'Rapprochement monétique'),
        ],
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    fr: 'Plateforme',
    groups: [
      {
        id: 'estate',
        label: 'Application estate',
        fr: 'Parc applicatif',
        desc: 'The applications of the client and what each is entitled to. KDS carries the kitchen app’s configuration; the other applications are coming.',
        min: 4,
        items: [
          item('estate.apps', 'Applications & entitlements', 'Applications & entitlements', { to: 'apps' }),
          item('estate.pos', 'POS', 'POS'),
          item('estate.mpos', 'Mobile POS', 'Mobile POS', { soon: true }),
          item('estate.kiosk', 'Kiosk', 'Kiosk', { soon: true }),
          item('estate.kds', 'KDS', 'KDS', { to: 'apps' }),
          item('estate.integrations', 'Integrations', 'Intégrations'),
          item('estate.queue', 'Customer queueing', 'Customer queueing', { soon: true }),
          item('estate.display', 'Customer display', 'Customer display', { soon: true }),
          item('estate.drive', 'Drive-thru display', 'Drive-thru display', { soon: true }),
        ],
      },
    ],
  },
]

/** Every item with the group and section it belongs to, for lookups. */
export const BO_INDEX = new Map<string, { item: BoItem; group: BoGroup; section: BoSection }>(
  BACKOFFICE.flatMap((section) => section.groups.flatMap((group) => group.items.map((i) => [i.id, { item: i, group, section }] as const))),
)

/** Where each in-app screen sits in the sidebar, so the right item is lit when you arrive some other way. */
export const BO_HOME = { apps: 'estate.apps', explore: 'hierarchy.tree', insights: 'dashboards.overview' } as const
