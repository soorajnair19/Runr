import type { RunSummary } from '../types/run'
import { RunCard } from '../components/RunCard'

interface SummaryScreenProps {
  summary: RunSummary
  onNewRun: () => void
}

export function SummaryScreen({ summary, onNewRun }: SummaryScreenProps) {
  return (
    <section className="screen summary-screen">
      <div className="summary-content">
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
