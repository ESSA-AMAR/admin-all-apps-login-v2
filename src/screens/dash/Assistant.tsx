/**
 * The assistant: a chat to get a short answer about anything on the first page, and a button to the tab that shows more.
 * A demo for now: it reads this page's own data (no AI model, nothing leaves the browser). It can be connected to Claude later.
 */
import { ArrowRight, PaperPlaneRight, Sparkle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { eur, type ScopeKpis } from '../../lib/kpis'
import { DAYS_LONG, hourRange, ZONE_LABEL, type BenchUnit, type DashTab, type FeedbackInsights, type SalesInsights, type SuggestedAction } from '../../lib/insights'
import { num, pct, signed } from './format'
import type { LiveStats } from './live-orders'

export interface AssistantCtx {
  scopeName: string
  single: boolean
  base: ScopeKpis
  liveRevenue: number
  liveTx: number
  live: LiveStats
  sales: SalesInsights
  bench: BenchUnit[]
  fb: FeedbackInsights
  actions: SuggestedAction[]
}

interface Msg {
  id: number
  from: 'me' | 'bot'
  text: string
  go?: { label: string; tab: DashTab }[]
}

const TAB_LABEL: Record<DashTab, string> = { today: 'Open Today', sales: 'Open Sales', bench: 'Open Benchmark', feedback: 'Open Feedback' }
const SUGGESTIONS = ['How are sales today?', 'Best sellers', 'Peak days and hours', 'Where do I rank?', 'Customer feedback', 'What should I do?']

type Intent = 'greet' | 'help' | 'best' | 'peak' | 'online' | 'orders' | 'bench' | 'feedback' | 'actions' | 'cost' | 'today'
/** Words that point to each answer (English and French), checked in this order on a tie. */
const WORDS: [Intent, string[]][] = [
  ['greet', ['hello', 'hi ', 'hey', 'bonjour', 'salam', 'salut']],
  ['help', ['help', 'aide', 'what can you', 'que peux']],
  ['best', ['best', 'top', 'seller', 'popular', 'meilleur', 'plus vendu', 'product', 'produit', 'item', 'menu']],
  ['peak', ['peak', 'busy', 'busiest', 'rush', 'pic', 'affluence', 'hour', 'heure', 'which day', 'quel jour', 'quiet', 'calme', 'time frame', 'daypart']],
  ['online', ['online', 'delivery', 'livraison', 'glovo', 'website', 'en ligne', 'web', 'store vs', 'in store']],
  ['orders', ['order', 'commande', 'late', 'retard', 'kitchen', 'cuisine', 'live', 'en cours']],
  ['bench', ['rank', 'benchmark', 'classement', 'danger', 'safe', 'zone', 'compare', 'competit', 'concurren', 'position']],
  ['feedback', ['review', 'feedback', 'rating', 'avis', 'note', 'complain', 'plainte', 'star', 'etoile', 'customer', 'client']],
  ['actions', ['what should', 'to do', 'todo', 'action', 'suggest', 'advice', 'conseil', 'faire', 'priorit', 'next']],
  ['cost', ['prime', 'cost', 'cout', 'loss', 'perte', 'margin', 'marge', 'labour', 'like-for-like', 'lfl']],
  ['today', ['sales', 'revenue', 'vente', 'chiffre', 'today', 'aujourd', 'how are', 'how is', 'basket', 'panier', 'transaction']],
]

function intentOf(q: string): Intent | null {
  const t = ` ${q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `
  let best: Intent | null = null
  let bestHits = 0
  for (const [intent, words] of WORDS) {
    const hits = words.filter((w) => t.includes(w)).length
    if (hits > bestHits) {
      best = intent
      bestHits = hits
    }
  }
  return best
}

function answer(q: string, c: AssistantCtx): Omit<Msg, 'id' | 'from'> {
  const s = c.sales
  switch (intentOf(q)) {
    case 'greet':
      return { text: `Hello! Ask me about ${c.scopeName}: sales, best sellers, peak hours, your ranking, customer feedback or what to do next.` }
    case 'help':
      return { text: 'I can answer in a few words about:\n• today’s sales and the daily target\n• best sellers and menu products\n• peak days, hours and time frames\n• online against store orders\n• live orders and late ones\n• your ranking, safe or danger zone\n• customer feedback\n• what to do next' }
    case 'today': {
      const share = c.base.target ? (c.liveRevenue / c.base.target) * 100 : 0
      return {
        text: `**${eur(c.liveRevenue)}** so far today (${signed(c.base.deltas.revenue)} vs the same day last week), ${pct(share)} of the daily target.\n${num(c.liveTx)} transactions, average basket ${eur(c.liveTx ? c.liveRevenue / c.liveTx : 0, 2)}.`,
        go: [{ label: 'See peak hours', tab: 'sales' }],
      }
    }
    case 'best': {
      const top = [...s.products].sort((a, b) => b.qty - a.qty).slice(0, 3)
      return {
        text: `Best sellers over the last ${s.window.len} days:\n${top.map((p, i) => `${i + 1}. **${p.name}**: ${num(p.qty)} sold (${signed(p.trend, 0)})`).join('\n')}`,
        go: [{ label: TAB_LABEL.sales, tab: 'sales' }],
      }
    }
    case 'peak': {
      const part = s.dayparts.reduce((a, b) => (b.revenue > a.revenue ? b : a), s.dayparts[0])
      return {
        text: `**${DAYS_LONG[s.peakDay.dow]}** is the busiest day (${signed(s.peakDay.lift, 0)} on an average day), ${DAYS_LONG[s.quietDay.dow]} the quietest.\nPeak hour: **${hourRange(s.peakHour)}**. Best time frame: ${part.label.toLowerCase()} (${pct(part.share)} of sales).`,
        go: [{ label: 'See day × hour', tab: 'sales' }],
      }
    }
    case 'online': {
      const ch = s.channels
      const topOnline = s.sources.filter((x) => x.group === 'online').sort((a, b) => b.revenue - a.revenue)[0]
      return {
        text: `Online is **${pct(s.onlineShare, 1)}** of sales over ${s.window.len} days: ${signed(ch.online.growth)} vs the period before, against ${signed(ch.store.growth)} in store.\nOnline basket ${eur(ch.online.basket, 2)}, in store ${eur(ch.store.basket, 2)}.${topOnline ? ` First online source: ${topOnline.label}.` : ''}`,
        go: [{ label: 'See online vs store', tab: 'sales' }],
      }
    }
    case 'orders': {
      const l = c.live
      return {
        text: `**${l.open}** orders in progress: ${l.fresh} new, ${l.preparing} preparing, ${l.ready} ready to hand over.${l.late ? `\n**${l.late} late** (over 15 min)${l.worst?.where ? `, most at ${l.worst.where}` : ''}.` : '\nNone is late.'}`,
        go: [{ label: 'See live orders', tab: 'today' }],
      }
    }
    case 'bench': {
      if (!c.bench.length) return { text: 'No benchmark for this scope.' }
      if (c.bench.length === 1) {
        const u = c.bench[0]
        const city = u.cityRanks[0]
        return {
          text: `${u.name}: **#${u.industryRank.rank} of ${u.industryRank.of}** in ${u.industryRank.label}, score ${u.score}/100: **${ZONE_LABEL[u.zone].toLowerCase()}**.${city ? `\nIn ${city.label}: #${city.rank} of ${city.of}.` : ''}`,
          go: [{ label: TAB_LABEL.bench, tab: 'bench' }],
        }
      }
      const by = (z: string) => c.bench.filter((u) => u.zone === z).length
      const weakest = c.bench[0]
      const strongest = [...c.bench].sort((a, b) => b.score - a.score)[0]
      return {
        text: `${by('safe')} safe, ${by('watch')} to watch, **${by('danger')} in the danger zone**.\nWeakest: **${weakest.name}** (#${weakest.industryRank.rank} of ${weakest.industryRank.of}, ${weakest.score}/100). Best placed: ${strongest.name} (#${strongest.industryRank.rank}).`,
        go: [{ label: TAB_LABEL.bench, tab: 'bench' }],
      }
    }
    case 'feedback': {
      const f = c.fb
      const weak = [...f.topics].sort((a, b) => a.positive - b.positive)[0]
      return {
        text: `**${num(f.avg, 2)} ★** from ${num(f.count)} reviews in 7 days, ${pct(f.positive)} positive.${f.unansweredNegative ? `\n**${f.unansweredNegative} negative reviews** have no reply yet.` : ''}${weak ? ` Weakest topic: ${weak.label.toLowerCase()} (${pct(weak.positive)} positive).` : ''}`,
        go: [{ label: TAB_LABEL.feedback, tab: 'feedback' }],
      }
    }
    case 'actions': {
      const top = c.actions.slice(0, 3)
      if (!top.length) return { text: 'Nothing urgent right now.' }
      const tabs = [...new Set(top.map((a) => a.tab).filter(Boolean))] as DashTab[]
      return {
        text: `What to do first:\n${top.map((a, i) => `${i + 1}. **${a.title}**: ${a.why}`).join('\n')}`,
        go: tabs.map((t) => ({ label: TAB_LABEL[t], tab: t })),
      }
    }
    case 'cost': {
      const k = c.base.control
      return { text: `Prime cost **${pct(k.primeCost, 1)}** of sales (${k.primeCostDelta >= 0 ? '+' : '−'}${num(Math.abs(k.primeCostDelta), 1)} pts vs last week), loss ${pct(k.loss, 1)}.\nLike-for-like sales ${signed(k.lfl)} vs last year.` }
    }
    default:
      return { text: 'I can’t answer that one yet. Try one of these:' }
  }
}

/** A short pause before the answer, so it reads like a reply. */
const thinkTime = () => 450 + Math.random() * 450

/** **bold** inside a line. */
function rich(line: string): ReactNode[] {
  return line.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))
}

