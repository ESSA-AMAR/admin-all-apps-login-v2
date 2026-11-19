import { ArrowRight, ChartLineUp, Eye, EyeSlash, IdentificationBadge, ShieldCheck, Storefront, UserSwitch, WarningCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { LoginBackdrop } from '../components/LoginBackdrop'
import { SuccessMark } from '../components/SuccessMark'
import { ROLES } from '../data/apps'
import { USERS } from '../data/mock'
import type { Session } from '../data/types'
import { AuthError, login, loginWithPin } from '../services/api'

/**
 * Sign-in: one calm glass panel over soft-focus restaurant photography. Email and password, or a
 * staff badge (an NFC reader in keyboard mode types the card number and presses Enter).
 */

/** The demo badge: an admin card with a 10-digit number, as an NFC reader types it. */
const DEMO_BADGE = USERS.find((u) => u.role === 'super_admin' && u.pin)?.pin
/** One demo account per role, in the order the roles are defined (most access first). */
const DEMO_ROLES = Object.keys(ROLES)
  .map((r) => USERS.find((u) => u.role === r && u.password))
  .filter((u): u is (typeof USERS)[number] => !!u)
const POP = { type: 'spring', stiffness: 380, damping: 32 } as const
const RISE = [0.2, 0.8, 0.2, 1] as const
/** Headline words rise out of a blur. */
const WORD = { initial: { opacity: 0, y: '0.35em', filter: 'blur(10px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' } }
const CLIENTS = ['panda', 'crusty', 'franks-burger', 'texas-chicken', 'hy-sushi', 'the-meat', 'wok-4-you', 'uncle-crespy', 'kleat', 'lartisan']
const FEATURES = [
  { Icon: Storefront, title: 'Every store, one place', text: 'POS, kitchen, kiosk and back office for all your brands.' },
  { Icon: ChartLineUp, title: 'Live, consolidated numbers', text: 'From a single till up to the whole group, in real time.' },
  { Icon: ShieldCheck, title: 'One secure sign-in', text: 'Your role decides what you see. Apps open without a second login.' },
]

/* Tiny UI sounds. */
let ac: AudioContext | undefined
function tone(f: number, d = 0.06, type: OscillatorType = 'sine', v = 0.04, when = 0) {
  try {
    ac ??= new AudioContext()
    const t = ac.currentTime + when
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g)
    g.connect(ac.destination)
    o.start(t)
    o.stop(t + d + 0.03)
  } catch {
    // no audio: stay silent
  }
}
const sfx = {
  tap: () => tone(1500, 0.025, 'sine', 0.02),
  err: () => (tone(190, 0.13, 'square', 0.025), tone(150, 0.16, 'square', 0.025, 0.12)),
  ok: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, i * 0.085)),
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Login({ onAuthenticated }: { onAuthenticated: (s: Session) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'bad'>('idle')
  const [error, setError] = useState('')
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('cm-remember-email') ?? ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [welcome, setWelcome] = useState('')
  const [badge, setBadge] = useState(false)
  const [picker, setPicker] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [caps, setCaps] = useState(false)
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem('cm-remember-email')
    } catch {
      return false
    }
  })
  const [pulse, setPulse] = useState(0)
  const [forgot, setForgot] = useState(false)
  const reader = useRef({ digits: '', at: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const kick = () => setPulse((p) => p + 1)

  /** Shared ending: green check, then hand the session to the app. */
  const signIn = async (attempt: () => Promise<Session>, what: 'password' | 'badge') => {
    setState('busy')
    setError('')
    try {
      const [session] = await Promise.all([attempt(), wait(450)])
      setState('ok')
      tone(880, 0.08, 'triangle', 0.04)
      tone(1320, 0.12, 'triangle', 0.04, 0.07)
      await wait(350)
      setWelcome(`Welcome back, ${session.user.name.split(' ')[0]}`)
      setBadge(false)
      sfx.ok()
      await wait(1700)
      onAuthenticated(session)
    } catch (err) {
      sfx.err()
      navigator.vibrate?.([30, 40, 30])
      setError(err instanceof AuthError ? (what === 'badge' ? 'Badge not recognised' : 'Email or password not recognised') : 'Network problem, try again')
      setState('bad')
      await wait(650)
      setState('idle')
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      sfx.err()
      setError('Enter your email and password')
      return
    }
    kick()
    try {
      if (remember) localStorage.setItem('cm-remember-email', email)
      else localStorage.removeItem('cm-remember-email')
    } catch {
      /* storage blocked: just don't remember */
    }
    signIn(() => login(email, password), 'password')
  }

  // An NFC reader in keyboard mode types the badge number and presses Enter, anywhere but a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicker(false)
        setBadge(false)
        return
      }
      if (e.target instanceof HTMLInputElement || state === 'busy' || state === 'ok') return
      if (/^\d$/.test(e.key)) {
        const r = reader.current
        r.digits = (performance.now() - r.at < 800 ? r.digits : '') + e.key
        r.at = performance.now()
      } else if (e.key === 'Enter' && reader.current.digits.length > 4 && performance.now() - reader.current.at < 800) {
        const badgeNo = reader.current.digits
        reader.current.digits = ''
        signIn(() => loginWithPin(badgeNo), 'badge')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Cursor spotlight.
  const onPointerMove = (e: ReactPointerEvent) => {
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--mx', `${e.clientX}px`)
    el.style.setProperty('--my', `${e.clientY}px`)
  }

  const verified = !!welcome

  return (
    <div ref={rootRef} className={`lo st-${state} ${verified ? 'is-verified' : ''}`} onPointerMove={onPointerMove}>
      <LoginBackdrop mood={state === 'ok' ? 'ok' : 'idle'} pulse={pulse} />
      <div className="lo-spot" aria-hidden />
      <div className="lo-grain" aria-hidden />

      <header className="lo-head">
        <motion.img className="lo-logo" src="/pos/assets/logo.svg" alt="Caisse Manager" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: RISE }} />
        <Clock />
      </header>

      <AnimatePresence mode="wait">
        {!verified ? (
          <motion.main key="form" className="lo-signin" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
            <section className="lo-story">
              <h1 aria-label="Every restaurant. One sign-in.">
                {['Every', 'restaurant.'].map((w, i) => (
                  <motion.span key={w} className="lo-word" aria-hidden {...WORD} transition={{ delay: 0.1 + i * 0.12, duration: 0.8, ease: RISE }}>
                    {w}
                  </motion.span>
                ))}
                <br />
                <motion.em className="lo-word" aria-hidden {...WORD} transition={{ delay: 0.4, duration: 0.9, ease: RISE }}>
                  One sign-in.
                </motion.em>
              </h1>
              <ul className="lo-features">
                {FEATURES.map(({ Icon, title, text }, i) => (
                  <motion.li key={title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 + i * 0.1, duration: 0.6, ease: RISE }}>
                    <span className="lo-feature-icon">
                      <Icon size={20} />
                    </span>
                    <span>
                      <b>{title}</b>
                      <small>{text}</small>
                    </span>
                  </motion.li>
                ))}
              </ul>
              <motion.div className="lo-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
                <small>Trusted by restaurant groups across Europe and Morocco</small>
                <div className="lo-marquee" aria-hidden>
                  <div className="lo-marquee-track">
                    {[...CLIENTS, ...CLIENTS].map((c, i) => (
                      <img key={i} src={`/img/clients/${c}.png`} alt="" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </section>

            <motion.section className="lo-panel lo-signin-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, duration: 0.7, ease: RISE }}>
              <form className={`lo-form ${state === 'bad' ? 'shake' : ''}`} onSubmit={submit} noValidate>
                <div className="lo-form-head">
                  <h2>Sign in</h2>
                  <p className="lo-sub">Welcome back. Use your work account to continue.</p>
                </div>
                {/* Floating labels: the label rests inside the field and glides up on focus or input
                    (placeholder=" " lets CSS tell an empty field from a filled one). */}
                <div className="lo-float">
                  <input
                    id="lo-email"
                    type="email"
                    autoComplete="username"
                    autoFocus={!email}
                    placeholder=" "
                    value={email}
                    aria-invalid={!!error && (!email || !!password) ? true : undefined}
                    onChange={(e) => (setEmail(e.target.value), setError(''))}
                  />
                  <label htmlFor="lo-email">Work email</label>
                </div>
                <div className="lo-float has-action">
                  <input
                    id="lo-password"
                    type={reveal ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus={!!email}
                    placeholder=" "
                    value={password}
                    aria-invalid={!!error && (!password || !!email) ? true : undefined}
                    onChange={(e) => (setPassword(e.target.value), setError(''))}
                    onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                  />
                  <label htmlFor="lo-password">Password</label>
                  <button type="button" className="lo-reveal" aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} onClick={() => setReveal((v) => !v)}>
                    {reveal ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {caps && <em className="lo-caps">Caps Lock is on</em>}
                <div className="lo-row-opts">
                  <label className="lo-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span aria-hidden />
                    Remember my email
                  </label>
                  <button type="button" className="lo-link" aria-expanded={forgot} onClick={() => setForgot((v) => !v)}>
                    Forgot password?
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {forgot && (
                    <motion.p className="lo-note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: RISE }}>
                      Passwords are managed by your company. Ask your administrator to reset it, or sign in with your staff badge.
                    </motion.p>
                  )}
                </AnimatePresence>
                <ErrorLine error={error} />
                <button className="lo-cta wide" type="submit" disabled={state === 'busy' || state === 'ok'}>
                  {state === 'busy' ? <i className="lo-spin" aria-hidden /> : null}
                  <span>{state === 'busy' ? 'Signing in…' : 'Log in'}</span>
                  {state !== 'busy' && <ArrowRight size={18} weight="bold" />}
                </button>
                {DEMO_BADGE && (
                  <>
                    <div className="lo-or">
                      <span>or</span>
                    </div>
                    <button type="button" className="lo-ghost wide" onClick={() => (sfx.tap(), kick(), setBadge(true))}>
                      <IdentificationBadge size={20} /> Sign in with a staff badge
                    </button>
                  </>
                )}
                {DEMO_ROLES.length > 0 && (
                  <button type="button" className="lo-demo" onClick={() => (sfx.tap(), setPicker(true))}>
                    <UserSwitch size={16} /> Try a demo role
                  </button>
                )}
              </form>
            </motion.section>
          </motion.main>
        ) : (
          <motion.main key="verified" className="lo-verified" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: RISE }}>
              <SuccessMark />
            </motion.span>
            <b aria-label={welcome}>
              <Letters text={welcome} />
            </b>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {picker && (
          <motion.div className="lo-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicker(false)}>
            <motion.div
              className="lo-dialog lo-roles"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a demo role"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={POP}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="lo-roles-head">
                <div>
                  <h2>Sign in as…</h2>
                  <p className="lo-sub">Pick a role to fill in its demo account.</p>
                </div>
                <button className="lo-x" onClick={() => setPicker(false)} aria-label="Close">
                  <X size={16} weight="bold" />
                </button>
              </header>
              <ul className="lo-roles-list">
                {DEMO_ROLES.map((u, i) => (
                  <motion.li key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i, duration: 0.3, ease: RISE }}>
                    <button
                      autoFocus={i === 0}
                      onClick={() => {
                        sfx.tap()
                        kick()
                        setEmail(u.email)
                        setPassword(u.password ?? '')
                        setError('')
                        setPicker(false)
                        setTimeout(() => document.querySelector<HTMLButtonElement>('.lo-signin-card .lo-cta')?.focus(), 50)
                      }}
                    >
                      <span className="lo-role-dot" data-scope={ROLES[u.role].commandCenter ? 'hub' : 'app'} />
                      <span className="lo-role-text">
                        <b>{ROLES[u.role].label}</b>
                        <small>{u.name}</small>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {badge && DEMO_BADGE && (
          <motion.div className="lo-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBadge(false)}>
            <motion.div
              className="lo-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Scan your badge"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={POP}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="lo-radar">
                <IdentificationBadge size={52} />
                <i />
                <i />
              </span>
              <h2>Hold your badge to the reader</h2>
              <p className="lo-sub">Staff sign in with their card. The reader types the card number for you.</p>
              <ErrorLine error={error} />
              <button className="lo-cta wide" disabled={state === 'busy' || state === 'ok'} onClick={() => signIn(() => loginWithPin(DEMO_BADGE), 'badge')}>
                <span>{state === 'busy' ? 'Reading badge…' : 'Demo: tap the admin badge'}</span>
              </button>
              <button className="lo-text-btn" onClick={() => setBadge(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Text that assembles letter by letter. */
function Letters({ text }: { text: string }) {
  return (
    <span className="lo-letters">
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, y: '0.25em', filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: i * 0.014, duration: 0.5, ease: RISE }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lo-clock" aria-hidden>
      <b>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b>
      <small>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
    </div>
  )
}

function ErrorLine({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p className="lo-error" role="alert" initial={{ opacity: 0, y: -6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={POP}>
          <WarningCircle size={18} weight="fill" /> {error}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
