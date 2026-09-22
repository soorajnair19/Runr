import type { GpsPoint } from '../types/run'
import {
  formatDistanceNumber,
  formatDuration,
  formatPace,
} from '../lib/format'
import { MapViewLazy as MapView } from '../components/MapViewLazy'

interface LiveRunScreenProps {
  status: 'STARTING' | 'RUNNING' | 'PAUSED'
  distanceMeters: number
  elapsedMs: number
  pace: number | null
  points: GpsPoint[]
  waitingForGps: boolean
  accuracyWarning: boolean
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}

export function LiveRunScreen({
  status,
  distanceMeters,
  elapsedMs,
  pace,
  points,
  waitingForGps,
  accuracyWarning,
  onPause,
  onResume,
  onFinish,
}: LiveRunScreenProps) {
  const paused = status === 'PAUSED'
  const starting = status === 'STARTING'

  return (
    <section className={`screen live-screen ${paused ? 'is-paused' : ''}`}>
      <header className="live-header">
        <p className="live-status" aria-live="polite">
          {paused ? 'PAUSED' : starting ? 'WAITING FOR GPS…' : 'LIVE RUN'}
        </p>
      </header>

      <div className="live-metrics">
        <div className="metric metric-distance">
          <span className="metric-value">{formatDistanceNumber(distanceMeters)}</span>
          <span className="metric-unit">KM</span>
        </div>
        <div className="metric metric-pace">
          <span className="metric-value metric-value-md">{formatPace(pace)}</span>
        </div>
        <div className="metric metric-duration">
          <span className="metric-value metric-value-sm">{formatDuration(elapsedMs)}</span>
        </div>
      </div>

      {(waitingForGps || accuracyWarning) && (
        <p className="live-hint" role="status">
          {waitingForGps
            ? 'Waiting for GPS…'
            : 'GPS accuracy is currently low.'}
        </p>
      )}

      <div className="live-map-wrap">
        <MapView points={points} follow={!paused} className="live-map" />
      </div>

      <div className="live-controls">
        {paused ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onResume}
            aria-label="Resume run"
          >
            RESUME
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onPause}
            disabled={starting}
            aria-label="Pause run"
          >
            PAUSE
          </button>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={onFinish}
          disabled={starting}
          aria-label="Finish run"
        >
          FINISH
        </button>
      </div>
    </section>
  )
}
