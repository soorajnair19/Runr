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
  errorKind: GpsErrorKind | null
  errorMessage: string | null
  accuracyWarning: boolean
  waitingForGps: boolean
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
