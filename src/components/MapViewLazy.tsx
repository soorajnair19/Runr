import { lazy, Suspense } from 'react'
import type { GpsPoint } from '../types/run'

const MapViewInner = lazy(() =>
  import('./MapView').then((m) => ({ default: m.MapView })),
)

interface MapViewLazyProps {
  points: GpsPoint[]
  liveFix?: GpsPoint | null
  liveMarker?: boolean
  interactive?: boolean
  fitPadding?: number
  className?: string
  follow?: boolean
}

export function MapViewLazy(props: MapViewLazyProps) {
  return (
    <Suspense
      fallback={
        <div className={props.className ?? 'map-view'} aria-label="Loading map">
          <div className="map-fallback">Loading map…</div>
        </div>
      }
    >
      <MapViewInner {...props} />
    </Suspense>
  )
}
