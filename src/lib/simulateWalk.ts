import { haversineMeters } from './gps'

export type SimCoord = { latitude: number; longitude: number }

/** ~0.45 km rectangular loop near Cubbon Park, Bengaluru (arbitrary outdoor area). */
const LOOP_CORNERS: SimCoord[] = (() => {
  const start = { latitude: 12.9758, longitude: 77.5929 }
  const north = offsetMeters(start, 140, 0)
  const northEast = offsetMeters(start, 140, 120)
  const east = offsetMeters(start, 0, 120)
  return [start, north, northEast, east, start]
})()

const STEP_METERS = 6
const DEFAULT_ACCURACY = 8
/** Walking pace (~5 km/h) for reported speed; UI advances faster via tick interval. */
const WALK_SPEED_MPS = 1.4

function offsetMeters(from: SimCoord, northM: number, eastM: number): SimCoord {
  const dLat = northM / 111_320
  const cosLat = Math.cos((from.latitude * Math.PI) / 180)
  const dLng = eastM / (111_320 * Math.max(cosLat, 0.2))
  return {
    latitude: from.latitude + dLat,
    longitude: from.longitude + dLng,
  }
}

function densifyPath(corners: SimCoord[], stepMeters: number): SimCoord[] {
  const out: SimCoord[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]
    const b = corners[i + 1]
    const seg = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
    const steps = Math.max(1, Math.ceil(seg / stepMeters))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      out.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      })
    }
  }
  out.push(corners[corners.length - 1])
  return out
}

const SIM_PATH = densifyPath(LOOP_CORNERS, STEP_METERS)

export function simulateWalkPathLengthMeters(): number {
  let total = 0
  for (let i = 1; i < SIM_PATH.length; i++) {
    total += haversineMeters(
      SIM_PATH[i - 1].latitude,
      SIM_PATH[i - 1].longitude,
      SIM_PATH[i].latitude,
      SIM_PATH[i].longitude,
    )
  }
  return total
}

export function simulateWalkPointCount(): number {
  return SIM_PATH.length
}

/** Build a GeolocationPosition-shaped object for the tracker pipeline. */
export function createSimulatedPosition(
  index: number,
  timestamp = Date.now(),
): GeolocationPosition {
  const i = Math.min(Math.max(index, 0), SIM_PATH.length - 1)
  const { latitude, longitude } = SIM_PATH[i]
  const coords: GeolocationCoordinates = {
    latitude,
    longitude,
    accuracy: DEFAULT_ACCURACY,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: WALK_SPEED_MPS,
    toJSON() {
      return {
        latitude,
        longitude,
        accuracy: DEFAULT_ACCURACY,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: WALK_SPEED_MPS,
      }
    },
  }

  return {
    coords,
    timestamp,
    toJSON() {
      return { coords: coords.toJSON(), timestamp }
    },
  }
}

/** How often to emit the next simulated fix (ms). Must be ≥ GPS minIntervalMs. */
export const SIM_TICK_MS = 1000
