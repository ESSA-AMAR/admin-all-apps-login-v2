import { between, pick, rng } from '../lib/random'
import type { Brand, BrandIcon, City, Country, Holding, Industry, IndustryId, Store, StoreStatus, User } from './types'

export const INDUSTRIES: Industry[] = [
  { id: 'it', name: 'IT', tagline: 'Retail tech, devices & service desks' },
  { id: 'hospitality', name: 'Hospitality', tagline: 'Restaurants, bars, hotels & lounges' },
  { id: 'harvest', name: 'Harvest', tagline: 'Fresh markets, farms & produce' },
]

export const industryById = (id: IndustryId) => INDUSTRIES.find((i) => i.id === id)!

export const COUNTRIES: Country[] = [
  { id: '056', code: 'BE', name: 'Belgium' },
  { id: '250', code: 'FR', name: 'France' },
  { id: '528', code: 'NL', name: 'Netherlands' },
  { id: '442', code: 'LU', name: 'Luxembourg' },
  { id: '276', code: 'DE', name: 'Germany' },
  { id: '724', code: 'ES', name: 'Spain' },
  { id: '504', code: 'MA', name: 'Morocco' },
  { id: '784', code: 'AE', name: 'United Arab Emirates' },
]

export const countryById = (id: string) => COUNTRIES.find((c) => c.id === id)!

export const CITIES: City[] = [
  { id: 'bru', name: 'Brussels', countryId: '056', lat: 50.8466, lon: 4.3528 },
  { id: 'anr', name: 'Antwerp', countryId: '056', lat: 51.2194, lon: 4.4025 },
  { id: 'ghe', name: 'Ghent', countryId: '056', lat: 51.0543, lon: 3.7174 },
  { id: 'lie', name: 'Liège', countryId: '056', lat: 50.6326, lon: 5.5797 },
  { id: 'brg', name: 'Bruges', countryId: '056', lat: 51.2093, lon: 3.2247 },
  { id: 'par', name: 'Paris', countryId: '250', lat: 48.8566, lon: 2.3522 },
  { id: 'lyo', name: 'Lyon', countryId: '250', lat: 45.764, lon: 4.8357 },
  { id: 'lil', name: 'Lille', countryId: '250', lat: 50.6292, lon: 3.0573 },
  { id: 'mrs', name: 'Marseille', countryId: '250', lat: 43.2965, lon: 5.3698 },
  { id: 'bod', name: 'Bordeaux', countryId: '250', lat: 44.8378, lon: -0.5792 },
  { id: 'ams', name: 'Amsterdam', countryId: '528', lat: 52.3676, lon: 4.9041 },
  { id: 'rot', name: 'Rotterdam', countryId: '528', lat: 51.9244, lon: 4.4777 },
  { id: 'utr', name: 'Utrecht', countryId: '528', lat: 52.0907, lon: 5.1214 },
  { id: 'lux', name: 'Luxembourg City', countryId: '442', lat: 49.6116, lon: 6.1319 },
  { id: 'ber', name: 'Berlin', countryId: '276', lat: 52.52, lon: 13.405 },
  { id: 'muc', name: 'Munich', countryId: '276', lat: 48.1351, lon: 11.582 },
  { id: 'mad', name: 'Madrid', countryId: '724', lat: 40.4168, lon: -3.7038 },
  { id: 'bcn', name: 'Barcelona', countryId: '724', lat: 41.3874, lon: 2.1686 },
  { id: 'vlc', name: 'Valencia', countryId: '724', lat: 39.4699, lon: -0.3763 },
  { id: 'cas', name: 'Casablanca', countryId: '504', lat: 33.5731, lon: -7.5898 },
  { id: 'rak', name: 'Marrakech', countryId: '504', lat: 31.6295, lon: -7.9811 },
  { id: 'aga', name: 'Agadir', countryId: '504', lat: 30.4278, lon: -9.5981 },
  { id: 'dxb', name: 'Dubai', countryId: '784', lat: 25.2048, lon: 55.2708 },
  { id: 'auh', name: 'Abu Dhabi', countryId: '784', lat: 24.4539, lon: 54.3773 },
]

export const cityById = (id: string) => CITIES.find((c) => c.id === id)!

