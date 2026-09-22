import type { GpsPoint } from '../types/run'

/** Configurable GPS filter thresholds — tune after real-world testing. */
export const GPS_CONFIG = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
  /** Ignore points worse than this accuracy (meters). */
  maxAccuracyMeters: 50,
  /** Reject segment if implied speed exceeds this (m/s ≈ 45 km/h). */
  maxSpeedMps: 12.5,
  /** Minimum distance between points to count (filters jitter while standing). */
  minDistanceMeters: 2,
  /** Ignore huge jumps even if speed calc is unreliable (meters). */
  maxJumpMeters: 80,
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
  | { accept: false; reason: 'accuracy' | 'jitter' | 'speed' | 'jump' }

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

  const distance = haversineMeters(
    previous.latitude,
    previous.longitude,
    next.latitude,
    next.longitude,
  )

  if (distance < GPS_CONFIG.minDistanceMeters) {
    return { accept: false, reason: 'jitter' }
  }

  const dtSec = Math.max((next.timestamp - previous.timestamp) / 1000, 0.001)
  const speed = distance / dtSec

  if (distance > GPS_CONFIG.maxJumpMeters && speed > GPS_CONFIG.maxSpeedMps) {
    return { accept: false, reason: 'jump' }
  }

  if (speed > GPS_CONFIG.maxSpeedMps) {
    return { accept: false, reason: 'speed' }
  }

  return { accept: true, distanceDelta: distance }
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
