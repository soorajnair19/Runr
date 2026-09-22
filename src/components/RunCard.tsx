import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { RunSummary } from '../types/run'
import {
  formatDistanceNumber,
  formatDuration,
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
  const [pngReady, setPngReady] = useState(false)
  const [downloadHint, setDownloadHint] = useState(false)
  const [hintMessage, setHintMessage] = useState(
    'Long press the image below to save it to your photos.',
  )

  const title = runTitleFromStart(summary.startTime)
  const distance = formatDistanceNumber(summary.distanceMeters)
  const duration = formatDuration(summary.elapsedMs)
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

  // Pre-render PNG when the card appears so Download Now is instant.
  useEffect(() => {
    let cancelled = false
    setPngReady(false)
    setPreviewUrl(null)
    setDownloadHint(false)

    async function renderPng() {
      if (!cardRef.current) return
      try {
        // Wait a frame so fonts/layout settle before capture.
        await new Promise((r) => requestAnimationFrame(() => r(undefined)))
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
        if (!cancelled) {
          setPreviewUrl(dataUrl)
          setPngReady(true)
        }
      } catch {
        if (!cancelled) {
          setPngReady(false)
        }
      }
    }

    void renderPng()
    return () => {
      cancelled = true
    }
  }, [summary])

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    setDownloadHint(false)

    try {
      let dataUrl = previewUrl
      if (!dataUrl && cardRef.current) {
        dataUrl = await toPng(cardRef.current, {
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
        setPngReady(true)
      }
      if (!dataUrl) throw new Error('Could not render card')

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `runr-${Date.now()}.png`, {
        type: 'image/png',
      })

      const canShareFile =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: 'Runr run card',
          })
          return
        } catch (err) {
          // User cancelled share — do not fall through to download noise.
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }

      const link = document.createElement('a')
      link.download = file.name
      link.href = dataUrl
      link.click()

      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIos || !canShareFile) {
        setHintMessage('Long press the image below to save it to your photos.')
        setDownloadHint(true)
      }
    } catch {
      setHintMessage('Long press the image below to save it to your photos.')
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
              <span className="run-card-stat-label">DISTANCE</span>
              <span className="run-card-stat-value">
                {distance}
                <span className="run-card-stat-unit">KM</span>
              </span>
            </div>
            <div>
              <span className="run-card-stat-label">TIME</span>
              <span className="run-card-stat-value">{duration}</span>
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
        disabled={downloading || !pngReady}
        aria-label="Download run card"
      >
        {downloading ? 'SAVING…' : !pngReady ? 'PREPARING…' : 'DOWNLOAD NOW'}
      </button>

      {downloadHint && previewUrl && (
        <div className="download-fallback">
          <p>{hintMessage}</p>
          <img src={previewUrl} alt="Your run card" className="download-preview" />
        </div>
      )}
    </div>
  )
}
