export type RunStatus =
  | 'READY'
  | 'STARTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'FINISHING'
  | 'COMPLETED'
  | 'GPS_ERROR'

export type GpsErrorKind =
  | 'unsupported'
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown'

export interface GpsPoint {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
  altitude: number | null
  speed: number | null
  heading: number | null
}

export interface RunSession {
  status: RunStatus
  startTime: number | null
  endTime: number | null
  /** Accumulated active milliseconds (excludes pauses) */
  elapsedMs: number
  distanceMeters: number
  gpsPoints: GpsPoint[]
  /**
   * Live map trail (visual only). Includes accurate live fixes even when the
   * distance filter rejects them as jitter — so the path draws while walking.
   */
  trailPoints: GpsPoint[]
  /** Latest accurate GPS fix for the live map marker (may include jitter-rejected points). */
  liveFix: GpsPoint | null
  errorKind: GpsErrorKind | null
  errorMessage: string | null
  accuracyWarning: boolean
  waitingForGps: boolean
  /** True when the run is fed by laptop walk simulation (not real GPS). */
  simulated: boolean
}

export interface RunSummary {
  startTime: number
  endTime: number
  elapsedMs: number
  distanceMeters: number
  averagePaceSecPerKm: number | null
  gpsPoints: GpsPoint[]
  tooShort: boolean
}
