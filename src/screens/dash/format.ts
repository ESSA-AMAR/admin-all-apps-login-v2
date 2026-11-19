/** Number formats for the first page's tabs (French: a space for thousands, a comma for decimals). */
import { eur } from '../../lib/kpis'

export const num = (v: number, d = 0) => v.toLocaleString('fr-BE', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (v: number, d = 0) => `${num(v, d)} %`
export const signed = (v: number, d = 1) => `${v < 0 ? '−' : '+'}${num(Math.abs(v), d)} %`
export const pts = (v: number, d = 1) => `${v < 0 ? '−' : '+'}${num(Math.abs(v), d)} pts`
/** Millions and big thousands shortened, the rest in full. */
export const money = (v: number) => (Math.abs(v) >= 1_000_000 ? `${num(v / 1_000_000, 2)} M€` : Math.abs(v) >= 100_000 ? `${num(v / 1000, 0)} k€` : eur(v))
export const ago = (min: number) => (min < 60 ? `${Math.max(1, Math.round(min))} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`)