const STREETS: Record<string, string[]> = {
  '056': ['Rue Neuve', 'Avenue Louise', 'Meir', 'Veldstraat', 'Boulevard Anspach', 'Place Flagey', 'Rue du Midi', 'Steenstraat'],
  '250': ['Rue de Rivoli', 'Boulevard Haussmann', 'Rue de la République', 'Cours Mirabeau', 'Rue Sainte-Catherine', 'Quai Saint-Antoine'],
  '528': ['Kalverstraat', 'Damrak', 'Lijnbaan', 'Oudegracht', 'Witte de Withstraat', 'Leidsestraat'],
  '442': ['Grand-Rue', 'Avenue de la Liberté', 'Rue Philippe II'],
  '276': ['Friedrichstraße', 'Kurfürstendamm', 'Maximilianstraße', 'Torstraße', 'Sendlinger Straße'],
  '724': ['Gran Vía', 'Passeig de Gràcia', 'Calle Serrano', 'Carrer de Colón', 'Calle de Alcalá'],
  '504': ['Boulevard Mohammed V', 'Avenue Hassan II', 'Rue Yougoslavie', 'Boulevard Anfa', 'Avenue Mohammed VI'],
  '784': ['Sheikh Zayed Road', 'Al Wasl Road', 'Corniche Road', 'Jumeirah Beach Road', 'Al Maryah Island'],
}

type BrandSpec = [slug: string, industry: IndustryId, name: string, tagline: string, icon: BrandIcon]
type StoreSpec = [brandSlug: string, cityId: string, count: number]

const SUFFIX = ['Centre', 'Nord', 'Sud', 'Est', 'Ouest', 'Gare', 'Port']

function buildHolding(base: Omit<Holding, 'brands' | 'stores'>, brandSpecs: BrandSpec[], specs: StoreSpec[]): Holding {
  const brands: Brand[] = brandSpecs.map(([slug, industry, name, tagline, icon]) => ({
    id: `${base.id}-${slug}`,
    holdingId: base.id,
    industry,
    name,
    tagline,
    icon,
  }))
  const stores: Store[] = []
  for (const [slug, cityId, count] of specs) {
    const brand = brands.find((b) => b.id === `${base.id}-${slug}`)!
    const city = cityById(cityId)
    for (let n = 0; n < count; n++) {
      const id = `${brand.id}-${cityId}-${n + 1}`
      const r = rng(id)
      const angle = r() * Math.PI * 2
      const dist = 0.008 + r() * 0.035
      const statusRoll = r()
      const status: StoreStatus = statusRoll > 0.93 ? 'offline' : statusRoll > 0.82 ? 'degraded' : 'online'
      stores.push({
        id,
        name: `${brand.name} ${city.name}${count > 1 ? ` ${SUFFIX[n % SUFFIX.length]}` : ''}`,
        holdingId: base.id,
        industry: brand.industry,
        brandId: brand.id,
        countryId: city.countryId,
        cityId,
        lat: city.lat + Math.sin(angle) * dist,
        lon: city.lon + Math.cos(angle) * dist * 1.5,
        address: `${Math.floor(between(r, 1, 240))} ${pick(r, STREETS[city.countryId])}`,
        status,
        terminals: Math.floor(between(r, 2, 14)),
        openedYear: Math.floor(between(r, 2012, 2026)),
      })
    }
  }
  return { ...base, brands, stores }
}

