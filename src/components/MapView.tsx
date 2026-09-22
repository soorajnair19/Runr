import { useEffect, useRef, type MutableRefObject } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GpsPoint } from '../types/run'

const ROUTE_SOURCE = 'run-route'
const ROUTE_LAYER = 'run-route-line'
const PREVIEW_SOURCE = 'run-preview'
const PREVIEW_LAYER = 'run-preview-line'
const BREADCRUMB_SOURCE = 'run-breadcrumbs'
const BREADCRUMB_LAYER = 'run-breadcrumb-circles'
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

type MultiPointFeature = {
  type: 'Feature'
  properties: Record<string, never>
  geometry: { type: 'MultiPoint'; coordinates: [number, number][] }
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
  /** Live GPS fix for the pulsing “you are here” marker (live run only). */
  liveFix?: GpsPoint | null
  /** Use HTML pulse marker instead of a static circle end-point. */
  liveMarker?: boolean
  interactive?: boolean
  fitPadding?: number
  className?: string
  /** When true, follow the latest point closely (live run). */
  follow?: boolean
}

export function MapView({
  points,
  liveFix = null,
  liveMarker = false,
  interactive = false,
  fitPadding = 40,
  className,
  follow = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const readyRef = useRef(false)
  const lastFitCountRef = useRef(0)
  const pointsRef = useRef(points)
  const liveFixRef = useRef(liveFix)
  const followRef = useRef(follow)
  const fitPaddingRef = useRef(fitPadding)
  pointsRef.current = points
  liveFixRef.current = liveFix
  followRef.current = follow
  fitPaddingRef.current = fitPadding

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
          'line-color': '#0E5C38',
          'line-width': 5,
          'line-opacity': 1,
        },
      })

      // Live preview: last accepted point → current live fix (visual only).
      map.addSource(PREVIEW_SOURCE, {
        type: 'geojson',
        data: emptyLine(),
      })
      map.addLayer({
        id: PREVIEW_LAYER,
        type: 'line',
        source: PREVIEW_SOURCE,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1B7A4E',
          'line-width': 3.5,
          'line-opacity': 0.55,
          'line-dasharray': [1.5, 1.5],
        },
      })

      // Breadcrumb dots so the trail is visible even with few accepted points.
      map.addSource(BREADCRUMB_SOURCE, {
        type: 'geojson',
        data: emptyMultiPoint(),
      })
      map.addLayer({
        id: BREADCRUMB_LAYER,
        type: 'circle',
        source: BREADCRUMB_SOURCE,
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#1B7A4E',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      })

      if (!liveMarker) {
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
      }

      readyRef.current = true
      updateGeometry(
        map,
        markerRef,
        pointsRef.current,
        liveFixRef.current,
        followRef.current,
        fitPaddingRef.current,
        true,
        liveMarker,
      )
      lastFitCountRef.current = pointsRef.current.length
    })

    mapRef.current = map

    const resizeFrame = requestAnimationFrame(() => {
      map.resize()
    })

    return () => {
      cancelAnimationFrame(resizeFrame)
      readyRef.current = false
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [interactive, liveMarker])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const shouldFit =
      points.length === 1 ||
      (Boolean(liveFix) && points.length === 0) ||
      points.length - lastFitCountRef.current >= 8 ||
      (!follow && points.length !== lastFitCountRef.current)

    if (!readyRef.current) {
      recenterMap(map, points, liveFix, follow, fitPadding, shouldFit)
      if (shouldFit) lastFitCountRef.current = Math.max(points.length, liveFix ? 1 : 0)
      return
    }

    updateGeometry(
      map,
      markerRef,
      points,
      liveFix,
      follow,
      fitPadding,
      shouldFit,
      liveMarker,
    )
    if (shouldFit) lastFitCountRef.current = Math.max(points.length, liveFix ? 1 : 0)
  }, [points, liveFix, follow, fitPadding, liveMarker])

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

function emptyMultiPoint(): MultiPointFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPoint', coordinates: [] },
  }
}

function createPulseMarkerElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'live-location-marker'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<span class="live-location-pulse"></span><span class="live-location-dot"></span>'
  return el
}

function ensurePulseMarker(
  map: maplibregl.Map,
  markerRef: MutableRefObject<maplibregl.Marker | null>,
  lng: number,
  lat: number,
) {
  if (markerRef.current) {
    markerRef.current.setLngLat([lng, lat])
    return
  }
  markerRef.current = new maplibregl.Marker({
    element: createPulseMarkerElement(),
    anchor: 'center',
  })
    .setLngLat([lng, lat])
    .addTo(map)
}

function updateGeometry(
  map: maplibregl.Map,
  markerRef: MutableRefObject<maplibregl.Marker | null>,
  points: GpsPoint[],
  liveFix: GpsPoint | null,
  follow: boolean,
  fitPadding: number,
  fit: boolean,
  liveMarker: boolean,
) {
  const routeSource = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined
  const previewSource = map.getSource(PREVIEW_SOURCE) as maplibregl.GeoJSONSource | undefined
  const breadcrumbSource = map.getSource(BREADCRUMB_SOURCE) as
    | maplibregl.GeoJSONSource
    | undefined
  if (!routeSource || !previewSource || !breadcrumbSource) return

  const coordinates = points.map(
    (p) => [p.longitude, p.latitude] as [number, number],
  )

  // Live mode: always extend the drawn trail to the pulse marker tip.
  const drawCoords: [number, number][] = [...coordinates]
  if (liveMarker && liveFix) {
    const live: [number, number] = [liveFix.longitude, liveFix.latitude]
    const last = drawCoords[drawCoords.length - 1]
    const differs =
      !last ||
      Math.abs(last[0] - live[0]) > 1e-7 ||
      Math.abs(last[1] - live[1]) > 1e-7
    if (differs) drawCoords.push(live)
  }

  routeSource.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: drawCoords.length >= 2 ? drawCoords : [],
    },
  })

  breadcrumbSource.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPoint',
      coordinates: drawCoords,
    },
  })

  // Preview layer unused when trail already extends to liveFix — clear it.
  previewSource.setData(emptyLine())

  if (liveMarker) {
    if (liveFix) {
      ensurePulseMarker(map, markerRef, liveFix.longitude, liveFix.latitude)
    }
  } else {
    const pointSource = map.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!pointSource) return

    if (coordinates.length === 0) {
      pointSource.setData(emptyPoint())
      recenterMap(map, points, liveFix, follow, fitPadding, fit)
      return
    }

    const last = coordinates[coordinates.length - 1]
    pointSource.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: last },
    })
  }

  recenterMap(map, points, liveFix, follow, fitPadding, fit)
}

function recenterMap(
  map: maplibregl.Map,
  points: GpsPoint[],
  liveFix: GpsPoint | null,
  follow: boolean,
  fitPadding: number,
  fit: boolean,
) {
  const coordinates = points.map(
    (p) => [p.longitude, p.latitude] as [number, number],
  )

  const followTarget: [number, number] | null = liveFix
    ? [liveFix.longitude, liveFix.latitude]
    : coordinates.length > 0
      ? coordinates[coordinates.length - 1]
      : null

  if (!followTarget) return

  if (!fit) {
    if (follow) map.easeTo({ center: followTarget, duration: 300 })
    return
  }

  if (coordinates.length <= 1) {
    map.easeTo({ center: followTarget, zoom: 16, duration: 400 })
    return
  }

  const bounds = coordinates.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
  )
  if (liveFix) bounds.extend([liveFix.longitude, liveFix.latitude])
  map.fitBounds(bounds, { padding: fitPadding, maxZoom: 17, duration: 400 })
}
