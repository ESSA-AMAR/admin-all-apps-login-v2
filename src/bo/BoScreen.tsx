import { Check } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BO_INDEX, type BoItem } from '../data/backoffice'
import type { Action } from '../state'
import { ConceptPage } from '../screens/ConceptPage'
import { LockedCard, PageHead, SayCtx } from './kit'
import { screenFor, type Ctx } from './specs'

interface Props {
  /** Id of the sidebar item that was opened. */
  id: string
  ctx: Omit<Ctx, 'go'>
  /** The app's dispatch: the screens open the map, the dashboard or the launchpad through it. */
  dispatch: (a: Action) => void
  onPick: (item: BoItem) => void
  /** The client's plan does not include the group: the screen is shown dimmed and closed, with the reason on top. */
  locked: boolean
}

/**
 * The screen of one Back Office item: header, the real screen for it, and a message line at the bottom that says what a demo action would do.
 * An item with no screen falls back to the concept page.
 */
export function BoScreen({ id, ctx, onPick, dispatch, locked }: Props) {
  const hit = BO_INDEX.get(id)
  const [msg, setMsg] = useState<{ n: number; text: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const say = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMsg((m) => ({ n: (m?.n ?? 0) + 1, text }))
    timer.current = setTimeout(() => setMsg(null), 3600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Built once per item and scope: a message on screen must not rebuild it (that would reset what the person just did in it).
  const { stores, holdings, scopeName } = ctx
  const go = useCallback<Ctx['go']>((mode) => dispatch({ type: 'mode', mode }), [dispatch])
  const screen = useMemo(() => (BO_INDEX.has(id) ? screenFor(id, { stores, holdings, scopeName, go }) : null), [id, stores, holdings, scopeName, go])

  if (!hit) return null
  if (!screen) return <ConceptPage id={id} onPick={onPick} locked={locked} />
  const { item, group, section } = hit

  return (
    <SayCtx.Provider value={say}>
      <div className={`bo-screen${locked ? ' is-locked' : ''}`}>
        <PageHead eyebrow={[section.label, group.label]} title={item.label} desc={screen.desc ?? group.desc} actions={locked ? undefined : screen.actions} />
        <div className="bo-body" inert={locked} aria-hidden={locked || undefined}>
          {screen.body}
        </div>
        {locked && <LockedCard group={group.label} />}
      </div>
      {msg &&
        createPortal(
          <div className="bo-toast" role="status" key={msg.n}>
            <Check size={16} weight="bold" />
            {msg.text}
          </div>,
          document.body,
        )}
    </SayCtx.Provider>
  )
}
