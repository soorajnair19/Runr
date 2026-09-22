import type { RunSummary } from '../types/run'
import {
  formatDistanceNumber,
  formatDuration,
  formatPace,
  formatRunDate,
  formatRunTime,
  runTitleFromStart,
} from '../lib/format'
import { MapViewLazy as MapView } from '../components/MapViewLazy'
import { RunCard } from '../components/RunCard'

interface SummaryScreenProps {
  summary: RunSummary
  onNewRun: () => void
}

export function SummaryScreen({ summary, onNewRun }: SummaryScreenProps) {
  if (summary.tooShort) {
    return (
      <section className="screen summary-screen">
        <div className="summary-short">
          <h1 className="brand brand-sm">SimplRun</h1>
          <p className="summary-short-msg">
            Run too short to calculate meaningful stats.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNewRun}
            aria-label="Start a new run"
          >
            START AGAIN
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="screen summary-screen">
      <div className="summary-content">
        <p className="summary-kicker">{runTitleFromStart(summary.startTime)}</p>
        <div className="summary-distance">
          <span className="summary-distance-num">
            {formatDistanceNumber(summary.distanceMeters)}
          </span>
          <span className="summary-distance-unit">KM</span>
        </div>

        <div className="summary-stats">
          <div>
            <span className="summary-stat-label">Duration</span>
            <span className="summary-stat-value">
              {formatDuration(summary.elapsedMs)}
            </span>
          </div>
          <div>
            <span className="summary-stat-label">Pace</span>
            <span className="summary-stat-value">
              {formatPace(summary.averagePaceSecPerKm)}
            </span>
          </div>
        </div>

        <div className="summary-map-wrap">
          <MapView
            points={summary.gpsPoints}
            interactive={false}
            follow={false}
            className="summary-map"
          />
        </div>

        <p className="summary-meta">
          {formatRunDate(summary.startTime)}
          <br />
          {formatRunTime(summary.startTime)}
        </p>

        <RunCard summary={summary} />

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onNewRun}
          aria-label="Start a new run"
        >
          NEW RUN
        </button>
      </div>
    </section>
  )
}
