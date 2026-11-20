/**
 * Platform › POS: every setting of the POS's own menu, set from the Back Office, plus the stations and the floor plan.
 * The POS keeps four of them in the browser under its own keys (theme, language, receipt look, floor plan); those are written there, so the till opens with them.
 * The others (dishes view, motion, sounds, category photos, keyboard) are kept here until the POS reads them.
 */
import { useRef, useState } from 'react'
import { Banner, Cards, DataTable, Kpis, Section, Settings, type CardItem, type Row, type SettingRow } from './kit'
import { useFloor } from './floor'

const KEY = 'cm-bo-pos-settings'

export interface PosPrefs {
  theme: 'Dark' | 'Light' | 'Smart'
  receipt: 'Light' | 'Dark'
  dishes: 'Photos' | 'Cards'
  language: 'English' | 'Français' | 'العربية'
  motion: 'Full' | 'Lite'
  sounds: boolean
  catPics: boolean
  keyboard: boolean
}
/** What the POS starts with when nothing was chosen. */
const DEFAULTS: PosPrefs = { theme: 'Smart', receipt: 'Dark', dishes: 'Photos', language: 'English', motion: 'Full', sounds: true, catPics: false, keyboard: true }

const LANG_CODE = { English: 'en', Français: 'fr', العربية: 'ar' } as const
const LANG_NAME = { en: 'English', fr: 'Français', ar: 'العربية' } as const

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage can be blocked; the choice stays for this visit */
  }
}

/** The current choices: the POS's own keys where it has them, then what was set here, then the defaults. */
function load(): PosPrefs {
  let mine: Partial<PosPrefs> = {}
  try {
    mine = JSON.parse(read(KEY) ?? '{}')
  } catch {
    /* nothing saved yet */
  }
  const theme = read('cm-pos-v3-theme')
  const tk = read('cm-pos-v3-tk')
  const lang = read('cm-lang') as keyof typeof LANG_NAME | null
  return {
    ...DEFAULTS,
    ...mine,
    ...(theme === 'dark' || theme === 'light' || theme === 'smart' ? { theme: (theme[0].toUpperCase() + theme.slice(1)) as PosPrefs['theme'] } : {}),
    ...(tk === 'dark' || tk === 'light' ? { receipt: (tk[0].toUpperCase() + tk.slice(1)) as PosPrefs['receipt'] } : {}),
    ...(lang && LANG_NAME[lang] ? { language: LANG_NAME[lang] } : {}),
  }
}

/** Keeps a choice, and writes it where the POS reads it when the POS has a key for it. */
function keep(prefs: PosPrefs, patch: Partial<PosPrefs>) {
  const next = { ...prefs, ...patch }
  write(KEY, JSON.stringify(next))
  if ('theme' in patch) write('cm-pos-v3-theme', next.theme.toLowerCase())
  if ('receipt' in patch) write('cm-pos-v3-tk', next.receipt.toLowerCase())
  if ('language' in patch) write('cm-lang', LANG_CODE[next.language])
  return next
}

const STATIONS: [string, string, string, boolean][] = [
  ['POS 1', 'Benaissa Amari', '11:06', true],
  ['POS 2', 'Karim Bennani', '08:30', true],
  ['POS 3', 'Salma Alaoui', '09:15', false],
  ['POS 4', 'Mehdi Tazi', '10:42', true],
]

