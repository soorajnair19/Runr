/** Format meters as kilometers with 2 decimal places. */
export function formatDistanceKm(meters: number): string {
  const km = meters / 1000
  return `${km.toFixed(2)} km`
}

/** Compact distance for large display (number only). */
export function formatDistanceNumber(meters: number): string {
  return (meters / 1000).toFixed(2)
}

/**
 * Format active duration.
 * Under 1 hour: mm:ss
 * 1 hour+: h:mm:ss
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Format pace as m:ss /km, or placeholder when unavailable. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return '--:-- /km'
  }

  const totalSec = Math.round(secPerKm)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

/** Pace without unit suffix for card layouts. */
export function formatPaceShort(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return '--:--'
  }
  const totalSec = Math.round(secPerKm)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Local date like "22 SEPTEMBER 2026". */
export function formatRunDate(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.getDate()
  const month = date
    .toLocaleString('en-US', { month: 'long' })
    .toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

/** Local time like "07:12 AM". */
export function formatRunTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Morning / Afternoon / Evening / Night based on start hour. */
export function runTitleFromStart(timestamp: number): string {
  const hour = new Date(timestamp).getHours()
  if (hour < 5) return 'NIGHT RUN'
  if (hour < 12) return 'MORNING RUN'
  if (hour < 17) return 'AFTERNOON RUN'
  if (hour < 21) return 'EVENING RUN'
  return 'NIGHT RUN'
}
