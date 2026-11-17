/**
 * What each of the 65 Back Office items shows. `screenFor(id, ctx)` returns the screen for one item, built from the kit.
 * The data is demo data: stable (seeded) and drawn from the scope in view (outlets, brands, staff, payment mix, top products), so what you see changes with the scope.
 */
import { useState, type ReactNode } from 'react'
import type { Holding, Store } from '../data/types'
import { cityById, countryById, industryById } from '../data/mock'
import { eur, storeKpis } from '../lib/kpis'
import { between, pick, rng } from '../lib/random'
import { Banner, BarList, Btn, Cards, Chips, DataTable, Kpis, Pill, Section, Seg, Settings, Timeline, Toolbar, useSay, type CardItem, type Cell, type CellObj, type Col, type Row, type SettingRow, type Tone } from './kit'
import { ALL_TABLES, Board, FloorPlan, ImportExport, OpeningSteps, OrgTree, ReservationCalendar, RoleGrid, TABLE_STATE_LABEL, TABLE_STATE_TONE, TestOrder } from './views'

export interface Ctx {
  stores: Store[]
  holdings: Holding[]
  scopeName: string
  /** Open one of the three live screens: the map (explore), the dashboard (insights) or the launchpad (apps). */
  go: (mode: 'apps' | 'explore' | 'insights') => void
}

export interface Screen {
  desc?: string
  actions?: ReactNode
  body: ReactNode
}

/* ───────────────────────── helpers ───────────────────────── */

const T = (t: string | number, o: Omit<CellObj, 't'> = {}): CellObj => ({ t, ...o })
const M = (n: number, d = 2): CellObj => ({ t: eur(n, d), n })
const S = (t: string, tone: Tone, dashed?: boolean): CellObj => ({ t, tone, dashed })
const pct = (n: number, max: number) => Math.round((n / Math.max(1, max)) * 100)

