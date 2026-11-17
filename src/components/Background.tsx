import { useEffect, useRef } from 'react'

interface Props {
  /** 0 = calm, 1 = warp (a short swell during screen changes) */
  intensity?: number
}

/**
 * Hub backdrop made for the glass cards: slow-drifting colour orbs (Caisse reds and one cool
 * neutral) under a faint dot grid, plus a soft light that follows the cursor. The cards' backdrop
 * blur turns the orbs into moving colour behind the glass. Pure CSS animation; the only script is a
 * rAF-throttled pointer position.
 */
export function Background({ intensity = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current!
    let raf = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--px', `${e.clientX}px`)
        el.style.setProperty('--py', `${e.clientY}px`)
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div ref={ref} className={`bg ${intensity > 0 ? 'is-warp' : ''}`} aria-hidden>
      <div className="bg-orbs">
        <i className="orb orb-1" />
        <i className="orb orb-2" />
        <i className="orb orb-3" />
        <i className="orb orb-4" />
      </div>
      <div className="bg-dots" />
      <div className="bg-light" />
      <div className="bg-shade" />
    </div>
  )
}
