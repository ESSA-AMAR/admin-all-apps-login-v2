interface Props {
  /** Bump to send a soft light sweep across the backdrop (selection, key press). */
  pulse: number
  /** 'focus' dims the backdrop while a PIN or password is being typed; 'ok' warms it on success. */
  mood: 'idle' | 'focus' | 'ok'
}

/**
 * Sign-in backdrop: a light grade over the app's animated colour orbs (src/components/Background.tsx,
 * which stays mounted behind every screen), so sign-in flows into the hub on one continuous
 * background. A soft light sweeps across on each interaction.
 */
export function LoginBackdrop({ pulse, mood }: Props) {
  return (
    <div className={`lb mood-${mood}`} aria-hidden>
      <div className="lb-grade" />
      {pulse > 0 && <span key={pulse} className="lb-sheen" />}
    </div>
  )
}