const PEOPLE = ['Sarah Lambert', 'Yanis Benali', 'Nadia El Amrani', 'Tom Peeters', 'Youssef El Idrissi', 'Driss Amrani', 'Rayan Kaci', 'Hugo Martin', 'Lina Bakri', 'Elad Ilyas', 'Amira Khelifi', 'Lucas Dubois']
const day = (back = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

const outlets = (c: Ctx) => (c.stores.length ? c.stores : [{ id: 'x', name: 'Main outlet' } as Store])
const outletOf = (c: Ctx, r: () => number) => pick(r, outlets(c)).name
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

function Act({ label, say, primary }: { label: string; say: string; primary?: boolean }) {
  const s = useSay()
  return (
    <Btn primary={primary} onClick={() => s(say)}>
      {label}
    </Btn>
  )
}
const Go = ({ label, go, mode }: { label: string; go: Ctx['go']; mode: Parameters<Ctx['go']>[0] }) => <Btn onClick={() => go(mode)}>{label}</Btn>

const table = (p: Parameters<typeof DataTable>[0]) => <DataTable {...p} />
const dateOf = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ───────────────────────── Organisation ───────────────────────── */

function outletsScreen(c: Ctx): Screen {
  const cols: Col[] = [
    { key: 'name', label: 'Outlet', kind: 'sub' },
    { key: 'brand', label: 'Brand' },
    { key: 'city', label: 'City', kind: 'sub' },
    { key: 'status', label: 'Status', kind: 'pill' },
    { key: 'terminals', label: 'Terminals', kind: 'num' },
    { key: 'opened', label: 'Opened', kind: 'num' },
    { key: 'rev', label: 'Revenue today', kind: 'num' },
  ]
  const brands = new Map(c.holdings.flatMap((h) => h.brands.map((b) => [b.id, b.name] as const)))
  const rows: Row[] = c.stores.map((s) => ({
    id: s.id,
    name: T(s.name, { sub: s.address }),
    brand: brands.get(s.brandId) ?? '',
    city: T(cityById(s.cityId).name, { sub: countryById(s.countryId).name }),
    status: S(s.status === 'online' ? 'Online' : s.status === 'degraded' ? 'Degraded' : 'Offline', s.status === 'online' ? 'ok' : s.status === 'degraded' ? 'warn' : 'danger'),
    terminals: s.terminals,
    opened: s.openedYear,
    rev: M(storeKpis(s).revenueToday, 0),
  }))
  const on = c.stores.filter((s) => s.status === 'online').length
  return {
    desc: 'Every outlet in the scope in view, with its status and what it sold today.',
    actions: <Act label="Add an outlet" say="This would start the opening steps" primary />,
    body: (
      <>
        <Kpis items={[{ label: 'Outlets', value: String(c.stores.length) }, { label: 'Online', value: String(on), tone: 'ok' }, { label: 'Degraded', value: String(c.stores.filter((s) => s.status === 'degraded').length), tone: 'warn' }, { label: 'Offline', value: String(c.stores.filter((s) => s.status === 'offline').length), tone: 'danger' }]} />
        {table({
          cols, rows, search: 'Search outlets, cities, brands', filter: { key: 'status', label: 'Status' }, initialSort: { key: 'rev', dir: 'desc' },
          drawer: (r) => ({ title: String(text(r.name)), status: r.status && <Pill tone={(r.status as CellObj).tone}>{text(r.status)}</Pill>, actions: [{ label: 'Open the dashboard', primary: true, say: 'This would open the dashboard of this outlet' }] }),
        })}
      </>
    ),
  }
}
const text = (c: Cell | undefined) => (c === undefined ? '' : typeof c === 'object' ? c.t : c)

function profileScreen(c: Ctx): Screen {
  const inds = new Map<string, { stores: number; brands: Set<string> }>()
  for (const s of c.stores) {
    const e = inds.get(s.industry) ?? { stores: 0, brands: new Set<string>() }
    e.stores++
    e.brands.add(s.brandId)
    inds.set(s.industry, e)
  }
  const PROFILE: Record<string, [string, string]> = { hospitality: ['Full service · tables, kitchen, reservations', 'POS, KDS, Reservations'], it: ['Retail & service desk · repairs, devices', 'POS, Kiosk'], harvest: ['Market · weighed goods, baskets', 'POS, Mobile POS'] }
  const items: CardItem[] = [...inds.entries()].map(([id, e]) => ({
    title: industryById(id as never).name,
    sub: industryById(id as never).tagline,
    pill: { text: 'Profile applied', tone: 'ok' },
    meta: [['Profile', PROFILE[id]?.[0] ?? '—'], ['Default apps', PROFILE[id]?.[1] ?? '—'], ['Brands', String(e.brands.size)], ['Outlets', String(e.stores)]],
    actions: [{ label: 'Change the profile', say: 'This would open the profile choices' }],
  }))
  return { desc: 'An activity decides which apps, screens and defaults an outlet starts with. A profile is the set for one activity.', body: <Cards items={items} cols={3} /> }
}

function openingScreen(c: Ctx): Screen {
  const b = c.holdings[0]?.brands[0]?.name ?? 'New outlet'
  const list = [
    { id: 'o1', name: `${b} · Utrecht`, sub: 'Opening 24 Nov · Utrecht, NL', done: 3 },
    { id: 'o2', name: `${b} · Lille`, sub: 'Opening 02 Dec · Lille, FR', done: 1 },
    { id: 'o3', name: `${b} · Ghent`, sub: 'Opening 09 Dec · Ghent, BE', done: 5 },
  ]
  return { desc: 'Six steps from a name on the map to a till that takes its first customer. Each outlet in opening shows where it stands.', body: <OpeningSteps outlets={list} /> }
}

/* Third parties & ownership */

function partiesScreens(c: Ctx): Record<string, Screen> {
  const r = rng('parties')
  const SUP = [['Volailles Atlas', 'Poultry'], ['Boulangerie du Centre', 'Bakery'], ['Frigo Distribution', 'Cold chain'], ['Atlas Boissons', 'Beverages'], ['Marché Nord', 'Fresh produce'], ['Café Torrefacto', 'Coffee'], ['Emballages Plus', 'Packaging'], ['Maison Vanille', 'Dairy']]
  const suppliers: Row[] = SUP.map(([n, cat], i) => ({
    id: `s${i}`, name: T(n, { sub: `${n.toLowerCase().replace(/[^a-z]/g, '')}@suppliers.example` }), cat, contact: pick(r, PEOPLE), sites: Math.min(outlets(c).length, 2 + Math.floor(r() * 5)), last: day(Math.floor(r() * 9)), status: i === 6 ? S('Paused', 'warn') : S('Active', 'ok'),
  }))
  const parties: Row[] = [
    ...SUP.slice(0, 4).map(([n], i) => ({ id: `p${i}`, name: T(n, { sub: 'Supplier' }), type: 'Supplier', country: ['Morocco', 'Belgium', 'France', 'Netherlands'][i], since: String(2019 + i), status: S('Active', 'ok') })),
    { id: 'f1', name: T('Nordic Table SARL', { sub: 'Franchisee' }), type: 'Franchisee', country: 'France', since: '2021', status: S('Active', 'ok') },
    { id: 'f2', name: T('Lumen Food GmbH', { sub: 'Franchisee' }), type: 'Franchisee', country: 'Luxembourg', since: '2023', status: S('Invited', 'info') },
    { id: 'l1', name: T('Immo Centrum', { sub: 'Landlord' }), type: 'Landlord', country: 'Belgium', since: '2018', status: S('Active', 'ok') },
    { id: 'pt1', name: T('Glovo', { sub: 'Delivery partner' }), type: 'Partner', country: 'Spain', since: '2022', status: S('Active', 'ok') },
    { id: 'pt2', name: T('Uber Eats', { sub: 'Delivery partner' }), type: 'Partner', country: 'Netherlands', since: '2022', status: S('Suspended', 'warn') },
  ]
  const own: Row[] = outlets(c).slice(0, 12).map((s, i) => {
    const m = ['Own', 'Own', 'Franchise', 'Licence'][i % 4]
    return { id: s.id, name: T(s.name, { sub: s.id }), owner: m === 'Franchise' ? 'Nordic Table SARL' : 'Client', operator: m === 'Own' ? 'Client' : m === 'Franchise' ? 'Nordic Table SARL' : 'Lumen Food GmbH', model: S(m, m === 'Own' ? 'neutral' : 'info'), royalty: m === 'Own' ? '—' : m === 'Franchise' ? '5,0 %' : '3,5 %' }
  })
  const contracts: Row[] = [
    { id: 'c1', party: 'Nordic Table SARL', type: 'Franchise', territory: 'France, Hauts-de-France', royalty: '5,0 %', ends: dateOf(412), status: S('Active', 'ok') },
    { id: 'c2', party: 'Lumen Food GmbH', type: 'Licence', territory: 'Luxembourg', royalty: '3,5 %', ends: dateOf(38), status: S('Ends in 38 days', 'warn') },
    { id: 'c3', party: 'Immo Centrum', type: 'Lease', territory: 'Brussels, Central', royalty: '—', ends: dateOf(1190), status: S('Active', 'ok') },
    { id: 'c4', party: 'Volailles Atlas', type: 'Supply', territory: 'All outlets', royalty: '—', ends: dateOf(240), status: S('Active', 'ok') },
    { id: 'c5', party: 'Marché Nord', type: 'Supply', territory: 'Benelux', royalty: '—', ends: dateOf(-12), status: S('Ended', 'neutral', true) },
  ]
  return {
    'parties.suppliers': { desc: 'The companies that supply the outlets, with who to call and what they serve.', actions: <Act label="Add a supplier" say="This would open the supplier form" primary />, body: table({ cols: [{ key: 'name', label: 'Supplier', kind: 'sub' }, { key: 'cat', label: 'Category' }, { key: 'contact', label: 'Contact' }, { key: 'sites', label: 'Outlets served', kind: 'num' }, { key: 'last', label: 'Last order' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: suppliers, search: 'Search suppliers', filter: { key: 'cat', label: 'Category' }, drawer: (x) => ({ title: String(text(x.name)), actions: [{ label: 'Place an order', primary: true, say: 'This would open a new order for this supplier' }] }) }) },
    'parties.directory': { desc: 'Everyone the client does business with: suppliers, franchisees, landlords and partners.', actions: <Act label="Add a party" say="This would open the party form" primary />, body: table({ cols: [{ key: 'name', label: 'Name', kind: 'sub' }, { key: 'type', label: 'Type' }, { key: 'country', label: 'Country' }, { key: 'since', label: 'Since', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: parties, search: 'Search the directory', filter: { key: 'type', label: 'Type' } }) },
    'parties.ownership': { desc: 'For each outlet, who owns it and who runs it. This is where franchise and licence outlets are told apart from the client’s own.', body: table({ cols: [{ key: 'name', label: 'Outlet', kind: 'sub' }, { key: 'owner', label: 'Owner' }, { key: 'operator', label: 'Operator' }, { key: 'model', label: 'Model', kind: 'pill' }, { key: 'royalty', label: 'Royalty', kind: 'num' }], rows: own, search: 'Search outlets', filter: { key: 'model', label: 'Model' } }) },
    'parties.contracts': { desc: 'Contracts with their territory and end date. One that ends within 60 days is flagged.', actions: <Act label="Add a contract" say="This would open the contract form" primary />, body: table({ cols: [{ key: 'party', label: 'Party', kind: 'strong' }, { key: 'type', label: 'Type' }, { key: 'territory', label: 'Territory', kind: 'chips' }, { key: 'royalty', label: 'Royalty', kind: 'num' }, { key: 'ends', label: 'Ends' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: contracts, search: 'Search contracts', filter: { key: 'type', label: 'Type' }, drawer: (x) => ({ title: `${text(x.party)} · ${text(x.type)}`, actions: [{ label: 'Renew', primary: true, say: 'This would draft a renewal' }] }) }) },
  }
}

/* Governance */

function governanceScreens(c: Ctx): Record<string, Screen> {
  const POL: [string, string, string, string, number][] = [
    ['Receipt footer text', 'Receipts', 'Brand', 'Thank you for visiting', 41], ['Rounding rule', 'Tax', 'Country', 'Nearest 0,05 €', 58], ['Tip suggestions', 'Payments', 'Brand', '5 % · 10 % · 15 %', 33],
    ['Ticket numbering', 'Receipts', 'Outlet', 'Daily reset', 58], ['Default currency', 'Tax', 'Country', 'EUR', 58], ['Refund approval above', 'Sales', 'Brand', '50,00 €', 41], ['Cash drawer variance alert', 'Cash', 'Client', '5,00 €', 58],
    ['Kitchen late threshold', 'Kitchen', 'Brand', '15 min', 33], ['Service charge', 'Payments', 'Outlet', 'Off', 12], ['Loyalty points per euro', 'Sales', 'Client', '1', 58], ['Reservation hold time', 'Reservations', 'Outlet', '15 min', 27], ['Stock count frequency', 'Stock', 'Brand', 'Weekly', 41],
  ]
  const registry: Row[] = POL.map(([n, area, lvl, def, used], i) => ({ id: `pol${i}`, name: T(n, { sub: `Set at the ${lvl.toLowerCase()} level` }), area, level: lvl, def, used, status: S('Published', 'ok') }))
  const dev: Row[] = outlets(c).slice(0, 8).map((s, i) => {
    const [n, , , def] = POL[[8, 5, 7, 2, 10, 3, 0, 11][i % 8]]
    const loc = ['On', '30,00 €', '20 min', '0 %, 10 %', '10 min', 'Weekly reset', 'Visit us again', 'Daily'][i % 8]
    return { id: `d${i}`, outlet: T(s.name, { sub: s.id }), policy: n, inherited: def, local: T(loc, { tone: 'draft' }), since: day(3 + i * 4), status: i % 3 === 0 ? S('Needs review', 'warn') : S('Accepted', 'ok') }
  })
  const eff = (node: string): SettingRow[] => {
    const from = node === 'Client' ? 'Defined here' : node === 'Brand' ? 'Inherited from Client' : 'Inherited from Brand'
    return [
      { name: 'Rounding rule', kind: 'value', value: 'Nearest 0,05 €', source: { text: node === 'Client' ? 'Defined here' : 'Inherited from Client', tone: node === 'Client' ? 'ok' : 'neutral' } },
      { name: 'Refund approval above', kind: 'value', value: '50,00 €', source: { text: from, tone: from === 'Defined here' ? 'ok' : 'neutral' } },
      { name: 'Tip suggestions', kind: 'value', value: '5 % · 10 % · 15 %', source: { text: node === 'Outlet' ? 'Defined here' : 'Inherited from Brand', tone: node === 'Outlet' ? 'ok' : 'neutral' } },
      { name: 'Service charge', kind: 'value', value: node === 'Outlet' ? '10 %' : 'Off', source: { text: node === 'Outlet' ? 'Defined here' : 'Inherited from Client', tone: node === 'Outlet' ? 'ok' : 'neutral' } },
      { name: 'Default currency', kind: 'value', value: 'EUR', source: { text: 'Locked by Client', tone: 'warn' } },
      { name: 'Ticket numbering', kind: 'value', value: 'Daily reset', source: { text: 'Default value v1', tone: 'neutral' } },
    ]
  }
  const Effective = () => {
    const [node, setNode] = useState<'Client' | 'Brand' | 'Outlet'>('Outlet')
    return (
      <>
        <Toolbar><Seg options={['Client', 'Brand', 'Outlet'] as const} value={node} onChange={setNode} label="Level to read" /><span className="bo-count">What applies at the {node.toLowerCase()} level, and where each value comes from</span></Toolbar>
        <Settings key={node} rows={eff(node)} />
      </>
    )
  }
  const Publishing = () => {
    const [n, setN] = useState(3)
    const say = useSay()
    const ch = [['Refund approval above', 'Brand · Crusty', '50,00 €', '75,00 €', 'Sarah Lambert'], ['Tip suggestions', 'Outlet · Utrecht', '5 · 10 · 15 %', '10 · 15 · 20 %', 'Tom Peeters'], ['Kitchen late threshold', 'Brand · Crusty', '15 min', '12 min', 'Yanis Benali']]
    return (
      <>
        {n > 0 ? (
          <Banner tone="draft" title={`${n} ${n === 1 ? 'change' : 'changes'} in the draft`} actions={<><Btn onClick={() => say('We would show the checks first')}>Check</Btn><Btn primary onClick={() => (say('Published: version 41 is live'), setN(0))}>Publish…</Btn></>}>
            Nothing here is live yet. Publishing applies the changes to the outlets they cover.
          </Banner>
        ) : (
          <Banner tone="ok" title="Published">The draft is empty. Version 41 is live.</Banner>
        )}
        <ul className="bo-changes">
          {ch.slice(0, n).map(([p, w, a, b, who]) => (
            <li key={p}>
              <div><b>{p}</b><small>{w}</small></div>
              <span className="bo-change"><s>{a}</s> → <em>{b}</em></span>
              <small>{who}</small>
              <Pill tone="draft">Modified</Pill>
              <Btn small onClick={() => (say(`${p} removed from the draft`), setN((x) => x - 1))}>Remove from the draft</Btn>
            </li>
          ))}
        </ul>
        <Section title="Versions">
          {table({ cols: [{ key: 'v', label: 'Version', kind: 'strong' }, { key: 'at', label: 'Published' }, { key: 'by', label: 'By' }, { key: 'n', label: 'Changes', kind: 'num' }, { key: 'st', label: 'Status', kind: 'pill' }], rows: [{ id: 'v41', v: 'Version 41', at: day(0), by: 'Sarah Lambert', n: 4, st: S('Live', 'ok') }, { id: 'v40', v: 'Version 40', at: day(6), by: 'Yanis Benali', n: 2, st: S('Replaced', 'neutral') }, { id: 'v39', v: 'Version 39', at: day(15), by: 'Sarah Lambert', n: 9, st: S('Replaced', 'neutral') }] })}
        </Section>
      </>
    )
  }
  const LOG = [
    ['10:42', 'Sarah Lambert', 'Back office', 'changed', 'Refund approval above', ['50,00 €', '75,00 €']], ['10:31', 'Tom Peeters', 'Back office', 'changed', 'Tip suggestions · Utrecht', ['5 · 10 · 15 %', '10 · 15 · 20 %']],
    ['09:58', 'Driss Amrani', 'POS', 'turned on rush mode at', 'Crusty · Brussels Central', undefined], ['09:12', 'Yanis Benali', 'Back office', 'added the account', 'Hugo Martin', undefined],
    ['Yesterday 18:40', 'Rayan Kaci', 'KDS', 'marked as sold out', 'Truffle Risotto', undefined], ['Yesterday 16:05', 'Nadia El Amrani', 'Back office', 'closed the cash session', 'Register 2 · Ghent', ['Counted 412,50 €', 'Reconciled']],
    ['Yesterday 11:20', 'Sarah Lambert', 'Back office', 'published', 'Version 40', undefined], ['2 days ago', 'Elad Ilyas', 'Support', 'entered the client as support', 'Nordlight Ventures', undefined],
  ] as const
  const tax: Row[] = [['Standard', '21 %', 'Retail, drinks, takeaway', 'Belgium'], ['Reduced', '12 %', 'Restaurant meals', 'Belgium'], ['Reduced', '6 %', 'Fresh food', 'Belgium'], ['Standard', '20 %', 'Most goods', 'France'], ['Reduced', '10 %', 'On-site food', 'France'], ['Standard', '21 %', 'Most goods', 'Netherlands'], ['Reduced', '9 %', 'Food and drink', 'Netherlands']].map(([n, v, a, k], i) => ({ id: `t${i}`, name: n, rate: v, applies: a, country: k }))
  return {
    'governance.registry': { desc: 'Every policy the client can set, the level it is set at, its default, and how many outlets use it.', actions: <Act label="New policy" say="This would add a policy to the draft" primary />, body: table({ cols: [{ key: 'name', label: 'Policy', kind: 'sub' }, { key: 'area', label: 'Area' }, { key: 'level', label: 'Set at' }, { key: 'def', label: 'Default' }, { key: 'used', label: 'Outlets', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: registry, search: 'Search policies', filter: { key: 'area', label: 'Area' }, drawer: (x) => ({ title: String(text(x.name)), actions: [{ label: 'Edit in the draft', primary: true, say: 'This would open the policy in a draft' }] }) }) },
    'governance.effective': { desc: 'What really applies, level by level, and where each value comes from: inherited, locked or defined here.', body: <Effective /> },
    'governance.deviations': { desc: 'Outlets that use a value other than the one they inherit. Each one is accepted or sent back for review.', body: table({ cols: [{ key: 'outlet', label: 'Outlet', kind: 'sub' }, { key: 'policy', label: 'Policy' }, { key: 'inherited', label: 'Inherited' }, { key: 'local', label: 'Local value' }, { key: 'since', label: 'Since' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: dev, search: 'Search deviations', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: `${text(x.policy)} · ${text(x.outlet)}`, actions: [{ label: 'Restore the inherited value', say: 'This would add the restore to the draft' }, { label: 'Accept', primary: true, say: 'The deviation is accepted' }] }) }) },
    'governance.io': { desc: 'Take the policies out as a file, edit them in a spreadsheet, and bring them back. An import is checked first and lands in the draft.', body: <ImportExport /> },
    'governance.log': { desc: 'Who did what, when, and from where. An action that applied at once during service carries a bolt.', body: <Timeline items={LOG.map(([time, who, source, text, obj, ch], i) => ({ time, who, source, text, obj, change: ch as [string, string] | undefined, immediate: i === 2 || i === 4 }))} /> },
    'governance.publishing': { desc: 'Changes wait in a draft. Publishing applies them to the outlets they cover, and every version can be gone back to.', body: <Publishing /> },
    'governance.taxes': { desc: 'Tax rates and rounding by country. Coming soon: for now the rates are read-only.', body: <><Banner tone="info" title="Coming soon">Editing rates and rounding is not available yet. The rates below are the ones in use.</Banner>{table({ cols: [{ key: 'name', label: 'Rate', kind: 'strong' }, { key: 'rate', label: 'Percentage', kind: 'num' }, { key: 'applies', label: 'Applies to' }, { key: 'country', label: 'Country' }], rows: tax, search: 'Search rates', filter: { key: 'country', label: 'Country' } })}</> },
  }
}

/* Access */

function accessScreens(c: Ctx): Record<string, Screen> {
  const r = rng('access')
  const ROLE = ['Super Admin', 'Holding Admin', 'Brand Manager', 'Regional Manager', 'Store Manager', 'Store Manager', 'Brand Manager', 'Regional Manager', 'Store Manager', 'Holding Admin']
  const STAT: [string, Tone, boolean?][] = [['Active', 'ok'], ['Active', 'ok'], ['Active', 'ok'], ['Invited', 'info'], ['Active', 'ok'], ['Suspended', 'warn'], ['Active', 'ok'], ['Revoked', 'danger'], ['Active', 'ok'], ['Active', 'ok']]
  const accts: Row[] = PEOPLE.slice(0, 10).map((n, i) => ({
    id: `a${i}`, name: T(n, { sub: `${n.toLowerCase().replace(/[^a-z]+/g, '.')}@caissemanager.com` }), role: ROLE[i], scope: i < 2 ? 'Whole client' : outletOf(c, r), status: S(STAT[i][0], STAT[i][1]), mfa: S(i % 4 === 3 ? 'Off' : 'On', i % 4 === 3 ? 'warn' : 'ok'), last: i === 3 ? 'Never' : `${day(Math.floor(r() * 6))} · ${hm(8 + Math.floor(r() * 10), Math.floor(r() * 59))}`,
  }))
  const grants: Row[] = PEOPLE.slice(2, 10).map((n, i) => ({ id: `g${i}`, who: T(n, { sub: ROLE[i + 2] }), node: i % 3 === 0 ? c.holdings[0]?.name ?? 'Holding' : outletOf(c, r), from: day(30 + i * 9), until: i % 4 === 1 ? dateOf(12) : 'No end', status: i % 4 === 1 ? S('Ends in 12 days', 'warn') : i === 6 ? S('Ended', 'neutral', true) : S('Active', 'ok') }))
  const sec: SettingRow[] = [
    { name: 'Require two-step sign-in', desc: 'A code from an authenticator app after the password', kind: 'switch', on: true, source: { text: 'Locked by Client', tone: 'warn' } },
    { name: 'Allow sign-in with a staff badge', kind: 'switch', on: true, source: { text: 'Defined here', tone: 'ok' } },
    { name: 'Single sign-on (SAML)', desc: 'Sign in with the company identity provider', kind: 'switch', on: false, source: { text: 'Default value v1' } },
    { name: 'Session ends after', kind: 'select', options: ['30 minutes', '1 hour', '8 hours'], value: '1 hour', source: { text: 'Defined here', tone: 'ok' } },
    { name: 'Minimum password length', kind: 'select', options: ['10', '12', '16'], value: '12', source: { text: 'Inherited from Client' } },
    { name: 'Lock the account after failed attempts', kind: 'select', options: ['3', '5', '10'], value: '5', source: { text: 'Default value v1' } },
  ]
  const sessions: Row[] = [['MacBook · Chrome', 'Brussels, BE', 'This session'], ['iPad · Safari', 'Ghent, BE', '12 min ago'], ['Windows · Edge', 'Utrecht, NL', 'Yesterday'], ['iPhone · Safari', 'Lille, FR', '3 days ago']].map(([d, l, t], i) => ({ id: `s${i}`, device: d, where: l, seen: t, status: i === 0 ? S('Current', 'info') : S('Signed in', 'neutral') }))
  return {
    'access.accounts': { desc: 'The people who can sign in to the Back Office, what they can do, and where.', actions: <Act label="Invite someone" say="This would open the invitation form" primary />, body: table({ cols: [{ key: 'name', label: 'Account', kind: 'sub' }, { key: 'role', label: 'Role' }, { key: 'scope', label: 'Scope' }, { key: 'status', label: 'Status', kind: 'pill' }, { key: 'mfa', label: 'Two-step', kind: 'pill' }, { key: 'last', label: 'Last sign-in' }], rows: accts, search: 'Search accounts', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: String(text(x.name)), status: <Pill tone={(x.status as CellObj).tone}>{text(x.status)}</Pill>, actions: [{ label: 'Suspend', say: 'This would suspend the account' }, { label: 'Revoke', danger: true, say: 'This would ask you to confirm the revoke' }] }) }) },
    'access.roles': { desc: 'A role is a set of things a person can do. It is granted on a node and covers everything below it.', actions: <Act label="New role" say="This would copy a role to start from" primary />, body: <RoleGrid /> },
    'access.scopes': { desc: 'Where each person’s role applies, and until when. A grant that ends soon is flagged.', actions: <Act label="Grant access" say="This would open the grant form" primary />, body: table({ cols: [{ key: 'who', label: 'Account', kind: 'sub' }, { key: 'node', label: 'Applies to' }, { key: 'from', label: 'From' }, { key: 'until', label: 'Until' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: grants, search: 'Search grants', filter: { key: 'status', label: 'Status' } }) },
    'access.security': { desc: 'How people prove who they are, and how long a session lasts.', body: <><Settings rows={sec} /><Section title="Your sessions">{table({ cols: [{ key: 'device', label: 'Device', kind: 'strong' }, { key: 'where', label: 'Where' }, { key: 'seen', label: 'Last seen' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: sessions, drawer: (x) => ({ title: String(text(x.device)), actions: x.id === 's0' ? [] : [{ label: 'Sign out of this device', danger: true, say: 'This device would be signed out' }] }) })}</Section></> },
  }
}

/* ───────────────────────── Operations ───────────────────────── */

function salesScreens(c: Ctx): Record<string, Screen> {
  const r = rng('sales')
  const CH = ['Dine-in', 'Takeaway', 'Delivery', 'Kiosk']
  const PAY = ['Card', 'Contactless', 'Cash', 'Card']
  const tickets: Row[] = Array.from({ length: 22 }, (_, i) => {
    const tot = between(r, 9, 84)
    const st = i % 11 === 4 ? S('Refunded', 'warn') : i % 17 === 8 ? S('Voided', 'neutral', true) : i < 3 ? S('Open', 'info') : S('Paid', 'ok')
    return { id: `k${i}`, no: `#${4471 + 22 - i}`, time: hm(17 - Math.floor(i / 3), Math.floor(r() * 59)), outlet: outletOf(c, r), channel: pick(r, CH), pay: pick(r, PAY), total: M(tot), status: st }
  })
  const paid = tickets.filter((t) => text(t.status) === 'Paid')
  const refunds: Row[] = [['Wrong item', 18.5, 'Pending'], ['Cold food', 27, 'Pending'], ['Double charge', 9.9, 'Approved'], ['Allergy', 31.2, 'Approved'], ['Wrong item', 12.4, 'Rejected'], ['Delivery late', 22, 'Approved']].map(([why, amt, st], i) => ({ id: `rf${i}`, no: `RF-${210 + i}`, ticket: `#${4460 + i * 3}`, outlet: outletOf(c, r), amount: M(amt as number), why: why as string, by: pick(r, PEOPLE), status: S(st as string, st === 'Pending' ? 'warn' : st === 'Approved' ? 'ok' : 'danger') }))
  const orders = (names: string[], tone: Tone): { id: string; title: string; meta: string; tag?: string; late?: boolean }[] => names.map((n, i) => ({ id: `#${4480 + i + names.length}`, title: n, meta: `${outletOf(c, r)} · ${pick(r, CH)}`, tag: tone === 'danger' ? '18 min' : undefined, late: tone === 'danger' }))
  return {
    'sales.tickets': { desc: 'Every ticket of the day in the scope in view: what was sold, how it was paid, and how it ended.', body: <><Kpis items={[{ label: 'Tickets today', value: String(tickets.length), delta: { text: '4,2 %', up: true, good: true } }, { label: 'Revenue', value: eur(sum(paid.map((t) => (t.total as CellObj).n!)), 2), delta: { text: '2,8 %', up: true, good: true } }, { label: 'Average ticket', value: eur(sum(paid.map((t) => (t.total as CellObj).n!)) / Math.max(1, paid.length), 2) }, { label: 'Refunds', value: '2', hint: '1 awaiting approval', tone: 'warn' }]} />{table({ cols: [{ key: 'no', label: 'Ticket', kind: 'mono' }, { key: 'time', label: 'Time', kind: 'mono' }, { key: 'outlet', label: 'Outlet' }, { key: 'channel', label: 'Channel' }, { key: 'pay', label: 'Payment' }, { key: 'total', label: 'Total', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: tickets, search: 'Search tickets, outlets', filter: { key: 'status', label: 'Status' }, initialSort: { key: 'time', dir: 'desc' }, drawer: (x) => ({ title: `Ticket ${text(x.no)}`, status: <Pill tone={(x.status as CellObj).tone} dashed={(x.status as CellObj).dashed}>{text(x.status)}</Pill>, actions: [{ label: 'Start a refund', say: 'This would open a refund for this ticket' }] }) })}</> },
    'sales.orders': { desc: 'Orders that are not finished: new, being prepared, ready, or on the way. Late ones are marked with their time.', body: <Board cols={[{ title: 'New', tone: 'info', items: orders(['2 × Signature Burger', 'Brunch Formula', 'Caesar Salad'], 'info') }, { title: 'Preparing', tone: 'warn', items: orders(['Truffle Risotto · Espresso Tonic', '3 × Fries', 'Chocolate Cake'], 'warn') }, { title: 'Ready', tone: 'ok', items: orders(['Signature Burger', 'Natural Wine (gl.)'], 'ok') }, { title: 'Late', tone: 'danger', items: orders(['Brunch Formula'], 'danger') }]} /> },
    'sales.refunds': { desc: 'Refunds and credit notes. One above the approval limit waits for a manager.', body: <><Banner tone="warn" title="2 refunds wait for approval">Above the limit set in Governance › Policy registry.</Banner>{table({ cols: [{ key: 'no', label: 'Refund', kind: 'mono' }, { key: 'ticket', label: 'Ticket', kind: 'mono' }, { key: 'outlet', label: 'Outlet' }, { key: 'why', label: 'Reason' }, { key: 'by', label: 'Asked by' }, { key: 'amount', label: 'Amount', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: refunds, search: 'Search refunds', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: `${text(x.no)} · ${text(x.amount)}`, status: <Pill tone={(x.status as CellObj).tone}>{text(x.status)}</Pill>, actions: text(x.status) === 'Pending' ? [{ label: 'Reject', danger: true, say: 'The refund is rejected' }, { label: 'Approve', primary: true, say: 'The refund is approved' }] : [] }) })}</> },
  }
}

function cashScreens(c: Ctx): Record<string, Screen> {
  const r = rng('cash')
  const sess: Row[] = Array.from({ length: 9 }, (_, i) => {
    const exp = between(r, 280, 940)
    const diff = i % 4 === 2 ? -between(r, 6, 22) : i % 5 === 3 ? between(r, 3, 9) : 0
    return { id: `cs${i}`, reg: `Register ${1 + (i % 3)}`, outlet: outletOf(c, r), who: pick(r, PEOPLE), opened: `${hm(7 + (i % 3), 5 + i * 3)}`, exp: M(exp), counted: i < 3 ? '—' : M(exp + diff), diff: i < 3 ? '—' : diff === 0 ? T('0,00 €', { n: 0 }) : T(eur(diff, 2), { n: diff }), status: i < 3 ? S('Open', 'info') : Math.abs(diff) > 5 ? S('To review', 'warn') : S('Closed', 'ok') }
  })
  const moves: Row[] = [['Drop', 500], ['Pick-up', -900], ['Float', 150], ['Payout', -45], ['Drop', 350], ['Float', 150], ['Payout', -22.5]].map(([k, a], i) => ({ id: `mv${i}`, time: hm(9 + i, 12 + i * 4), type: k as string, reg: `Register ${1 + (i % 3)}`, by: pick(r, PEOPLE), amount: T(eur(a as number, 2), { n: a as number }), note: ['Safe drop', 'Bank pick-up', 'Morning float', 'Supplier cash', 'Safe drop', 'Morning float', 'Tips paid out'][i], status: i < 5 ? S('Counted', 'ok') : S('Waiting for a count', 'warn') }))
  const closes: Row[] = outlets(c).slice(0, 8).map((s, i) => { const exp = between(r, 1400, 4800); const d = i % 3 === 1 ? -between(r, 4, 30) : 0; return { id: `cl${i}`, day: day(i + 1), outlet: T(s.name, { sub: s.id }), exp: M(exp), counted: M(exp + d), diff: T(d === 0 ? '0,00 €' : eur(d, 2), { n: d }), status: d === 0 ? S('Reconciled', 'ok') : S('Needs review', 'warn') } })
  const plats: Row[] = [['Uber Eats', 41, 1260.5, 0.27], ['Glovo', 33, 980, 0.3], ['Deliveroo', 22, 702.3, 0.28], ['Uber Eats', 38, 1180, 0.27], ['Glovo', 29, 905.2, 0.3]].map(([p, n, g, f], i) => ({ id: `pl${i}`, plat: p as string, day: day(Math.floor(i / 3)), orders: n as number, gross: M(g as number), fee: M((g as number) * (f as number)), net: M((g as number) * (1 - (f as number))), status: i < 2 ? S('Open', 'info') : S('Settled', 'ok') }))
  return {
    'cash.sessions': { desc: 'Each till’s session: who opened it, what it should hold, what was counted, and whether the gap needs a look.', body: <><Kpis items={[{ label: 'Open sessions', value: '3', tone: 'info' }, { label: 'Cash in drawers', value: eur(sum(sess.slice(0, 3).map((x) => (x.exp as CellObj).n!)), 0) }, { label: 'Gaps to review', value: String(sess.filter((x) => text(x.status) === 'To review').length), tone: 'warn' }]} />{table({ cols: [{ key: 'reg', label: 'Register', kind: 'strong' }, { key: 'outlet', label: 'Outlet' }, { key: 'who', label: 'Cashier' }, { key: 'opened', label: 'Opened', kind: 'mono' }, { key: 'exp', label: 'Expected', kind: 'num' }, { key: 'counted', label: 'Counted', kind: 'num' }, { key: 'diff', label: 'Gap', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: sess, search: 'Search sessions', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: `${text(x.reg)} · ${text(x.outlet)}`, status: <Pill tone={(x.status as CellObj).tone}>{text(x.status)}</Pill>, actions: text(x.status) === 'To review' ? [{ label: 'Accept the gap', primary: true, say: 'The gap is accepted and logged' }] : [] }) })}</> },
    'cash.movements': { desc: 'Money that goes in or out of a drawer outside a sale: drops to the safe, pick-ups, floats and payouts.', body: table({ cols: [{ key: 'time', label: 'Time', kind: 'mono' }, { key: 'type', label: 'Type' }, { key: 'reg', label: 'Register' }, { key: 'by', label: 'By' }, { key: 'note', label: 'Note' }, { key: 'amount', label: 'Amount', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: moves, search: 'Search movements', filter: { key: 'type', label: 'Type' } }) },
    'cash.closes': { desc: 'The day’s close for each outlet: what the books say against what was counted.', actions: <Act label="Reconcile all clean days" say="The days with no gap would be marked reconciled" primary />, body: table({ cols: [{ key: 'day', label: 'Day' }, { key: 'outlet', label: 'Outlet', kind: 'sub' }, { key: 'exp', label: 'Expected', kind: 'num' }, { key: 'counted', label: 'Counted', kind: 'num' }, { key: 'diff', label: 'Gap', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: closes, search: 'Search closes', filter: { key: 'status', label: 'Status' } }) },
    'cash.platforms': { desc: 'Delivery platforms are paid by the platform, not at the till. Each session shows gross sales, the commission and what the outlet is owed.', body: table({ cols: [{ key: 'plat', label: 'Platform', kind: 'strong' }, { key: 'day', label: 'Day' }, { key: 'orders', label: 'Orders', kind: 'num' }, { key: 'gross', label: 'Gross', kind: 'num' }, { key: 'fee', label: 'Commission', kind: 'num' }, { key: 'net', label: 'Net', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: plats, filter: { key: 'plat', label: 'Platform' } }) },
  }
}

function diningScreens(): Record<string, Screen> {
  const rows: Row[] = ALL_TABLES.map((t) => ({ id: t.id, code: t.id, section: t.section, seats: t.seats, shape: t.round ? 'Round' : t.kind === 'l8' ? 'Banquet' : t.kind === 'l6' ? 'Long' : 'Rectangular', size: t.dim, state: S(TABLE_STATE_LABEL[t.state], TABLE_STATE_TONE[t.state], t.state === 'clear') }))
  const count = (s: string) => ALL_TABLES.filter((t) => t.state === s).length
  return {
    'dining.plan': { desc: 'The room as the staff see it: sizes, seats and where each table stands. Click a table for its details.', actions: <Act label="Open the floor plan editor" say="The editor opens on the POS, where tables are drawn to scale" />, body: <FloorPlan mode="plan" /> },
    'dining.tables': { desc: 'The tables as a list: which section each belongs to, its seats, shape and size.', actions: <Act label="Add a table" say="This would add a table to the floor plan" primary />, body: table({ cols: [{ key: 'code', label: 'Table', kind: 'strong' }, { key: 'section', label: 'Section' }, { key: 'seats', label: 'Seats', kind: 'num' }, { key: 'shape', label: 'Shape' }, { key: 'size', label: 'Size', kind: 'mono' }, { key: 'state', label: 'State now', kind: 'pill' }], rows, search: 'Search tables', filter: { key: 'section', label: 'Section' } }) },
    'dining.live': { desc: 'The state of every table right now. Tap a state to show only those tables.', body: <><Kpis items={[{ label: 'Open tables', value: String(count('order') + count('dine') + count('late')), hint: 'of 20' }, { label: 'Free', value: String(count('free')), tone: 'ok' }, { label: 'Over 45 min', value: String(count('late')), tone: 'danger' }, { label: 'To clear', value: String(count('clear')), tone: 'warn' }]} /><FloorPlan mode="live" /></> },
  }
}

function reservationScreens(): Record<string, Screen> {
  const WAIT: [string, number, number][] = [['Dubois', 2, 6], ['Khelifi', 4, 18], ['Martin', 3, 27], ['Bakri', 6, 34], ['Peeters', 2, 41]]
  const wait: Row[] = WAIT.map(([n, size, min], i) => ({ id: `w${i}`, name: n, size, wait: T(`${min} min`, { pct: pct(min, 45), tone: min > 30 ? 'danger' : min > 20 ? 'warn' : 'ok' }), quote: `${min + 5 < 45 ? 15 + i * 5 : 45} min`, channel: ['Walk-in', 'Phone', 'Walk-in', 'Online', 'Walk-in'][i], status: i === 1 ? S('Notified', 'info') : S('Waiting', 'warn') }))
  const services: CardItem[] = [
    { title: 'Lunch', sub: 'Monday to Friday', pill: { text: 'Open for booking', tone: 'ok' }, meta: [['Hours', '12:00 – 15:00'], ['Covers per half hour', '24'], ['Booking window', '14 days ahead'], ['Hold a table for', '15 min']], toggle: { label: 'Online booking', on: true, immediate: true } },
    { title: 'Dinner', sub: 'Every day', pill: { text: 'Open for booking', tone: 'ok' }, meta: [['Hours', '18:30 – 22:30'], ['Covers per half hour', '32'], ['Booking window', '30 days ahead'], ['Hold a table for', '15 min']], toggle: { label: 'Online booking', on: true, immediate: true } },
    { title: 'Brunch', sub: 'Saturday and Sunday', pill: { text: 'Closed for booking', tone: 'neutral', dashed: true }, meta: [['Hours', '10:00 – 14:00'], ['Covers per half hour', '20'], ['Booking window', '7 days ahead'], ['Hold a table for', '10 min']], toggle: { label: 'Online booking', on: false, immediate: true } },
  ]
  const pagers: CardItem[] = [
    { title: 'Entrance desk', sub: 'Waitlist pagers', pill: { text: 'Ready', tone: 'ok' }, meta: [['Pagers', '20'], ['In use', '12'], ['Low battery', '1']], actions: [{ label: 'Test all pagers', say: 'All pagers would buzz once' }] },
    { title: 'Bar', sub: 'Order pagers', pill: { text: '2 low battery', tone: 'warn' }, meta: [['Pagers', '12'], ['In use', '5'], ['Low battery', '2']], actions: [{ label: 'Test all pagers', say: 'All pagers would buzz once' }] },
    { title: 'Terrace', sub: 'Order pagers', pill: { text: 'Offline', tone: 'danger' }, meta: [['Pagers', '10'], ['In use', '0'], ['Low battery', '—']], actions: [{ label: 'Pair the station', say: 'This would start pairing' }] },
  ]
  return {
    'reservations.calendar': { desc: 'Today’s bookings, one row per table. The red line is now.', actions: <Act label="New reservation" say="This would open the booking form" primary />, body: <ReservationCalendar /> },
    'reservations.services': { desc: 'The services a table can be booked for, their hours and capacity. Closing online booking applies at once.', body: <Cards items={services} cols={3} /> },
    'reservations.waitlist': { desc: 'Parties waiting for a table, how long they have waited, and what they were told.', body: <><Kpis items={[{ label: 'Parties waiting', value: String(wait.length) }, { label: 'Longest wait', value: '41 min', tone: 'danger' }, { label: 'Average wait', value: '25 min' }]} />{table({ cols: [{ key: 'name', label: 'Name', kind: 'strong' }, { key: 'size', label: 'Guests', kind: 'num' }, { key: 'wait', label: 'Waiting', kind: 'bar' }, { key: 'quote', label: 'Quoted' }, { key: 'channel', label: 'Added by' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: wait, drawer: (x) => ({ title: `${text(x.name)} · ${text(x.size)} guests`, actions: [{ label: 'Remove', danger: true, say: 'The party is removed from the list' }, { label: 'Notify', say: 'The party would be notified' }, { label: 'Seat', primary: true, say: 'The party is seated' }] }) })}</> },
    'reservations.pagers': { desc: 'The pager stations: how many pagers each has, how many are out, and which need a battery.', body: <Cards items={pagers} cols={3} /> },
  }
}

function kitchenScreens(c: Ctx): Record<string, Screen> {
  const r = rng('kitchen')
  const ticket = (n: number, title: string, mins: number, late = false) => ({ id: `#${4500 + n}`, title, meta: `${outletOf(c, r)} · ${mins} min`, tag: late ? `${mins} min` : undefined, late })
  const SOLD: [string, string, boolean][] = [['Truffle Risotto', 'Mains', true], ['Chocolate Cake', 'Desserts', false], ['Natural Wine (gl.)', 'Drinks', false], ['Brunch Formula', 'Mains', true], ['Fries', 'Sides', false], ['Caesar Salad', 'Starters', false]]
  const sold: CardItem[] = SOLD.map(([n, cat, out]) => ({ title: n, sub: cat, pill: out ? { text: 'Sold out', tone: 'danger' } : { text: 'On sale', tone: 'ok' }, toggle: { label: 'On sale', on: !out, immediate: true } }))
  const rush: SettingRow[] = [
    { name: 'Rush mode', desc: 'Slows the promises and tells the floor', kind: 'switch', on: false, immediate: true },
    { name: 'Starts by itself when', kind: 'select', options: ['Never (manual)', 'Over 30 open tickets', 'Average over 12 min'], value: 'Over 30 open tickets', source: { text: 'Defined here', tone: 'ok' } },
    { name: 'Hide the slowest dishes', kind: 'switch', on: true, source: { text: 'Inherited from Brand' } },
    { name: 'Add to every preparation time', kind: 'select', options: ['0 %', '+10 %', '+20 %', '+30 %'], value: '+20 %', source: { text: 'Defined here', tone: 'ok' } },
    { name: 'Warn the floor staff', kind: 'switch', on: true, source: { text: 'Default value v1' } },
  ]
  return {
    'kitchen.stages': { desc: 'Where every ticket is in the kitchen right now, from new to served. A ticket past its limit is marked late.', body: <><Kpis items={[{ label: 'Open tickets', value: '14' }, { label: 'Average prep time', value: '11:20', delta: { text: '0:40', up: false, good: true } }, { label: 'Late', value: '2', tone: 'danger' }]} /><Board cols={[{ title: 'New', tone: 'info', items: [ticket(1, '2 × Signature Burger', 1), ticket(2, 'Brunch Formula', 2), ticket(3, 'Caesar Salad', 3)] }, { title: 'Preparing', tone: 'warn', items: [ticket(4, 'Truffle Risotto', 9), ticket(5, '3 × Fries · Burger', 11), ticket(6, 'Brunch Formula', 18, true)] }, { title: 'Ready', tone: 'ok', items: [ticket(7, 'Espresso Tonic · Cake', 2), ticket(8, 'Signature Burger', 4)] }, { title: 'Served today', tone: 'neutral', items: [{ id: '112', title: 'tickets served', meta: 'Average 11:05 from new to served' }] }]} /></> },
    'kitchen.rush': { desc: 'Rush mode eases the kitchen when it is overloaded. Turning it on or off applies at once.', body: <><Banner tone="info" title="Rush mode is off">12 tickets are open; it would start at 30.</Banner><Settings rows={rush} /></> },
    'kitchen.soldout': { desc: 'Put a dish back on sale, or take it off, right now. This applies at once on every screen.', body: <Cards items={sold} cols={3} /> },
    'kitchen.test': { desc: 'Check where an order would go before service, without sending anything.', body: <TestOrder /> },
  }
}

function stockScreens(c: Ctx): Record<string, Screen> {
  const r = rng('stock')
  const ITEMS: [string, string, string, number, number][] = [['Chicken breast', 'Meat', 'kg', 42, 40], ['Burger buns', 'Bakery', 'pcs', 110, 200], ['Arborio rice', 'Dry goods', 'kg', 18, 10], ['Parmesan', 'Dairy', 'kg', 3.2, 6], ['Espresso beans', 'Coffee', 'kg', 9, 8], ['Tomatoes', 'Produce', 'kg', 0, 15], ['Olive oil', 'Dry goods', 'l', 22, 12], ['Natural wine', 'Drinks', 'bottles', 24, 36], ['Napkins', 'Packaging', 'packs', 60, 30], ['Frying oil', 'Dry goods', 'l', 14, 20]]
  const levels: Row[] = ITEMS.map(([n, cat, u, have, par], i) => {
    const tone: Tone = have === 0 ? 'danger' : have < par ? 'warn' : 'ok'
    return { id: `it${i}`, name: n, cat, have: T(`${have} ${u}`, { n: have }), par: T(`${par} ${u}`, { n: par }), lvl: T(`${pct(have, par)} %`, { pct: Math.min(100, pct(have, par)), tone }), status: have === 0 ? S('Out', 'danger') : have < par ? S('Low', 'warn') : S('OK', 'ok'), supplier: ['Volailles Atlas', 'Boulangerie du Centre', 'Marché Nord', 'Maison Vanille', 'Café Torrefacto', 'Marché Nord', 'Frigo Distribution', 'Atlas Boissons', 'Emballages Plus', 'Frigo Distribution'][i] }
  })
  const receipts: Row[] = [['Volailles Atlas', 'Received', 6, 412.6], ['Boulangerie du Centre', 'Received', 3, 188.4], ['Marché Nord', 'Partial', 9, 534.2], ['Atlas Boissons', 'Expected', 5, 697], ['Café Torrefacto', 'Expected', 2, 240]].map(([s, st, n, v], i) => ({ id: `rc${i}`, no: `RC-${880 + i}`, supplier: s as string, date: st === 'Expected' ? dateOf(1 + i) : day(i), outlet: outletOf(c, r), lines: n as number, value: M(v as number), status: S(st as string, st === 'Received' ? 'ok' : st === 'Partial' ? 'warn' : 'info') }))
  const cycles: CardItem[] = [['Volailles Atlas', 'Mon · Wed · Fri', '10:00 the day before', 'Wed 19 Nov'], ['Boulangerie du Centre', 'Every day', '18:00 the day before', 'Tomorrow'], ['Marché Nord', 'Tue · Thu', '12:00 the day before', 'Tue 18 Nov'], ['Atlas Boissons', 'Weekly · Thursday', 'Tuesday 12:00', 'Thu 20 Nov']].map(([n, d, cut, nx], i) => ({ title: n, sub: d, pill: { text: `Next ${nx}`, tone: 'info' as Tone }, meta: [['Order by', cut], ['Outlets', String(outlets(c).length)]] as [string, string][], toggle: { label: 'Suggest the order', on: i !== 3 } }))
  const transfers: Row[] = [['TR-120', 'Brussels Central', 'Ghent', 'In transit', 4], ['TR-119', 'Utrecht', 'Lille', 'Received', 2], ['TR-118', 'Ghent', 'Brussels Central', 'Draft', 6], ['TR-117', 'Lille', 'Utrecht', 'Received', 3]].map(([no, a, b, st, n], i) => ({ id: `tr${i}`, no: no as string, from: a as string, to: b as string, lines: n as number, date: day(i), status: S(st as string, st === 'In transit' ? 'info' : st === 'Received' ? 'ok' : 'draft') }))
  const counts: Row[] = [['Full count', 'Kitchen', 100, -42.1, 'Done'], ['Bar count', 'Bar', 64, -6.5, 'In progress'], ['Dry store', 'Store room', 20, 0, 'In progress'], ['Cold room', 'Cold room', 0, 0, 'Planned']].map(([n, z, p, v, st], i) => ({ id: `ct${i}`, name: n as string, outlet: outletOf(c, r), zone: z as string, date: st === 'Planned' ? dateOf(3) : day(i), progress: T(`${p} %`, { pct: p as number, tone: p === 100 ? 'ok' : 'info' }), variance: T(eur(v as number, 2), { n: v as number }), status: S(st as string, st === 'Done' ? 'ok' : st === 'Planned' ? 'neutral' : 'warn', st === 'Planned') }))
  return {
    'stock.levels': { desc: 'What is on hand against what should be, item by item. Low and out items are flagged.', body: <><Kpis items={[{ label: 'Items', value: String(ITEMS.length) }, { label: 'Low', value: String(levels.filter((x) => text(x.status) === 'Low').length), tone: 'warn' }, { label: 'Out of stock', value: String(levels.filter((x) => text(x.status) === 'Out').length), tone: 'danger' }]} />{table({ cols: [{ key: 'name', label: 'Item', kind: 'strong' }, { key: 'cat', label: 'Category' }, { key: 'have', label: 'On hand', kind: 'num' }, { key: 'par', label: 'Par level', kind: 'num' }, { key: 'lvl', label: 'Level', kind: 'bar' }, { key: 'status', label: 'Status', kind: 'pill' }, { key: 'supplier', label: 'Supplier' }], rows: levels, search: 'Search items', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: String(text(x.name)), actions: [{ label: 'Adjust the count', say: 'This would open a stock adjustment' }, { label: 'Order now', primary: true, say: 'This would draft an order to the supplier' }] }) })}</> },
    'stock.receipts': { desc: 'Deliveries from suppliers: expected, received in full, or received in part.', actions: <Act label="Receive a delivery" say="This would open the receiving form" primary />, body: table({ cols: [{ key: 'no', label: 'Receipt', kind: 'mono' }, { key: 'supplier', label: 'Supplier', kind: 'strong' }, { key: 'outlet', label: 'Outlet' }, { key: 'date', label: 'Date' }, { key: 'lines', label: 'Lines', kind: 'num' }, { key: 'value', label: 'Value', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: receipts, search: 'Search receipts', filter: { key: 'status', label: 'Status' } }) },
    'stock.cycles': { desc: 'When each supplier is ordered from, and the cut-off. The suggestion is a draft order you check before it goes.', body: <Cards items={cycles} cols={2} /> },
    'stock.transfers': { desc: 'Stock moved from one outlet to another.', actions: <Act label="New transfer" say="This would open the transfer form" primary />, body: table({ cols: [{ key: 'no', label: 'Transfer', kind: 'mono' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'lines', label: 'Lines', kind: 'num' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: transfers, filter: { key: 'status', label: 'Status' } }) },
    'stock.inventory': { desc: 'Physical counts: where they are, how far along, and what they found against the books.', actions: <Act label="Start a count" say="This would start a count for an outlet" primary />, body: table({ cols: [{ key: 'name', label: 'Count', kind: 'strong' }, { key: 'outlet', label: 'Outlet' }, { key: 'zone', label: 'Zone' }, { key: 'date', label: 'Date' }, { key: 'progress', label: 'Progress', kind: 'bar' }, { key: 'variance', label: 'Variance', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows: counts, filter: { key: 'status', label: 'Status' } }) },
  }
}

function catalogueScreen(): Screen {
  const A: [string, string, number, string][] = [['Signature Burger', 'Mains', 19, 'On sale'], ['Truffle Risotto', 'Mains', 26, 'On sale'], ['Caesar Salad', 'Starters', 14, 'On sale'], ['Espresso Tonic', 'Drinks', 6, 'On sale'], ['Chocolate Cake', 'Desserts', 8.5, 'On sale'], ['Brunch Formula', 'Mains', 32, 'Draft'], ['Winter Soup', 'Starters', 9, 'Hidden']]
  const rows: Row[] = A.map(([n, cat, p, st], i) => ({ id: `ar${i}`, name: n, cat, price: M(p), tax: cat === 'Drinks' ? '21 %' : '12 %', outlets: st === 'Draft' ? 0 : 41, status: S(st, st === 'On sale' ? 'ok' : st === 'Draft' ? 'draft' : 'neutral', st === 'Hidden') }))
  return { desc: 'The articles sold, with their price, tax and where they are offered. Coming soon: for now this list is read-only.', body: <><Banner tone="info" title="Coming soon">Editing articles is not available yet.</Banner>{table({ cols: [{ key: 'name', label: 'Article', kind: 'strong' }, { key: 'cat', label: 'Category' }, { key: 'price', label: 'Price', kind: 'num' }, { key: 'tax', label: 'Tax', kind: 'num' }, { key: 'outlets', label: 'Outlets', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows, search: 'Search articles', filter: { key: 'cat', label: 'Category' } })}</> }
}

/* ───────────────────────── Analytics ───────────────────────── */

function RankingView({ c }: { c: Ctx }) {
  const [by, setBy] = useState<'Brands' | 'Outlets' | 'Countries'>('Brands')
  const brands = new Map(c.holdings.flatMap((h) => h.brands.map((b) => [b.id, b.name] as const)))
  const key = (s: Store) => (by === 'Brands' ? s.brandId : by === 'Outlets' ? s.id : s.countryId)
  const name = (s: Store) => (by === 'Brands' ? brands.get(s.brandId) ?? s.brandId : by === 'Outlets' ? s.name : countryById(s.countryId).name)
  const m = new Map<string, { name: string; rev: number; tgt: number; n: number }>()
  for (const s of c.stores) {
    const k = storeKpis(s)
    const e = m.get(key(s)) ?? { name: name(s), rev: 0, tgt: 0, n: 0 }
    e.rev += k.revenueToday
    e.tgt += k.target
    e.n++
    m.set(key(s), e)
  }
  const list = [...m.values()].sort((a, b) => b.rev - a.rev).slice(0, 12)
  const max = list[0]?.rev ?? 1
  return (
    <>
      <Toolbar><Seg options={['Brands', 'Outlets', 'Countries'] as const} value={by} onChange={setBy} label="Rank by" /><span className="bo-count">Revenue today, with the share of the target reached</span></Toolbar>
      <BarList rows={list.map((e) => ({ label: e.name, sub: `${e.n} ${e.n === 1 ? 'outlet' : 'outlets'} · ${Math.round((e.rev / Math.max(1, e.tgt)) * 100)} % of target`, value: eur(e.rev, 0), pct: Math.round((e.rev / max) * 100), tone: e.rev / e.tgt >= 1 ? 'ok' : e.rev / e.tgt < 0.8 ? 'warn' : undefined }))} />
    </>
  )
}

function Report({ c, kind }: { c: Ctx; kind: string }) {
  const [period, setPeriod] = useState<'Today' | '7 days' | '30 days'>('Today')
  const [chan, setChan] = useState('All channels')
  const f = period === 'Today' ? 1 : period === '7 days' ? 6.6 : 27.4
  const cf = chan === 'All channels' ? 1 : chan === 'Dine-in' ? 0.52 : chan === 'Takeaway' ? 0.27 : 0.21
  const k = c.stores.map((s) => ({ s, k: storeKpis(s) }))
  const L = (n: number) => eur(n * f * cf, 0)
  const rev = sum(k.map((x) => x.k.revenueToday))
  const maxRev = Math.max(1, ...k.map((x) => x.k.revenueToday))
  let kp: { label: string; value: string }[] = []
  let cols: Col[] = []
  let rows: Row[] = []
  let total: Record<string, Cell> | undefined
  if (kind === 'sales') {
    kp = [{ label: 'Revenue', value: L(rev) }, { label: 'Tickets', value: String(Math.round(sum(k.map((x) => x.k.transactions)) * f * cf)) }, { label: 'Average ticket', value: eur(sum(k.map((x) => x.k.avgBasket)) / Math.max(1, k.length), 2) }]
    cols = [{ key: 'o', label: 'Outlet', kind: 'strong' }, { key: 't', label: 'Tickets', kind: 'num' }, { key: 'b', label: 'Average ticket', kind: 'num' }, { key: 'r', label: 'Revenue', kind: 'num' }, { key: 's', label: 'Share', kind: 'bar' }]
    rows = k.map((x) => ({ id: x.s.id, o: x.s.name, t: Math.round(x.k.transactions * f * cf), b: M(x.k.avgBasket), r: T(L(x.k.revenueToday), { n: x.k.revenueToday }), s: T(`${((x.k.revenueToday / rev) * 100).toFixed(1).replace('.', ',')} %`, { pct: (x.k.revenueToday / maxRev) * 100 }) }))
    total = { o: 'Total', t: Math.round(sum(k.map((x) => x.k.transactions)) * f * cf), b: '', r: L(rev), s: '' }
  } else if (kind === 'products') {
    const m = new Map<string, { q: number; r: number }>()
    for (const x of k) for (const p of x.k.topProducts) { const e = m.get(p.name) ?? { q: 0, r: 0 }; e.q += p.qty; e.r += p.revenue; m.set(p.name, e) }
    const list = [...m.entries()].sort((a, b) => b[1].r - a[1].r).slice(0, 12)
    const tot = sum(list.map(([, e]) => e.r))
    kp = [{ label: 'Products sold', value: String(Math.round(sum(list.map(([, e]) => e.q)) * f * cf)) }, { label: 'Revenue of the top 12', value: L(tot) }, { label: 'Best seller', value: list[0]?.[0] ?? '—' }]
    cols = [{ key: 'p', label: 'Product', kind: 'strong' }, { key: 'q', label: 'Quantity', kind: 'num' }, { key: 'r', label: 'Revenue', kind: 'num' }, { key: 's', label: 'Share', kind: 'bar' }]
    rows = list.map(([n, e]) => ({ id: n, p: n, q: Math.round(e.q * f * cf), r: T(L(e.r), { n: e.r }), s: T(`${((e.r / tot) * 100).toFixed(1).replace('.', ',')} %`, { pct: (e.r / list[0][1].r) * 100 }) }))
  } else if (kind === 'payments') {
    const m = new Map<string, number>()
    for (const x of k) for (const p of x.k.paymentMix) m.set(p.label, (m.get(p.label) ?? 0) + (p.value / 100) * x.k.revenueToday)
    const tot = sum([...m.values()])
    const FEE: Record<string, number> = { Card: 0.012, Contactless: 0.012, Cash: 0, 'Mobile pay': 0.015 }
    kp = [{ label: 'Total collected', value: L(tot) }, { label: 'Methods', value: String(m.size) }, { label: 'Fees', value: L(sum([...m.entries()].map(([n, v]) => v * (FEE[n] ?? 0.012)))) }]
    cols = [{ key: 'm', label: 'Method', kind: 'strong' }, { key: 'a', label: 'Amount', kind: 'num' }, { key: 'f', label: 'Fees', kind: 'num' }, { key: 's', label: 'Share', kind: 'bar' }]
    rows = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ id: n, m: n, a: T(L(v), { n: v }), f: L(v * (FEE[n] ?? 0.012)), s: T(`${Math.round((v / tot) * 100)} %`, { pct: (v / tot) * 100 }) }))
  } else if (kind === 'cash') {
    const r = rng('rep-cash')
    kp = [{ label: 'Sessions', value: String(Math.round(k.length * 3 * f)) }, { label: 'Gaps over 5 €', value: String(Math.max(1, Math.round(k.length / 4))) }, { label: 'Net gap', value: eur(-between(r, 8, 40), 2) }]
    cols = [{ key: 'o', label: 'Outlet', kind: 'strong' }, { key: 'n', label: 'Sessions', kind: 'num' }, { key: 'e', label: 'Expected', kind: 'num' }, { key: 'g', label: 'Gap', kind: 'num' }, { key: 's', label: 'Status', kind: 'pill' }]
    rows = k.map((x, i) => { const g = i % 3 === 1 ? -between(r, 6, 24) : i % 4 === 2 ? between(r, 1, 5) : 0; return { id: x.s.id, o: x.s.name, n: Math.round(3 * f), e: M(x.k.revenueToday * 0.18 * f), g: T(eur(g, 2), { n: g }), s: Math.abs(g) > 5 ? S('To review', 'warn') : S('Within limit', 'ok') } })
  } else if (kind === 'kitchen') {
    const r = rng('rep-kitchen')
    const ST = ['Grill', 'Hot line', 'Cold line', 'Fryer', 'Bar', 'Pastry']
    kp = [{ label: 'Tickets', value: String(Math.round(sum(k.map((x) => x.k.transactions)) * 0.8 * f)) }, { label: 'Average prep time', value: '11:20' }, { label: 'Late tickets', value: '4,1 %' }]
    cols = [{ key: 's', label: 'Station', kind: 'strong' }, { key: 't', label: 'Tickets', kind: 'num' }, { key: 'p', label: 'Average prep', kind: 'num' }, { key: 'l', label: 'Late', kind: 'bar' }]
    rows = ST.map((s) => { const l = between(r, 1, 9); return { id: s, s, t: Math.round(between(r, 80, 260) * f), p: `${Math.floor(between(r, 6, 14))}:${String(Math.floor(between(r, 0, 59))).padStart(2, '0')}`, l: T(`${l.toFixed(1)} %`, { pct: l * 8, tone: l > 6 ? 'danger' : l > 4 ? 'warn' : 'ok' }) } })
  } else if (kind === 'stock') {
    const r = rng('rep-stock')
    const IT = [['Chicken breast', 'kg'], ['Burger buns', 'pcs'], ['Tomatoes', 'kg'], ['Parmesan', 'kg'], ['Espresso beans', 'kg'], ['Olive oil', 'l'], ['Natural wine', 'bottles']]
    kp = [{ label: 'Consumed', value: eur(between(r, 3800, 5200) * f, 0) }, { label: 'Waste', value: '3,2 %' }, { label: 'Food cost', value: '28,4 %' }]
    cols = [{ key: 'i', label: 'Item', kind: 'strong' }, { key: 'u', label: 'Used', kind: 'num' }, { key: 'w', label: 'Waste', kind: 'bar' }, { key: 'c', label: 'Cost', kind: 'num' }]
    rows = IT.map(([n, u]) => { const w = between(r, 0.5, 7); return { id: n, i: n, u: `${Math.round(between(r, 30, 220) * f)} ${u}`, w: T(`${w.toFixed(1)} %`, { pct: w * 12, tone: w > 5 ? 'danger' : w > 3 ? 'warn' : 'ok' }), c: M(between(r, 90, 640) * f, 0) } })
  } else {
    kp = [{ label: 'Staff', value: String(sum(k.map((x) => x.k.staff.length))) }, { label: 'Hours worked', value: String(Math.round(sum(k.map((x) => x.k.staff.length)) * 6.4 * f)) }, { label: 'Tips', value: eur(rev * 0.031 * f * cf, 0) }]
    cols = [{ key: 'n', label: 'Employee', kind: 'sub' }, { key: 'o', label: 'Outlet' }, { key: 'h', label: 'Hours', kind: 'num' }, { key: 's', label: 'Sales', kind: 'num' }, { key: 't', label: 'Tips', kind: 'num' }]
    rows = k.flatMap((x) => x.k.staff.map((p, i) => ({ id: `${x.s.id}-${i}`, n: T(p.name, { sub: p.role }), o: x.s.name, h: Math.round(6.4 * f * 10) / 10, s: M(x.k.revenueToday / x.k.staff.length * f * cf, 0), t: M((x.k.revenueToday / x.k.staff.length) * 0.031 * f * cf, 0) }))).slice(0, 40)
  }
  return (
    <>
      <Toolbar>
        <Seg options={['Today', '7 days', '30 days'] as const} value={period} onChange={setPeriod} label="Period" />
        <Chips options={['All channels', 'Dine-in', 'Takeaway', 'Delivery']} value={chan} onChange={setChan} label="Channel" />
        <span className="bo-count">Currency EUR · scope: {c.scopeName}</span>
      </Toolbar>
      <Kpis items={kp} />
      {table({ cols, rows, total, search: 'Search this report' })}
    </>
  )
}

function reconScreen(kind: 'bank' | 'invoices' | 'cards'): Screen {
  const r = rng(`recon-${kind}`)
  const n = 9
  const cfg = {
    bank: { cols: ['Date', 'Statement line', 'Matched with'], lines: ['CARD SETTLEMENT', 'CASH DEPOSIT', 'SUPPLIER TRANSFER', 'PAYROLL', 'RENT', 'CARD SETTLEMENT', 'CASH DEPOSIT', 'TAX', 'CARD SETTLEMENT'], match: ['Card batch', 'Cash close', 'Receipt RC-880', 'Payroll run', 'Lease', 'Card batch', 'Cash close', 'Tax return', 'Card batch'], desc: 'The bank statement against the books: every line is matched to something, or waits for you.' },
    invoices: { cols: ['Period', 'Platform', 'Matched with'], lines: ['Uber Eats · week 45', 'Glovo · week 45', 'Deliveroo · week 45', 'Uber Eats · week 44', 'Glovo · week 44', 'Deliveroo · week 44', 'Uber Eats · week 43', 'Glovo · week 43', 'Deliveroo · week 43'], match: ['Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions', 'Platform sessions'], desc: 'What each delivery platform billed against the orders it sent. A gap is a missing order or a wrong commission.' },
    cards: { cols: ['Batch', 'Terminal', 'Matched with'], lines: ['Batch 4471', 'Batch 4472', 'Batch 4473', 'Batch 4474', 'Batch 4475', 'Batch 4476', 'Batch 4477', 'Batch 4478', 'Batch 4479'], match: ['Card payments', 'Card payments', 'Card payments', 'Card payments', 'Card payments', 'Card payments', 'Card payments', 'Card payments', 'Card payments'], desc: 'What the card terminals settled against the card payments in the books.' },
  }[kind]
  const rows: Row[] = Array.from({ length: n }, (_, i) => {
    const amt = between(r, 180, 2400)
    const bad = i % 4 === 2
    const gap = bad ? -between(r, 4, 55) : 0
    return { id: `r${i}`, a: kind === 'cards' ? `T-0${1 + (i % 4)}` : day(i), b: cfg.lines[i], m: bad ? '—' : cfg.match[i], amount: M(amt), gap: T(gap === 0 ? '0,00 €' : eur(gap, 2), { n: gap }), status: bad ? S('Unmatched', 'warn') : S('Matched', 'ok') }
  })
  const bad = rows.filter((x) => text(x.status) === 'Unmatched').length
  return {
    desc: cfg.desc,
    actions: <Act label="Match automatically" say="Lines that agree on amount and date would be matched" primary />,
    body: (
      <>
        <Kpis items={[{ label: 'Matched', value: `${Math.round(((n - bad) / n) * 100)} %`, tone: 'ok' }, { label: 'To handle', value: String(bad), tone: 'warn' }, { label: 'Gap in total', value: eur(sum(rows.map((x) => (x.gap as CellObj).n!)), 2) }]} />
        {table({ cols: [{ key: 'a', label: cfg.cols[0], kind: 'mono' }, { key: 'b', label: cfg.cols[1], kind: 'strong' }, { key: 'm', label: cfg.cols[2] }, { key: 'amount', label: 'Amount', kind: 'num' }, { key: 'gap', label: 'Gap', kind: 'num' }, { key: 'status', label: 'Status', kind: 'pill' }], rows, search: 'Search lines', filter: { key: 'status', label: 'Status' }, drawer: (x) => ({ title: String(text(x.b)), status: <Pill tone={(x.status as CellObj).tone}>{text(x.status)}</Pill>, actions: text(x.status) === 'Unmatched' ? [{ label: 'Match by hand', primary: true, say: 'This would open the matching list' }] : [] }) })}
      </>
    ),
  }
}

/* ───────────────────────── Platform ───────────────────────── */

function soonScreen(what: string, bullets: [string, string][]): Screen {
  return { desc: `${what} is not available yet.`, body: <><Banner tone="info" title="Coming soon">Here is what it will bring.</Banner><Cards items={bullets.map(([t, s]) => ({ title: t, sub: s, pill: { text: 'Planned', tone: 'neutral' as Tone, dashed: true } }))} cols={3} /></> }
}

function integrationsScreen(): Screen {
  const I: [string, string, string, boolean][] = [['Adyen', 'Card payments', 'Settles card batches', true], ['Uber Eats', 'Delivery', 'Orders land in the POS', true], ['Glovo', 'Delivery', 'Orders land in the POS', true], ['Deliveroo', 'Delivery', 'Orders land in the POS', false], ['Xero', 'Accounting', 'Sends daily sales', false], ['Mailchimp', 'Marketing', 'Syncs loyalty members', false]]
  return { desc: 'The services the Back Office talks to. A connected service shows its last sync.', body: <Cards cols={3} items={I.map(([n, cat, d, on]) => ({ title: n, sub: `${cat} · ${d}`, pill: on ? { text: 'Connected', tone: 'ok' as Tone } : { text: 'Not connected', tone: 'neutral' as Tone, dashed: true }, meta: [['Last sync', on ? '4 min ago' : '—']] as [string, string][], actions: [on ? { label: 'Manage', say: `This would open the ${n} settings` } : { label: 'Connect', primary: true, say: `This would start connecting ${n}` }] }))} /> }
}

/* ───────────────────────── the registry ───────────────────────── */

export function screenFor(id: string, c: Ctx): Screen | null {
  const g = id.split('.')[0]
  switch (id) {
    case 'hierarchy.tree':
      return { desc: 'The whole structure of the client, level by level. Pick a node to see what it holds and what it is responsible for.', actions: <><Go label="Open the map" go={c.go} mode="explore" /><Act label="Add a node" say="This would open the node form" primary /></>, body: <OrgTree holdings={c.holdings} /> }
    case 'hierarchy.profile':
      return profileScreen(c)
    case 'hierarchy.outlets':
      return outletsScreen(c)
    case 'hierarchy.opening':
      return openingScreen(c)
    case 'dashboards.ranking':
      return { desc: 'How the parts of the client compare today, best first.', actions: <Go label="Open the dashboard" go={c.go} mode="insights" />, body: <RankingView c={c} /> }
    case 'dashboards.currencies': {
      const rows: Row[] = [['US dollar', 'USD', '1,0832'], ['Pound sterling', 'GBP', '0,8641'], ['Moroccan dirham', 'MAD', '10,9120'], ['Swiss franc', 'CHF', '0,9410'], ['Danish krone', 'DKK', '7,4590']].map(([n, code, rate], i) => ({ id: code, n, code, rate, upd: `${day(0)} · 06:00`, src: 'ECB reference', st: i === 2 ? S('Stale · 2 days', 'warn') : S('Current', 'ok') }))
      return { desc: 'The rates used to show totals in one currency. A converted total always says the date of its rate.', body: <><Banner tone="info" title="Converted at the rates of the day">Every total shown in another currency carries the date of its rate.</Banner>{table({ cols: [{ key: 'n', label: 'Currency', kind: 'strong' }, { key: 'code', label: 'Code', kind: 'mono' }, { key: 'rate', label: 'Rate per 1 EUR', kind: 'num' }, { key: 'upd', label: 'Updated' }, { key: 'src', label: 'Source' }, { key: 'st', label: 'Status', kind: 'pill' }], rows })}</> }
    }
    case 'estate.integrations':
      return integrationsScreen()
    case 'estate.pos':
      return soonScreen('The POS page', [['Terminals & stations', 'Pair, rename and retire POS devices'], ['Receipt templates', 'One receipt look per brand'], ['Offline mode', 'What a till may do without a connection']])
    case 'estate.mpos':
      return soonScreen('The Mobile POS page', [['Handhelds', 'Pair and assign waiter devices'], ['Table service rules', 'Who may open, move and close tables'], ['Battery & sync', 'Spot a device that stopped syncing']])
    case 'estate.kiosk':
      return soonScreen('The Kiosk page', [['Kiosk fleet', 'Status of every self-order kiosk'], ['Attract screen', 'Images and languages'], ['Payment at the kiosk', 'Card, contactless and cash options']])
    case 'estate.queue':
      return soonScreen('Customer queueing', [['Queue rules', 'Tickets, estimates and call order'], ['Call screens', 'What the lobby screen says'], ['Wait statistics', 'How long people really wait']])
    case 'estate.display':
      return soonScreen('The Customer display page', [['Screens', 'Status of every customer-facing screen'], ['Content', 'Order summary, offers and thank-you'], ['Languages', 'One display language per outlet']])
    case 'estate.drive':
      return soonScreen('The Drive-thru display page', [['Lanes', 'Menu boards and order confirmation screens'], ['Timers', 'Time at the window and the pay point'], ['Order flow', 'From the speaker to the kitchen']])
    case 'catalogue.articles':
      return catalogueScreen()
  }
  if (g === 'parties') return partiesScreens(c)[id] ?? null
  if (g === 'governance') return governanceScreens(c)[id] ?? null
  if (g === 'access') return accessScreens(c)[id] ?? null
  if (g === 'sales') return salesScreens(c)[id] ?? null
  if (g === 'cash') return cashScreens(c)[id] ?? null
  if (g === 'dining') return diningScreens()[id] ?? null
  if (g === 'reservations') return reservationScreens()[id] ?? null
  if (g === 'kitchen') return kitchenScreens(c)[id] ?? null
  if (g === 'stock') return stockScreens(c)[id] ?? null
  if (g === 'reports') return { desc: 'A report for a period and a channel, in euros. Change the period or the channel to see it again.', actions: <Act label="Print" say="This would open the print layout" />, body: <Report key={id} c={c} kind={id.split('.')[1]} /> }
  if (id === 'reconciliations.bank') return reconScreen('bank')
  if (id === 'reconciliations.invoices') return reconScreen('invoices')
  if (id === 'reconciliations.cards') return reconScreen('cards')
  return null
}

