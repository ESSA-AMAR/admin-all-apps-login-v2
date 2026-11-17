import { ArrowLeft, Broadcast, CheckCircle, LockSimpleOpen, UserSwitch } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AppGlyph } from '../components/appIcons'
import { Avatar, BrandMark, DecodeText, ease } from '../components/ui'
import type { AppDef } from '../data/apps'
import type { Session } from '../data/types'
import { targetName } from './TargetPicker'

interface Props {
  app: AppDef
  target: string
  session: Session
  /** Where the launched icon flies from (the card that was clicked). */
  origin: DOMRect | null
  /** Hub users get "All apps"; single-app staff only get "Switch user". */
  onBack?: () => void
  onSignOut: () => void
}

export const DOMAIN = 'app.caissemanager.com'

/** Launch sequence, then the shell the real app is handed over to. */
export function AppFrame({ app, target, session, origin, onBack, onSignOut }: Props) {
  const [phase, setPhase] = useState<'boot' | 'run'>('boot')
  const [step, setStep] = useState(0)
  const name = targetName(target, session.holdings)
  const holding = session.holdings.find((h) => h.id === target || h.brands.some((b) => b.id === target) || h.stores.some((s) => s.id === target))
  const steps = [
    `Subscription verified · ${holding?.code ?? ''}`,
    `Role ${session.role.label} · access granted`,
    app.kind === 'device' ? 'Opening device pairing' : 'Single sign-on token issued',
  ]

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 450),
      setTimeout(() => setStep(2), 850),
      setTimeout(() => setStep(3), 1250),
      setTimeout(() => setPhase('run'), 1900),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // Icon flies from the clicked card to the centre of the screen.
  const from = origin
    ? { x: origin.left + origin.width / 2 - window.innerWidth / 2, y: origin.top + origin.height / 2 - window.innerHeight / 2 + 40, scale: 0.45 }
    : { x: 0, y: 30, scale: 0.6 }

  return (
    <div className="appframe">
      <AnimatePresence mode="wait">
        {phase === 'boot' ? (
          <motion.div key="boot" className="boot" exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.45 }}>
            <div className="boot-stage">
              <span className="boot-ring r1" />
              <span className="boot-ring r2" />
              <span className="boot-ring r3" />
              <motion.span
                className="boot-icon"
                initial={{ ...from, opacity: 0.4 }}
                animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                <AppGlyph id={app.id} size={64} />
              </motion.span>
            </div>
            <motion.div className="boot-copy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
              <small className="label red">
                <DecodeText text={`OPENING ${app.name.toUpperCase()}`} speed={16} />
              </small>
              <h1>{name}</h1>
              <ul className="boot-steps">
                {steps.map((s, i) => (
                  <li key={s} className={step > i ? 'done' : step === i ? 'doing' : ''}>
                    <span className="seq-mark" />
                    {s}
                  </li>
                ))}
              </ul>
              <div className="progress">
                <motion.i initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="run" className="shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <header className="shell-bar">
              <BrandMark size={26} />
              <span className="shell-app">
                <AppGlyph id={app.id} size={20} weight="bold" />
                <b>{app.name}</b>
              </span>
              <span className="shell-target">{name}</span>
              <span className="shell-url label">
                <LockSimpleOpen size={12} weight="bold" /> {DOMAIN}
                {app.path}/{target}
              </span>
              <span className="shell-spacer" />
              <span className="shell-user">
                <Avatar user={session.user} />
                <span>
                  <b>{session.user.name}</b>
                  <small className="dim">{session.role.label}</small>
                </span>
              </span>
              {onBack && (
                <button className="btn-ghost" onClick={onBack}>
                  <ArrowLeft size={16} weight="bold" /> All apps
                </button>
              )}
              <button className="btn-ghost" onClick={onSignOut}>
                <UserSwitch size={16} weight="bold" /> {session.role.pin ? 'Switch user' : 'Sign out'}
              </button>
            </header>
            {app.kind === 'device' ? (
              <Pairing app={app} name={name} />
            ) : app.url ? (
              <AppEmbed app={app} session={session} onLock={onSignOut} />
            ) : (
              <Handoff app={app} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The real app. People who also have a POS profile open straight on their own account (`?staff=`);
 * locking the POS ("Lock & switch user") signs them out of the hub too.
 */
function AppEmbed({ app, session, onLock }: { app: AppDef; session: Session; onLock: () => void }) {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'cm-pos:lock') onLock()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onLock])
  const src = session.user.posId ? `${app.url}?staff=${session.user.posId}` : app.url
  return <iframe className="app-embed" src={src} title={app.name} allow="fullscreen; payment; camera; microphone" />
}

