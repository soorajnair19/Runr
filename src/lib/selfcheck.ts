import {
  formatDistanceKm,
  formatDuration,
  formatPace,
  formatRunDate,
  formatRunTime,
  runTitleFromStart,
} from './format'
import {
  averagePaceSecPerKm,
  discountedDistanceMeters,
  dynamicMinDistanceMeters,
  filterGpsPoint,
  haversineMeters,
  type FilterResult,
} from './gps'
import type { GpsPoint } from '../types/run'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function point(
  partial: Partial<GpsPoint> & Pick<GpsPoint, 'latitude' | 'longitude' | 'timestamp'>,
): GpsPoint {
  return {
    accuracy: 10,
    altitude: null,
    speed: null,
    heading: null,
    ...partial,
  }
}

const dist = haversineMeters(37.7749, -122.4194, 37.7759, -122.4194)
assert(Math.abs(dist - 111) < 5, `haversine expected ~111m, got ${dist}`)

const a = point({ latitude: 0, longitude: 0, timestamp: 0 })
const poor: FilterResult = filterGpsPoint(
  a,
  point({ latitude: 0.001, longitude: 0, timestamp: 1000, accuracy: 80 }),
)
assert(poor.accept === false && poor.reason === 'accuracy', 'should reject poor accuracy')

const tooSoon = filterGpsPoint(
  a,
  point({ latitude: 0.0002, longitude: 0, timestamp: 400 }),
)
assert(tooSoon.accept === false && tooSoon.reason === 'interval', 'should reject rapid updates')

const jitter = filterGpsPoint(
  a,
  point({ latitude: 0.00001, longitude: 0, timestamp: 2000, accuracy: 15 }),
)
assert(jitter.accept === false && jitter.reason === 'jitter', 'should reject accuracy-scale jitter')

const afterPause = filterGpsPoint(
  a,
  point({ latitude: 0.01, longitude: 0, timestamp: 60_000 }),
  { segmentBreak: true },
)
assert(afterPause.accept && afterPause.distanceDelta === 0, 'pause gap must not add distance')

const goodMove = filterGpsPoint(
  a,
  point({ latitude: 0.0002, longitude: 0, timestamp: 5_000, accuracy: 8 }),
)
assert(goodMove.accept === true, 'should accept clear movement')
if (goodMove.accept) {
  const raw = haversineMeters(0, 0, 0.0002, 0)
  assert(
    goodMove.distanceDelta < raw,
    'accepted distance should apply accuracy discount',
  )
  assert(goodMove.distanceDelta > 0, 'accepted distance must be positive')
}

assert(dynamicMinDistanceMeters(10, 10) >= 3, 'min distance floor')
assert(dynamicMinDistanceMeters(40, 40) > dynamicMinDistanceMeters(8, 8), 'worse accuracy raises min move')
assert(discountedDistanceMeters(20, 10, 10) < 20, 'discount reduces counted meters')

assert(formatDistanceKm(5240) === '5.24 km', 'distance format')
assert(formatDuration(29 * 60_000 + 42_000) === '29:42', 'duration mm:ss')
assert(formatDuration(3_751_000) === '1:02:31', 'duration h:mm:ss')
assert(formatPace(null) === '--:-- /km', 'pace placeholder')
assert(formatPace(340) === '5:40 /km', 'pace format')
assert(averagePaceSecPerKm(1000, 340_000) === 340, 'pace calc')

const morning = new Date(2026, 8, 22, 7, 12).getTime()
assert(formatRunDate(morning) === '22 SEPTEMBER 2026', 'date format')
assert(formatRunTime(morning).includes('7:12'), 'time format')
assert(runTitleFromStart(morning) === 'MORNING RUN', 'run title')

console.log('All lib assertions passed.')
