import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GPS_CONFIG,
  averagePaceSecPerKm,
  filterGpsPoint,
  geolocationErrorKind,
  geolocationErrorMessage,
  positionToGpsPoint,
} from '../lib/gps'
import type {
  GpsErrorKind,
  GpsPoint,
  RunSession,
  RunStatus,
  RunSummary,
} from '../types/run'

const initialSession = (): RunSession => ({
  status: 'READY',
  startTime: null,
  endTime: null,
  elapsedMs: 0,
  distanceMeters: 0,
  gpsPoints: [],
  liveFix: null,
  errorKind: null,
  errorMessage: null,
  accuracyWarning: false,
  waitingForGps: false,
})

export function useRunTracker() {
  const [session, setSession] = useState<RunSession>(initialSession)
  const [tick, setTick] = useState(0)

  const watchIdRef = useRef<number | null>(null)
  const statusRef = useRef<RunStatus>('READY')
  const segmentBreakRef = useRef(false)
  const lastAcceptedRef = useRef<GpsPoint | null>(null)
  const accumulatedMsRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const distanceRef = useRef(0)
  const pointsRef = useRef<GpsPoint[]>([])
  const startTimeRef = useRef<number | null>(null)

  const syncStatus = useCallback((status: RunStatus) => {
    statusRef.current = status
  }, [])

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const getActiveElapsedMs = useCallback(() => {
    let total = accumulatedMsRef.current
    if (segmentStartedAtRef.current !== null) {
      total += Date.now() - segmentStartedAtRef.current
    }
    return total
  }, [])

  const pushSession = useCallback(
    (patch: Partial<RunSession> & { status?: RunStatus }) => {
      if (patch.status) syncStatus(patch.status)
      setSession((prev) => ({
        ...prev,
        ...patch,
        elapsedMs: getActiveElapsedMs(),
        distanceMeters: distanceRef.current,
        gpsPoints: [...pointsRef.current],
      }))
    },
    [getActiveElapsedMs, syncStatus],
  )

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const status = statusRef.current
      if (status !== 'RUNNING' && status !== 'STARTING') return

      const point = positionToGpsPoint(position)
      const poorAccuracy = point.accuracy > GPS_CONFIG.maxAccuracyMeters

      // Update live marker for any accurate fix, even if route rejects it as jitter.
      const liveFixPatch = poorAccuracy ? {} : { liveFix: point }

      const result = filterGpsPoint(lastAcceptedRef.current, point, {
        segmentBreak: segmentBreakRef.current,
      })

      if (!result.accept) {
        pushSession({
          ...liveFixPatch,
          waitingForGps: status === 'STARTING',
          accuracyWarning: poorAccuracy || result.reason === 'accuracy',
        })
        return
      }

      if (segmentBreakRef.current) {
        segmentBreakRef.current = false
      }

      lastAcceptedRef.current = point
      pointsRef.current = [...pointsRef.current, point]
      distanceRef.current += result.distanceDelta

      if (status === 'STARTING') {
        // First valid fix — begin active timer
        if (segmentStartedAtRef.current === null) {
          segmentStartedAtRef.current = Date.now()
        }
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now()
        }
        pushSession({
          ...liveFixPatch,
          status: 'RUNNING',
          startTime: startTimeRef.current,
          waitingForGps: false,
          accuracyWarning: poorAccuracy,
          errorKind: null,
          errorMessage: null,
        })
        return
      }

      pushSession({
        ...liveFixPatch,
        waitingForGps: false,
        accuracyWarning: poorAccuracy,
      })
    },
    [pushSession],
  )

  const handleError = useCallback(
    (error: GeolocationPositionError) => {
      const status = statusRef.current
      // Timeouts while already running: keep going, show waiting hint
      if (error.code === error.TIMEOUT && (status === 'RUNNING' || status === 'PAUSED')) {
        pushSession({ waitingForGps: true })
        return
      }

      const kind = geolocationErrorKind(error)
      clearWatch()
      if (segmentStartedAtRef.current !== null) {
        accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current
        segmentStartedAtRef.current = null
      }
      pushSession({
        status: 'GPS_ERROR',
        errorKind: kind,
        errorMessage: geolocationErrorMessage(kind),
        waitingForGps: false,
      })
    },
    [clearWatch, pushSession],
  )

  const startWatch = useCallback(() => {
    clearWatch()
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
        maximumAge: GPS_CONFIG.maximumAge,
        timeout: GPS_CONFIG.timeout,
      },
    )
  }, [clearWatch, handleError, handlePosition])

  const startRun = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const kind: GpsErrorKind = 'unsupported'
      pushSession({
        status: 'GPS_ERROR',
        errorKind: kind,
        errorMessage: geolocationErrorMessage(kind),
      })
      return
    }

    // Reset run state
    accumulatedMsRef.current = 0
    segmentStartedAtRef.current = null
    distanceRef.current = 0
    pointsRef.current = []
    lastAcceptedRef.current = null
    segmentBreakRef.current = false
    startTimeRef.current = null

    pushSession({
      status: 'STARTING',
      startTime: null,
      endTime: null,
      elapsedMs: 0,
      distanceMeters: 0,
      gpsPoints: [],
      liveFix: null,
      errorKind: null,
      errorMessage: null,
      accuracyWarning: false,
      waitingForGps: true,
    })

    startWatch()
  }, [pushSession, startWatch])

  const pauseRun = useCallback(() => {
    if (statusRef.current !== 'RUNNING') return
    clearWatch()
    if (segmentStartedAtRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current
      segmentStartedAtRef.current = null
    }
    pushSession({ status: 'PAUSED', waitingForGps: false })
  }, [clearWatch, pushSession])

  const resumeRun = useCallback(() => {
    if (statusRef.current !== 'PAUSED') return
    segmentBreakRef.current = true
    segmentStartedAtRef.current = Date.now()
    pushSession({ status: 'RUNNING', waitingForGps: true })
    startWatch()
  }, [pushSession, startWatch])

  const finishRun = useCallback((): RunSummary | null => {
    const status = statusRef.current
    if (status !== 'RUNNING' && status !== 'PAUSED') return null

    clearWatch()
    if (segmentStartedAtRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current
      segmentStartedAtRef.current = null
    }

    const endTime = Date.now()
    const startTime = startTimeRef.current ?? endTime
    const elapsedMs = accumulatedMsRef.current
    const distanceMeters = distanceRef.current
    const tooShort = distanceMeters < GPS_CONFIG.minMeaningfulDistanceMeters

    pushSession({
      status: 'COMPLETED',
      endTime,
      startTime,
      waitingForGps: false,
      accuracyWarning: false,
    })

    return {
      startTime,
      endTime,
      elapsedMs,
      distanceMeters,
      averagePaceSecPerKm: averagePaceSecPerKm(distanceMeters, elapsedMs),
      gpsPoints: [...pointsRef.current],
      tooShort,
    }
  }, [clearWatch, pushSession])

  const resetRun = useCallback(() => {
    clearWatch()
    accumulatedMsRef.current = 0
    segmentStartedAtRef.current = null
    distanceRef.current = 0
    pointsRef.current = []
    lastAcceptedRef.current = null
    segmentBreakRef.current = false
    startTimeRef.current = null
    syncStatus('READY')
    setSession(initialSession())
  }, [clearWatch, syncStatus])

  // Live timer tick while running
  useEffect(() => {
    if (session.status !== 'RUNNING') return
    const id = window.setInterval(() => {
      setTick((t) => t + 1)
      setSession((prev) => ({
        ...prev,
        elapsedMs: getActiveElapsedMs(),
        distanceMeters: distanceRef.current,
      }))
    }, 250)
    return () => window.clearInterval(id)
  }, [session.status, getActiveElapsedMs])

  // Cleanup watcher on unmount
  useEffect(() => () => clearWatch(), [clearWatch])

  const elapsedMs =
    session.status === 'RUNNING' ? getActiveElapsedMs() : session.elapsedMs

  const pace = averagePaceSecPerKm(session.distanceMeters, elapsedMs)

  // tick used only to force re-render cadence
  void tick

  return {
    session: { ...session, elapsedMs },
    pace,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  }
}
