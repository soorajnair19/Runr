interface ReadyScreenProps {
  onStart: () => void
}

export function ReadyScreen({ onStart }: ReadyScreenProps) {
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
        <p className="privacy-note">
          Your run stays on your device. We don&apos;t upload or store your GPS
          route.
        </p>
      </div>
    </section>
  )
}
