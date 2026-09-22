import type { GpsPoint } from '../types/run'

/**
 * Balanced GPS filter thresholds — tuned to reduce browser-geolocation
 * overcount (zig-zag jitter) while still accepting normal walk/run motion.
 *
 * Native apps (Nike Run Club, Strava, etc.) combine hardware GPS, sensor
 * fusion, and proprietary smoothing. In the browser we only get
 * `watchPosition`, so we approximate that with:
 * - accuracy gate
 * - minimum time between accepted points
 * - dynamic movement threshold tied to reported accuracy
 * - speed / jump spike rejection
 * - mild accuracy discount on counted distance
 *
 * Re-tune after outdoor A/B runs against a trusted app on the same route.
 */
export const GPS_CONFIG = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
  /** Ignore points worse than this accuracy (meters). */
  maxAccuracyMeters: 40,
  /**
   * Minimum time between accepted route points (ms).
   * Drops rapid jitter bursts that inflate haversine distance.
   */
  minIntervalMs: 900,
  /** Reject segment if implied speed exceeds this (m/s ≈ 32 km/h). */
  maxSpeedMps: 9,
  /**
   * Floor for movement between points (meters).
   * Combined with accuracy in `dynamicMinDistanceMeters`.
   */
  minDistanceMeters: 3,
  /**
   * Fraction of the worse point accuracy used as extra min-distance.
   * Movement smaller than ~accuracy noise is treated as jitter.
   */
  accuracyDistanceFactor: 0.45,
  /** Cap on the accuracy-derived portion of min distance (meters). */
  maxAccuracyDistanceBonus: 18,
  /** Ignore huge jumps even if speed calc is unreliable (meters). */
  maxJumpMeters: 55,
  /**
   * Subtract a fraction of combined accuracy from counted distance
   * so noisy segments don't fully inflate totals (0–1).
   */
  distanceAccuracyDiscount: 0.2,
  /** Minimum distance before showing pace (meters). */
  minPaceDistanceMeters: 20,
  /** Distance below this is considered "too short" for a meaningful summary. */
  minMeaningfulDistanceMeters: 10,
} as const

const EARTH_RADIUS_M = 6_371_000

/** Haversine distance between two WGS84 coordinates, in meters. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** Minimum movement required given current/previous accuracy. */
export function dynamicMinDistanceMeters(
  previousAccuracy: number,
  nextAccuracy: number,
): number {
  const worseAccuracy = Math.max(previousAccuracy, nextAccuracy)
  const accuracyBonus = Math.min(
    worseAccuracy * GPS_CONFIG.accuracyDistanceFactor,
    GPS_CONFIG.maxAccuracyDistanceBonus,
  )
  return Math.max(GPS_CONFIG.minDistanceMeters, accuracyBonus)
}

/** Discount noisy haversine segments so distance tracks closer to native apps. */
export function discountedDistanceMeters(
  rawDistance: number,
  previousAccuracy: number,
  nextAccuracy: number,
): number {
  const noise =
    ((previousAccuracy + nextAccuracy) / 2) * GPS_CONFIG.distanceAccuracyDiscount
  return Math.max(0, rawDistance - noise)
}

export function positionToGpsPoint(position: GeolocationPosition): GpsPoint {
  const { coords, timestamp } = position
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp,
    accuracy: coords.accuracy,
    altitude: coords.altitude,
    speed: coords.speed,
    heading: coords.heading,
  }
}

export type FilterResult =
  | { accept: true; distanceDelta: number }
  | {
      accept: false
      reason: 'accuracy' | 'interval' | 'jitter' | 'speed' | 'jump'
    }

/**
 * Decide whether a new GPS point should contribute to the run route/distance.
 * When `segmentBreak` is true (e.g. after pause), accept the point as a new
 * route anchor without adding pause-gap distance.
 */
export function filterGpsPoint(
  previous: GpsPoint | null,
  next: GpsPoint,
  options: { segmentBreak?: boolean } = {},
): FilterResult {
  if (next.accuracy > GPS_CONFIG.maxAccuracyMeters) {
    return { accept: false, reason: 'accuracy' }
  }

  if (!previous || options.segmentBreak) {
    return { accept: true, distanceDelta: 0 }
  }

  const dtMs = next.timestamp - previous.timestamp
  if (dtMs < GPS_CONFIG.minIntervalMs) {
    return { accept: false, reason: 'interval' }
  }

  const distance = haversineMeters(
    previous.latitude,
    previous.longitude,
    next.latitude,
    next.longitude,
  )

  const minMove = dynamicMinDistanceMeters(previous.accuracy, next.accuracy)
  if (distance < minMove) {
    return { accept: false, reason: 'jitter' }
  }

  const dtSec = Math.max(dtMs / 1000, 0.001)
  const speed = distance / dtSec

  // Prefer reported device speed when available for spike detection.
  const reportedSpeed =
    typeof next.speed === 'number' && Number.isFinite(next.speed) && next.speed >= 0
      ? next.speed
      : null
  const effectiveSpeed = reportedSpeed !== null ? Math.max(speed, reportedSpeed) : speed

  if (distance > GPS_CONFIG.maxJumpMeters && effectiveSpeed > GPS_CONFIG.maxSpeedMps) {
    return { accept: false, reason: 'jump' }
  }

  if (effectiveSpeed > GPS_CONFIG.maxSpeedMps) {
    return { accept: false, reason: 'speed' }
  }

  // Zig-zag check: if device reports near-zero speed but haversine says we moved
  // a lot, treat as GPS scatter (common indoors/near buildings).
  if (
    reportedSpeed !== null &&
    reportedSpeed < 0.4 &&
    distance > Math.max(minMove * 2, 8) &&
    speed > 2.5
  ) {
    return { accept: false, reason: 'jitter' }
  }

  return {
    accept: true,
    distanceDelta: discountedDistanceMeters(
      distance,
      previous.accuracy,
      next.accuracy,
    ),
  }
}

export function averagePaceSecPerKm(
  distanceMeters: number,
  elapsedMs: number,
): number | null {
  if (distanceMeters < GPS_CONFIG.minPaceDistanceMeters) return null
  const km = distanceMeters / 1000
  if (km <= 0) return null
  return elapsedMs / 1000 / km
}

export function geolocationErrorKind(
  error: GeolocationPositionError,
): 'permission_denied' | 'unavailable' | 'timeout' | 'unknown' {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'permission_denied'
    case error.POSITION_UNAVAILABLE:
      return 'unavailable'
    case error.TIMEOUT:
      return 'timeout'
    default:
      return 'unknown'
  }
}

export function geolocationErrorMessage(
  kind: 'unsupported' | 'permission_denied' | 'unavailable' | 'timeout' | 'unknown',
): string {
  switch (kind) {
    case 'unsupported':
      return "Your browser doesn't support GPS tracking. Please use a modern mobile browser."
    case 'permission_denied':
      return 'Location access is required to track your run. Please enable location access in your browser settings and try again.'
    case 'unavailable':
      return "We couldn't get a reliable GPS signal. Try moving outdoors and try again."
    case 'timeout':
      return "We couldn't get a reliable GPS signal. Try moving outdoors and try again."
    default:
      return 'Something went wrong with GPS. Please try again.'
  }
}
