import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GPS_CONFIG,
  averagePaceSecPerKm,
  filterGpsPoint,
  geolocationErrorKind,
  geolocationErrorMessage,
  haversineMeters,
  positionToGpsPoint,
} from '../lib/gps'
import {
  SIM_TICK_MS,
  createSimulatedPosition,
  simulateWalkPointCount,
} from '../lib/simulateWalk'
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
  trailPoints: [],
  liveFix: null,
  errorKind: null,
  errorMessage: null,
  accuracyWarning: false,
  waitingForGps: false,
  simulated: false,
})

export function useRunTracker() {
  const [session, setSession] = useState<RunSession>(initialSession)
  const [tick, setTick] = useState(0)

  const watchIdRef = useRef<number | null>(null)
  const simTimerRef = useRef<number | null>(null)
  const simIndexRef = useRef(0)
  const simulatedRef = useRef(false)
  const statusRef = useRef<RunStatus>('READY')
  const segmentBreakRef = useRef(false)
  const lastAcceptedRef = useRef<GpsPoint | null>(null)
  const accumulatedMsRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const distanceRef = useRef(0)
  const pointsRef = useRef<GpsPoint[]>([])
  const trailRef = useRef<GpsPoint[]>([])
  const startTimeRef = useRef<number | null>(null)

  const syncStatus = useCallback((status: RunStatus) => {
    statusRef.current = status
  }, [])

  /** Append to the on-map trail when the live fix has moved enough (visual only). */
  const appendTrailPoint = useCallback((point: GpsPoint) => {
    const last = trailRef.current[trailRef.current.length - 1]
    if (!last) {
      trailRef.current = [point]
      return
    }
    const moved = haversineMeters(
      last.latitude,
      last.longitude,
      point.latitude,
      point.longitude,
    )
    // Dense enough to look continuous while walking; independent of distance filter.
    if (moved >= 2) {
      trailRef.current = [...trailRef.current, point]
    } else {
      // Keep tip glued to the latest fix so the line reaches the pulse marker.
      trailRef.current = [...trailRef.current.slice(0, -1), point]
    }
  }, [])

  const clearSimulation = useCallback(() => {
    if (simTimerRef.current !== null) {
      window.clearInterval(simTimerRef.current)
      simTimerRef.current = null
    }
  }, [])

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    clearSimulation()
  }, [clearSimulation])

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
        trailPoints: [...trailRef.current],
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

      // Live marker + visual trail for any accurate fix (even if distance rejects it).
      if (!poorAccuracy) {
        appendTrailPoint(point)
      }
      const liveFixPatch = poorAccuracy
        ? {}
        : { liveFix: point, trailPoints: [...trailRef.current] }

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
    [appendTrailPoint, pushSession],
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

  const startSimulation = useCallback(() => {
    clearWatch()
    const pathLen = simulateWalkPointCount()

    const tickSim = () => {
      if (statusRef.current !== 'RUNNING' && statusRef.current !== 'STARTING') {
        return
      }
      if (simIndexRef.current >= pathLen) {
        clearSimulation()
        return
      }
      const position = createSimulatedPosition(simIndexRef.current)
      simIndexRef.current += 1
      handlePosition(position)
    }

    // Emit first fix immediately so STARTING → RUNNING without waiting a tick.
    tickSim()
    simTimerRef.current = window.setInterval(tickSim, SIM_TICK_MS)
  }, [clearSimulation, clearWatch, handlePosition])

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

  const resetTrackingRefs = useCallback(() => {
    accumulatedMsRef.current = 0
    segmentStartedAtRef.current = null
    distanceRef.current = 0
    pointsRef.current = []
    trailRef.current = []
    lastAcceptedRef.current = null
    segmentBreakRef.current = false
    startTimeRef.current = null
    simIndexRef.current = 0
  }, [])

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

    simulatedRef.current = false
    resetTrackingRefs()

    pushSession({
      status: 'STARTING',
      startTime: null,
      endTime: null,
      elapsedMs: 0,
      distanceMeters: 0,
      gpsPoints: [],
      trailPoints: [],
      liveFix: null,
      errorKind: null,
      errorMessage: null,
      accuracyWarning: false,
      waitingForGps: true,
      simulated: false,
    })

    startWatch()
  }, [pushSession, resetTrackingRefs, startWatch])

  /** Laptop-only: feed a synthetic ~0.45 km loop through the real GPS pipeline. */
  const startSimulatedRun = useCallback(() => {
    simulatedRef.current = true
    resetTrackingRefs()

    pushSession({
      status: 'STARTING',
      startTime: null,
      endTime: null,
      elapsedMs: 0,
      distanceMeters: 0,
      gpsPoints: [],
      trailPoints: [],
      liveFix: null,
      errorKind: null,
      errorMessage: null,
      accuracyWarning: false,
      waitingForGps: true,
      simulated: true,
    })

    startSimulation()
  }, [pushSession, resetTrackingRefs, startSimulation])

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
    if (simulatedRef.current) {
      startSimulation()
    } else {
      startWatch()
    }
  }, [pushSession, startSimulation, startWatch])

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
    simulatedRef.current = false
    resetTrackingRefs()
    syncStatus('READY')
    setSession(initialSession())
  }, [clearWatch, resetTrackingRefs, syncStatus])

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
    startSimulatedRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  }
}