export const HOLDINGS: Holding[] = [
  buildHolding(
    { id: 'cmh', name: 'Caisse Manager Holding', code: 'CMH', hq: 'Brussels, BE', founded: 2011 },
    [
      ['crusty', 'hospitality', 'Crusty', 'Artisan bakery & sandwiches', 'bread'],
      ['panda', 'hospitality', 'Panda', 'Asian street food', 'bowl'],
      ['techpoint', 'it', 'TechPoint', 'Devices, repair & service desk', 'laptop'],
      ['bytehub', 'it', 'ByteHub', 'Audio & accessories', 'headphones'],
      ['greenbasket', 'harvest', 'Green Basket', 'Organic grocery', 'basket'],
      ['fieldfork', 'harvest', 'Field & Fork', 'Farm-to-table market', 'carrot'],
    ],
    [
      ['techpoint', 'bru', 3], ['techpoint', 'anr', 2], ['techpoint', 'par', 2], ['techpoint', 'lux', 1], ['techpoint', 'ber', 2],
      ['bytehub', 'bru', 1], ['bytehub', 'ghe', 1], ['bytehub', 'par', 1], ['bytehub', 'ams', 2],
      ['crusty', 'bru', 3], ['crusty', 'lie', 2], ['crusty', 'brg', 2], ['crusty', 'par', 3], ['crusty', 'lyo', 2], ['crusty', 'cas', 2],
      ['panda', 'bru', 2], ['panda', 'par', 1], ['panda', 'mrs', 1], ['panda', 'bcn', 3], ['panda', 'mad', 2], ['panda', 'dxb', 3],
      ['greenbasket', 'ghe', 2], ['greenbasket', 'bru', 2], ['greenbasket', 'rot', 2], ['greenbasket', 'utr', 1],
      ['fieldfork', 'lil', 2], ['fieldfork', 'bod', 1], ['fieldfork', 'rak', 2], ['fieldfork', 'aga', 3], ['fieldfork', 'vlc', 2],
    ],
  ),
  buildHolding(
    { id: 'nlv', name: 'Nordlight Ventures', code: 'NLV', hq: 'Amsterdam, NL', founded: 2016 },
    [
      ['novadesk', 'it', 'NovaDesk', 'Business IT & workstations', 'laptop'],
      ['syncro', 'it', 'Syncro', 'Mobile & connected devices', 'mobile'],
      ['orchard', 'harvest', 'Orchard Lane', 'Fresh fruit & juice bars', 'orange'],
    ],
    [
      ['novadesk', 'ams', 2], ['novadesk', 'rot', 2], ['novadesk', 'ber', 3],
      ['syncro', 'ams', 1], ['syncro', 'utr', 2], ['syncro', 'muc', 2],
      ['orchard', 'ams', 2], ['orchard', 'utr', 2], ['orchard', 'anr', 1],
    ],
  ),
  buildHolding(
    { id: 'ahg', name: 'Atlas Hospitality Group', code: 'AHG', hq: 'Casablanca, MA', founded: 2014 },
    [
      ['panda', 'hospitality', 'Panda', 'Asian street food', 'bowl'],
      ['sora', 'hospitality', 'Sora Lounge', 'Rooftop lounges & cocktails', 'wine'],
    ],
    [
      ['panda', 'cas', 3], ['panda', 'rak', 2], ['panda', 'dxb', 2], ['panda', 'par', 2],
      ['sora', 'cas', 1], ['sora', 'rak', 1], ['sora', 'aga', 2], ['sora', 'dxb', 2], ['sora', 'auh', 2], ['sora', 'bru', 1],
    ],
  ),
  buildHolding(
    { id: 'lmn', name: 'Lumen Retail Group', code: 'LMN', hq: 'Liège, BE', founded: 2019 },
    [
      ['syncro', 'it', 'Syncro', 'Mobile & connected devices', 'mobile'],
      ['crusty', 'hospitality', 'Crusty', 'Artisan bakery & sandwiches', 'bread'],
      ['root', 'harvest', 'Root Collective', 'Local produce co-op', 'leaf'],
    ],
    [
      ['syncro', 'lie', 2], ['syncro', 'bru', 2], ['syncro', 'lux', 1],
      ['crusty', 'lie', 3], ['crusty', 'bru', 2],
      ['root', 'lie', 1], ['root', 'ghe', 1],
    ],
  ),
]

/** The POS demo PIN; every POS profile uses it, exactly as in the POS. */
export const POS_PIN = '1234'

