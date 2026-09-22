import { isDesktopLaptop } from '../lib/desktop'

interface ReadyScreenProps {
  onStart: () => void
  onSimulateWalk?: () => void
}

export function ReadyScreen({ onStart, onSimulateWalk }: ReadyScreenProps) {
  const showSim = isDesktopLaptop()

  return (
    <section className="screen ready-screen">
      <div className="ready-hero">
        <h1 className="brand">Runr</h1>
        <p className="ready-tagline">
          Track your run with GPS.
          <br />
          No account. No tracking. Just run.
        </p>
      </div>

      <div className="ready-actions">
        <button
          type="button"
          className="btn btn-primary btn-xl"
          onClick={onStart}
          aria-label="Start run"
        >
          START RUN
        </button>

        {showSim && onSimulateWalk && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onSimulateWalk}
            aria-label="Simulate a walk on this laptop"
          >
            SIMULATE WALK (LAPTOP)
          </button>
        )}

        <p className="privacy-note">
          Your run stays on your device. We don&apos;t upload or store your GPS
          route.
          {showSim && onSimulateWalk
            ? ' Simulate Walk is a laptop-only preview — it does not use real GPS.'
            : null}
        </p>
      </div>
    </section>
  )
}
