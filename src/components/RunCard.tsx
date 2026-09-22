import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { RunSummary } from '../types/run'
import {
  formatDistanceNumber,
  formatDuration,
  formatPaceShort,
  formatRunDate,
  formatRunTime,
  runTitleFromStart,
} from '../lib/format'
import { RouteSvg } from './RouteSvg'

interface RunCardProps {
  summary: RunSummary
}

const CARD_W = 1080
const CARD_H = 1350

export function RunCard({ summary }: RunCardProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  const [downloading, setDownloading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [downloadHint, setDownloadHint] = useState(false)

  const title = runTitleFromStart(summary.startTime)
  const distance = formatDistanceNumber(summary.distanceMeters)
  const duration = formatDuration(summary.elapsedMs)
  const pace = formatPaceShort(summary.averagePaceSecPerKm)
  const date = formatRunDate(summary.startTime)
  const time = formatRunTime(summary.startTime)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const update = () => {
      setScale(stage.clientWidth / CARD_W)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  async function handleDownload() {
    if (!cardRef.current || downloading) return
    setDownloading(true)
    setDownloadHint(false)

    try {
      const dataUrl = await toPng(cardRef.current, {
        width: CARD_W,
        height: CARD_H,
        pixelRatio: 1,
        cacheBust: true,
        style: {
          transform: 'none',
          width: `${CARD_W}px`,
          height: `${CARD_H}px`,
        },
      })

      setPreviewUrl(dataUrl)

      const link = document.createElement('a')
      link.download = `runr-${Date.now()}.png`
      link.href = dataUrl
      link.click()

      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIos) setDownloadHint(true)
    } catch {
      setDownloadHint(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="run-card-export">
      <div ref={stageRef} className="run-card-stage">
        <div
          ref={cardRef}
          className="run-card"
          id="run-card"
          style={{ transform: `scale(${scale})` }}
        >
          <p className="run-card-title">{title}</p>
          <p className="run-card-distance">
            <span className="run-card-distance-num">{distance}</span>
            <span className="run-card-distance-unit">KM</span>
          </p>

          <div className="run-card-map-frame">
            <RouteSvg points={summary.gpsPoints} className="run-card-route" />
          </div>

          <div className="run-card-stats">
            <div>
              <span className="run-card-stat-label">DURATION</span>
              <span className="run-card-stat-value">{duration}</span>
            </div>
            <div>
              <span className="run-card-stat-label">PACE</span>
              <span className="run-card-stat-value">
                {pace}
                <span className="run-card-stat-unit">/KM</span>
              </span>
            </div>
          </div>

          <p className="run-card-meta">
            {date} · {time}
          </p>
          <p className="run-card-brand">RUNR</p>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleDownload}
        disabled={downloading}
        aria-label="Download run card"
      >
        {downloading ? 'GENERATING…' : 'DOWNLOAD RUN CARD'}
      </button>

      {downloadHint && previewUrl && (
        <div className="download-fallback">
          <p>Long press the image below to save it to your photos.</p>
          <img src={previewUrl} alt="Your run card" className="download-preview" />
        </div>
      )}
    </div>
  )
}