/** Demo accounts. Every role signs in with email + its own password; front-line roles can also use a staff PIN on a store terminal. */
export const USERS: (User & { password?: string; pin?: string })[] = [
  { id: 'u-admin', name: 'Benaissa Amari', email: 'admin@caissemanager.com', password: 'admin123', pin: '0011665980', role: 'super_admin', title: 'Group Administrator', assignment: { holdingIds: ['cmh', 'nlv', 'ahg'] } },
  { id: 'u-holding', name: 'Sarah Lambert', email: 'manager@lumen.be', password: 'holding123', role: 'holding_admin', title: 'Holding Director · Lumen', assignment: { holdingIds: ['lmn'] } },
  { id: 'u-brand', name: 'Yanis Benali', email: 'brand@crusty.be', password: 'brand123', role: 'brand_manager', title: 'Brand Manager · Crusty', assignment: { holdingIds: ['cmh'], brandIds: ['cmh-crusty'] } },
  { id: 'u-region', name: 'Nadia El Amrani', email: 'benelux@caissemanager.com', password: 'region123', role: 'regional_manager', title: 'Regional Manager · Benelux', assignment: { holdingIds: ['cmh'], countryIds: ['056', '528', '442'] } },
  { id: 'u-store', name: 'Tom Peeters', email: 'tom@crusty.be', password: 'store123', role: 'store_manager', title: 'Store Manager · Crusty Brussels Centre', assignment: { holdingIds: ['cmh'], storeIds: ['cmh-crusty-bru-1'] } },
  // The POS team (public/pos): same people, photos and PIN as the POS, so the POS opens on their own account.
  { id: 'pos-youssef', name: 'Youssef El Idrissi', email: 'youssef@atlas.ma', password: 'youssef123', pin: POS_PIN, role: 'cashier', title: 'Cashier · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/youssef.png', posId: 'youssef' },
  { id: 'pos-karim', name: 'Karim Bennani', email: 'karim@atlas.ma', password: 'karim123', pin: POS_PIN, role: 'cashier', title: 'Cashier · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/karim.png', posId: 'karim' },
  { id: 'pos-benaissa', name: 'Benaissa Amari', email: 'benaissa@atlas.ma', password: 'benaissa123', pin: POS_PIN, role: 'cashier', title: 'Cashier · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/benaissa.png', posId: 'benaissa' },
  { id: 'pos-mehdi', name: 'Mehdi Tazi', email: 'mehdi@atlas.ma', password: 'mehdi123', pin: POS_PIN, role: 'cashier', title: 'Cashier · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/mehdi.png', posId: 'mehdi' },
  { id: 'pos-salma', name: 'Salma Alaoui', email: 'salma@atlas.ma', password: 'salma123', pin: POS_PIN, role: 'cashier', title: 'Cashier · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/salma.png', posId: 'salma' },
  { id: 'pos-hamza', name: 'Hamza Berrada', email: 'hamza@atlas.ma', password: 'hamza123', pin: POS_PIN, role: 'store_manager', title: 'Store Manager · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/staff/hamza.png', posId: 'hamza' },
  { id: 'pos-imane', name: 'Imane Chraibi', email: 'imane@atlas.ma', password: 'imane123', pin: POS_PIN, role: 'store_manager', title: 'Store Manager · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/staff/imane.png', posId: 'imane' },
  { id: 'pos-yassine', name: 'Yassine Lahlou', email: 'yassine@atlas.ma', password: 'yassine123', pin: POS_PIN, role: 'store_manager', title: 'Store Manager · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/staff/yassine.png', posId: 'yassine' },
  { id: 'pos-omar', name: 'Omar Fassi', email: 'omar@atlas.ma', password: 'omar123', pin: POS_PIN, role: 'store_manager', title: 'Store Manager · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/staff/omar.png', posId: 'omar' },
  { id: 'pos-anas', name: 'Anas Kettani', email: 'anas@atlas.ma', password: 'anas123', pin: POS_PIN, role: 'store_manager', title: 'Store Manager · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] }, photo: '/pos/assets/staff/anas.png', posId: 'anas' },
  { id: 'pos-driss', name: 'Driss Amrani', email: 'driss@atlas.ma', password: 'driss123', pin: POS_PIN, role: 'waiter', title: 'Waiter · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1', 'ahg-panda-cas-2'] }, photo: '/pos/assets/staff/driss.png', posId: 'driss' },
  { id: 'pos-nadia', name: 'Nadia Benjelloun', email: 'nadia@atlas.ma', password: 'nadia123', pin: POS_PIN, role: 'waiter', title: 'Waiter · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1', 'ahg-panda-cas-2'] }, photo: '/pos/assets/staff/nadia.png', posId: 'nadia' },
  { id: 'pos-rachid', name: 'Rachid Ouazzani', email: 'rachid@atlas.ma', password: 'rachid123', pin: POS_PIN, role: 'waiter', title: 'Waiter · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1', 'ahg-panda-cas-2'] }, photo: '/pos/assets/staff/rachid.png', posId: 'rachid' },
  { id: 'pos-kenza', name: 'Kenza Sebti', email: 'kenza@atlas.ma', password: 'kenza123', pin: POS_PIN, role: 'waiter', title: 'Waiter · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1', 'ahg-panda-cas-2'] }, photo: '/pos/assets/staff/kenza.png', posId: 'kenza' },
  { id: 'pos-leila', name: 'Leila Mansouri', email: 'leila@atlas.ma', password: 'leila123', pin: POS_PIN, role: 'waiter', title: 'Waiter · Panda Casablanca', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1', 'ahg-panda-cas-2'] }, photo: '/pos/assets/staff/leila.png', posId: 'leila' },
  { id: 'u-kitchen', name: 'Rayan Kaci', email: 'rayan@panda.be', password: 'kitchen123', pin: '3333', role: 'kitchen', title: 'Kitchen Post', assignment: { holdingIds: ['cmh'], storeIds: ['cmh-panda-bru-1'] } },
  { id: 'u-driver', name: 'Hugo Martin', email: 'hugo@atlas.ma', password: 'driver123', pin: '4444', role: 'driver', title: 'Driver', assignment: { holdingIds: ['ahg'], storeIds: ['ahg-panda-cas-1'] } },
  { id: 'u-employee', name: 'Lina Bakri', email: 'lina@lumen.be', password: 'employee123', pin: '5555', role: 'employee', title: 'Employee', assignment: { holdingIds: ['lmn'], storeIds: ['lmn-crusty-lie-1'] } },
]
