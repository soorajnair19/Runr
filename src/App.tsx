import { useState } from 'react'
import { useRunTracker } from './hooks/useRunTracker'
import type { RunSummary } from './types/run'
import { ReadyScreen } from './screens/ReadyScreen'
import { LiveRunScreen } from './screens/LiveRunScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { ErrorScreen } from './screens/ErrorScreen'

export default function App() {
  const tracker = useRunTracker()
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)

  const { session, pace } = tracker

  function handleFinishRequest() {
    setConfirmFinish(true)
  }

  function handleFinishConfirm() {
    setConfirmFinish(false)
    const result = tracker.finishRun()
    if (result) setSummary(result)
  }

  function handleNewRun() {
    setSummary(null)
    tracker.resetRun()
  }

  return (
    <div className="app-shell">
      {session.status === 'READY' && (
        <ReadyScreen onStart={tracker.startRun} />
      )}

      {(session.status === 'STARTING' ||
        session.status === 'RUNNING' ||
        session.status === 'PAUSED') && (
        <LiveRunScreen
          status={session.status}
          distanceMeters={session.distanceMeters}
          elapsedMs={session.elapsedMs}
          pace={pace}
          points={session.gpsPoints}
          liveFix={session.liveFix}
          waitingForGps={session.waitingForGps}
          accuracyWarning={session.accuracyWarning}
          onPause={tracker.pauseRun}
          onResume={tracker.resumeRun}
          onFinish={handleFinishRequest}
        />
      )}

      {session.status === 'COMPLETED' && summary && (
        <SummaryScreen summary={summary} onNewRun={handleNewRun} />
      )}

      {session.status === 'GPS_ERROR' && (
        <ErrorScreen
          message={
            session.errorMessage ??
            'Something went wrong with GPS. Please try again.'
          }
          onRetry={handleNewRun}
        />
      )}

      {confirmFinish && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
          >
            <h2 id="finish-title">Finish this run?</h2>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmFinish(false)}
                aria-label="Cancel finish"
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleFinishConfirm}
                aria-label="Confirm finish"
              >
                FINISH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
