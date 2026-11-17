import { Lock } from '@phosphor-icons/react'
import { BO_INDEX, type BoBadge, type BoItem } from '../data/backoffice'
import { RedWord } from '../components/ui'

interface Props {
  /** The sidebar item that was opened. */
  id: string
  onPick: (item: BoItem) => void
  /** The client's plan does not include the group (Third parties & ownership, here). */
  locked: boolean
}

const Pill = ({ b }: { b: BoBadge }) => <span className={`bo-pill ${b.kind}`}>{b.value}</span>

/**
 * A Back Office item that has no screen of its own in this app yet: what it is, where it sits, and its neighbours in the group.
 * The sidebar around it is the real thing; this page is where each screen will land.
 */
export function ConceptPage({ id, onPick, locked }: Props) {
  const hit = BO_INDEX.get(id)
  if (!hit) return null
  const { item, group, section } = hit
  const status = locked ? 'Not in your plan' : item.soon ? 'Coming soon' : 'Concept · screen to design'

  return (
    <div className="bo-page">
      <div className="eyebrow">
        <span className="eyebrow-index">{section.label}</span>
        <span className="eyebrow-line" />
        <span>{group.label}</span>
      </div>
      <h1 className="step-title">
        <RedWord text={item.label} />
      </h1>
      <p className="bo-page-desc">{group.desc}</p>

      <div className="bo-page-status">
        {locked && <Lock size={16} />}
        <span>{status}</span>
        <small title={item.fr}>{item.fr}</small>
      </div>

      <h2 className="bo-page-h">In {group.label}</h2>
      <ul className="bo-page-list">
        {group.items.map((i) => (
          <li key={i.id}>
            <button type="button" className={i.id === id ? 'on' : ''} onClick={() => onPick(i)} title={i.fr}>
              <span className="bo-page-name">{i.label}</span>
              <span className="bo-page-meta">
                {i.badge && <Pill b={i.badge} />}
                {i.soon ? <em>soon</em> : i.to ? <em className="live">live</em> : <em>concept</em>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