export function PosSettings({ open }: { open: (id: string) => void }) {
  const floor = useFloor()
  const [prefs] = useState<PosPrefs>(load)
  /** The choices as they stand, kept between changes (only read when one is changed). */
  const cur = useRef<PosPrefs>(prefs)
  const set = <K extends keyof PosPrefs>(k: K) => (v: boolean | string) => {
    cur.current = keep(cur.current, { [k]: v } as Partial<PosPrefs>)
  }
  const mine = { text: 'Defined here', tone: 'ok' as const }

  const look: SettingRow[] = [
    { name: 'Theme', desc: 'Dark, Light, or Smart (the light-blue look)', kind: 'select', options: ['Dark', 'Light', 'Smart'], value: prefs.theme, source: mine, onChange: set('theme') },
    { name: 'Receipt', desc: 'The ticket on screen, light or dark', kind: 'select', options: ['Light', 'Dark'], value: prefs.receipt, source: mine, onChange: set('receipt') },
    { name: 'Dishes', desc: 'Dish cards with their photos, or plain cards with name and price', kind: 'select', options: ['Photos', 'Cards'], value: prefs.dishes, source: mine, onChange: set('dishes') },
    { name: 'Language', desc: 'The language the till starts in', kind: 'select', options: ['English', 'Français', 'العربية'], value: prefs.language, source: mine, onChange: set('language') },
  ]
  const feel: SettingRow[] = [
    { name: 'Motion', desc: 'Full animation, or Lite for slower tablets', kind: 'select', options: ['Full', 'Lite'], value: prefs.motion, source: mine, onChange: set('motion') },
    { name: 'Sounds', desc: 'Taps, sending to the kitchen, payment done', kind: 'switch', on: prefs.sounds, source: mine, onChange: set('sounds') },
    { name: 'Category photos', desc: 'Pictures on the category rail, not only icons', kind: 'switch', on: prefs.catPics, source: mine, onChange: set('catPics') },
    { name: 'Keyboard', desc: 'The on-screen keyboard in search and name fields', kind: 'switch', on: prefs.keyboard, source: mine, onChange: set('keyboard') },
  ]

  const zones = floor.zones.length
  const tables = floor.tables.length
  const seats = floor.tables.reduce((n, t) => n + t.seats, 0)
  const linked: CardItem[] = [
    {
      title: 'Floor plan',
      sub: 'Zones, table shapes and sizes, drawn to scale',
      pill: { text: `${tables} tables · ${zones} ${zones === 1 ? 'zone' : 'zones'}`, tone: 'ok' },
      meta: [
        ['Seats', String(seats)],
        ['Zones', floor.zones.map((z) => z.name).join(', ')],
      ],
      actions: [{ label: 'Open the floor plan editor', say: '', primary: true, onClick: () => open('dining.plan') }],
    },
    {
      title: 'Kitchen display',
      sub: 'Where tickets go when a table presses Send',
      pill: { text: 'Linked', tone: 'ok' },
      meta: [
        ['Screen', 'KDS'],
        ['Stations', 'Grill, Hot line, Cold line, Fryer, Bar, Pastry'],
      ],
      actions: [{ label: 'Open the kitchen display', say: '', onClick: () => open('estate.kds') }],
    },
  ]
  const rows: Row[] = STATIONS.map(([n, who, since, printer]) => ({
    id: n,
    name: n,
    who,
    since: `Opened at ${since}`,
    printer: { t: printer ? 'Printer connected' : 'Printer disconnected', tone: printer ? 'ok' : 'warn' },
    status: { t: printer ? 'Ready' : 'Check the printer', tone: printer ? 'ok' : 'warn' },
  }))

  return (
    <>
      <Kpis items={[{ label: 'Stations', value: String(STATIONS.length) }, { label: 'Printers connected', value: `${STATIONS.filter((s) => s[3]).length} of ${STATIONS.length}`, tone: 'warn' }, { label: 'Tables', value: String(tables), hint: `${seats} seats` }, { label: 'Zones', value: String(zones) }]} />
      <Banner tone="info" title="These are the settings the POS opens with">
        A cashier can still change the look from the POS profile menu. Theme, Language, Receipt and the floor plan are the ones the POS reads from this device today; the rest are saved here.
      </Banner>
      <Section title="Look">
        <Settings rows={look} />
      </Section>
      <Section title="Behaviour">
        <Settings rows={feel} />
      </Section>
      <Section title="Connected screens">
        <Cards items={linked} cols={2} />
      </Section>
      <Section title="Stations" hint="Switch POS lists these at the till">
        <DataTable
          cols={[
            { key: 'name', label: 'Station', kind: 'strong' },
            { key: 'who', label: 'Cashier' },
            { key: 'since', label: 'Opened' },
            { key: 'printer', label: 'Printer', kind: 'pill' },
            { key: 'status', label: 'Status', kind: 'pill' },
          ]}
          rows={rows}
        />
      </Section>
      <p className="bo-note">
        Order, Tables, Orders list and Pending are the POS's own screens: their data is under Sales and Dining room.
      </p>
    </>
  )
}

