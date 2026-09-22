import type { GpsPoint } from '../types/run'

interface RouteSvgProps {
  points: GpsPoint[]
  width?: number
  height?: number
  className?: string
}

/** Pure-SVG route for reliable image export (no map tiles/canvas). */
export function RouteSvg({
  points,
  width = 900,
  height = 520,
  className,
}: RouteSvgProps) {
  if (points.length === 0) {
    return (
      <svg
        className={className}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Empty route"
      >
        <rect width={width} height={height} fill="#eef3ec" />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fill="#4a5c50"
          fontFamily="Figtree, sans-serif"
          fontSize="28"
        >
          No route data
        </text>
      </svg>
    )
  }

  const lats = points.map((p) => p.latitude)
  const lngs = points.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const pad = 48
  const spanLat = Math.max(maxLat - minLat, 0.0008)
  const spanLng = Math.max(maxLng - minLng, 0.0008)

  // Keep geographic aspect roughly correct
  const midLat = (minLat + maxLat) / 2
  const lngScale = Math.cos((midLat * Math.PI) / 180)
  const geoW = spanLng * lngScale
  const geoH = spanLat
  const drawW = width - pad * 2
  const drawH = height - pad * 2
  const scale = Math.min(drawW / geoW, drawH / geoH)

  const project = (lat: number, lng: number) => {
    const x = pad + (lng - minLng) * lngScale * scale + (drawW - geoW * scale) / 2
    const y =
      pad + (maxLat - lat) * scale + (drawH - geoH * scale) / 2
    return { x, y }
  }

  const projected = points.map((p) => project(p.latitude, p.longitude))
  const d = projected
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const end = projected[projected.length - 1]
  const start = projected[0]

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Run route"
    >
      <defs>
        <linearGradient id="routeBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7fbf5" />
          <stop offset="100%" stopColor="#e2ecdf" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#routeBg)" />
      {points.length >= 2 && (
        <path
          d={d}
          fill="none"
          stroke="#1B7A4E"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={start.x} cy={start.y} r="10" fill="#4a5c50" />
      <circle cx={end.x} cy={end.y} r="14" fill="#1B7A4E" />
      <circle cx={end.x} cy={end.y} r="6" fill="#ffffff" />
    </svg>
  )
}