/** Placeholder for the real app: the shell keeps the session, the app renders inside. */
function Handoff({ app }: { app: AppDef }) {
  const cols = app.category === 'sales' ? 'sales' : app.category === 'kitchen' ? 'kitchen' : 'office'
  return (
    <div className={`handoff ${cols}`}>
      <div className="skeleton">
        {Array.from({ length: cols === 'kitchen' ? 8 : 12 }, (_, i) => (
          <motion.i key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }} />
        ))}
      </div>
      {cols === 'sales' && (
        <div className="skeleton-side">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
          <b />
        </div>
      )}
      <motion.div className="panel handoff-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease }}>
        <span className="app-icon">
          <AppGlyph id={app.id} size={30} />
        </span>
        <h2>{app.name} loads here</h2>
        <p className="dim">
          The hub already holds the session, so the app opens without a second login. Plug the real {app.name} build into this frame at{' '}
          <code>{app.path}</code>.
        </p>
      </motion.div>
    </div>
  )
}

/**
 * Unattended screens (kiosk, menu board, customer display…) run all day with nobody signed in.
 * Instead of a password, each one is linked to a store once: the screen shows a code, a manager types it here.
 */
const DEMO_CODE = 'K7Q-4F2'

function Pairing({ app, name }: { app: AppDef; name: string }) {
  const [code, setCode] = useState('')
  const [paired, setPaired] = useState(false)
  const typed = code.replace(/\W/g, '')
  const ready = typed.length === 6

  return (
    <div className="pairing">
      <motion.p className="pair-intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <b>{app.name} runs on its own screen in the store</b>, all day, with nobody signed in. You link that screen to <b>{name}</b> once. After that it
        starts {app.name} by itself, even after a power cut, and never asks for a password.
      </motion.p>

      <div className="pair-flow">
        {/* Left: what the person standing at the device sees */}
        <motion.div className="pair-col" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }}>
          <small className="label dim">
            <span className="pair-num">1</span> On the {app.name} screen in the store
          </small>
          <div className={`device ${paired ? 'paired' : ''}`}>
            <div className="device-screen">
              <AnimatePresence mode="wait">
                {paired ? (
                  <motion.div key="live" className="device-live" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <AppGlyph id={app.id} size={40} />
                    <b>{app.name}</b>
                    <small>{name}</small>
                    <span className="status online">running</span>
                  </motion.div>
                ) : (
                  <motion.div key="code" className="device-code" exit={{ opacity: 0, scale: 0.95 }}>
                    <BrandMark size={26} />
                    <small>Open {DOMAIN}/pair — this screen shows:</small>
                    <b>{DEMO_CODE}</b>
                    <small className="device-wait">
                      <span className="spinner" /> Waiting to be linked…
                    </small>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="device-stand" />
          </div>
        </motion.div>

        <div className="pair-arrow" aria-hidden>
          <motion.span animate={{ x: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
            →
          </motion.span>
        </div>

        {/* Right: what the manager does here */}
        <motion.div className="pair-col" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1, ease }}>
          <small className="label dim">
            <span className="pair-num">2</span> Here, you type that code
          </small>
          <div className="panel pair-card">
            <span className="corner tl" />
            <span className="corner br" />
            <AnimatePresence mode="wait">
              {paired ? (
                <motion.div key="ok" className="pair-ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <CheckCircle size={56} weight="duotone" />
                  <h2>Screen linked</h2>
                  <p className="dim">
                    <span className="pair-num">3</span> That screen now runs {app.name} for {name}. To move it to another store, unlink it from the store settings.
                  </p>
                  <button className="btn-secondary" onClick={() => (setPaired(false), setCode(''))}>
                    Link another screen
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" className="pair-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="pair-beacon">
                    <Broadcast size={26} weight="duotone" />
                  </span>
                  <h2>Link a screen to {name}</h2>
                  <input
                    className="pair-input"
                    value={code}
                    maxLength={7}
                    placeholder="___-___"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    aria-label="Code shown on the screen"
                  />
                  <button className="btn-primary" disabled={!ready} onClick={() => setPaired(true)}>
                    Link screen
                  </button>
                  <button className="pair-demo label" onClick={() => setCode(DEMO_CODE)}>
                    Demo: fill in {DEMO_CODE}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
