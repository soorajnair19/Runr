import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GpsPoint } from '../types/run'

const ROUTE_SOURCE = 'run-route'
const ROUTE_LAYER = 'run-route-line'
const POINT_SOURCE = 'run-point'
const POINT_LAYER = 'run-point-circle'

type LineFeature = {
  type: 'Feature'
  properties: Record<string, never>
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

type PointFeature = {
  type: 'Feature'
  properties: Record<string, never>
  geometry: { type: 'Point'; coordinates: [number, number] }
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
}

interface MapViewProps {
  points: GpsPoint[]
  interactive?: boolean
  fitPadding?: number
  className?: string
  /** When true, follow the latest point closely (live run). */
  follow?: boolean
}

export function MapView({
  points,
  interactive = false,
  fitPadding = 40,
  className,
  follow = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)
  const lastFitCountRef = useRef(0)
  const pointsRef = useRef(points)
  pointsRef.current = points

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: false,
      interactive,
    })

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    )

    map.on('style.load', () => {
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: emptyLine(),
      })
      map.addLayer({
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1B7A4E',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      })

      map.addSource(POINT_SOURCE, {
        type: 'geojson',
        data: emptyPoint(),
      })
      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: POINT_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': '#1B7A4E',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      readyRef.current = true
      updateGeometry(map, pointsRef.current, follow, fitPadding, true)
      lastFitCountRef.current = pointsRef.current.length
    })

    mapRef.current = map

    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [interactive, follow, fitPadding])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const shouldFit =
      points.length === 1 ||
      points.length - lastFitCountRef.current >= 8 ||
      (!follow && points.length !== lastFitCountRef.current)

    if (!readyRef.current) {
      recenterMap(map, points, follow, fitPadding, shouldFit)
      if (shouldFit) lastFitCountRef.current = points.length
      return
    }

    updateGeometry(map, points, follow, fitPadding, shouldFit)
    if (shouldFit) lastFitCountRef.current = points.length
  }, [points, follow, fitPadding])

  return (
    <div
      ref={containerRef}
      className={className ?? 'map-view'}
      role="img"
      aria-label="Run route map"
    />
  )
}

function emptyLine(): LineFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [] },
  }
}

function emptyPoint(): PointFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [0, 0] },
  }
}

function updateGeometry(
  map: maplibregl.Map,
  points: GpsPoint[],
  follow: boolean,
  fitPadding: number,
  fit: boolean,
) {
  const routeSource = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined
  const pointSource = map.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!routeSource || !pointSource) return

  const coordinates = points.map(
    (p) => [p.longitude, p.latitude] as [number, number],
  )

  routeSource.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coordinates.length >= 2 ? coordinates : [],
    },
  })

  if (coordinates.length === 0) {
    pointSource.setData(emptyPoint())
    return
  }

  const last = coordinates[coordinates.length - 1]
  pointSource.setData({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: last },
  })

  recenterMap(map, points, follow, fitPadding, fit)
}

function recenterMap(
  map: maplibregl.Map,
  points: GpsPoint[],
  follow: boolean,
  fitPadding: number,
  fit: boolean,
) {
  const coordinates = points.map(
    (p) => [p.longitude, p.latitude] as [number, number],
  )
  if (coordinates.length === 0) return
  const last = coordinates[coordinates.length - 1]

  if (!fit) {
    if (follow) map.easeTo({ center: last, duration: 300 })
    return
  }

  if (coordinates.length === 1) {
    map.easeTo({ center: last, zoom: 16, duration: 400 })
    return
  }

  const bounds = coordinates.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
  )
  map.fitBounds(bounds, { padding: fitPadding, maxZoom: 17, duration: 400 })
}