export function Assistant({ ctx, onTab }: { ctx: AssistantCtx; onTab: (t: DashTab) => void }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const idRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ctxRef = useRef(ctx)
  useEffect(() => {
    ctxRef.current = ctx
  }, [ctx])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  const ask = (q: string) => {
    const t = q.trim()
    if (!t || typing) return
    setMsgs((m) => [...m, { id: ++idRef.current, from: 'me', text: t }])
    setText('')
    setTyping(true)
    window.setTimeout(
      () => {
        setMsgs((m) => [...m, { id: ++idRef.current, from: 'bot', ...answer(t, ctxRef.current) }])
        setTyping(false)
      },
      thinkTime(),
    )
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dt-chat panel"
            role="dialog"
            aria-label="Assistant"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <div className="dt-chat-head">
              <span className="dt-chat-mark">
                <Sparkle size={18} weight="fill" aria-hidden />
              </span>
              <span>
                <b>Assistant</b>
                <small>Demo · answers from this page’s data</small>
              </span>
              <button className="dt-icon-btn" onClick={() => setOpen(false)} aria-label="Close the assistant">
                <X size={18} />
              </button>
            </div>
            <div className="dt-chat-list" ref={listRef} aria-live="polite">
              {msgs.length === 0 && (
                <div className="dt-msg bot">
                  <p>Hi! Ask me anything about {ctx.scopeName} in a few words. I’ll answer briefly and take you to the right tab.</p>
                </div>
              )}
              {msgs.map((m) => (
                <motion.div key={m.id} className={`dt-msg ${m.from}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  {m.text.split('\n').map((line, i) => (
                    <p key={i}>{rich(line)}</p>
                  ))}
                  {m.go && m.go.length > 0 && (
                    <span className="dt-msg-go">
                      {m.go.map((g) => (
                        <button
                          key={g.label}
                          className="btn-ghost"
                          onClick={() => {
                            onTab(g.tab)
                            setOpen(false)
                          }}
                        >
                          {g.label} <ArrowRight size={13} aria-hidden />
                        </button>
                      ))}
                    </span>
                  )}
                </motion.div>
              ))}
              {typing && (
                <div className="dt-msg bot dt-typing" aria-label="Typing">
                  <i />
                  <i />
                  <i />
                </div>
              )}
            </div>
            <div className="dt-chat-chips">
              {SUGGESTIONS.map((sug) => (
                <button key={sug} onClick={() => ask(sug)} disabled={typing}>
                  {sug}
                </button>
              ))}
            </div>
            <form
              className="dt-chat-input"
              onSubmit={(e) => {
                e.preventDefault()
                ask(text)
              }}
            >
              <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about sales, ranking, reviews…" aria-label="Your question" />
              <button type="submit" className="dt-icon-btn send" disabled={!text.trim() || typing} aria-label="Send">
                <PaperPlaneRight size={18} weight="fill" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <button className={`dt-fab ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close the assistant' : 'Open the assistant'} aria-expanded={open}>
        <Sparkle size={20} weight="fill" aria-hidden />
        <span>Ask</span>
      </button>
    </>
  )
}
