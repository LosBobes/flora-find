import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map, Layer, Marker, Popup, Source, useMap } from '@vis.gl/react-maplibre'
import { AnimatePresence, motion } from 'motion/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PlantIcon } from '../icons'
import { plantColor } from '../fruitIcons'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { buildBasemapStyle, useMapSettings } from '../MapSettingsContext'
import { cn } from '../lib/utils'

const DRAFT_COLOR = '#2e7d32'

// A GeoJSON Polygon needs its outer ring closed (first point repeated at the
// end); areas are stored unclosed, so close them here for rendering.
function closedRing(polygon) {
  if (!polygon?.length) return []
  const first = polygon[0]
  const last = polygon[polygon.length - 1]
  return first[0] === last[0] && first[1] === last[1] ? polygon : [...polygon, first]
}

const DEFAULT_CENTER = { lat: 44.8125, lng: 20.4612 }
const DEFAULT_ZOOM = 13

const POPUP_OFFSET = 22 // matches the <Popup offset> below

// When a plant is selected, make sure its popup card is fully on screen. The
// popup opens above the marker, so a marker near an edge — or, on mobile, near
// the bottom bar that floats over the map — would be clipped. We derive the
// popup's box from the marker's projected point and the card's *layout* size
// (stable while its open animation plays, unlike the animated bounding box),
// then ease the map just enough to bring the whole card into view.
function PanToSelected({ tree }) {
  const { current: map } = useMap()
  useEffect(() => {
    if (!map || !tree) return
    const m = map.getMap ? map.getMap() : map
    let raf = 0
    let tries = 0
    const run = () => {
      const container = m.getContainer()
      const popupEl = container.querySelector('.maplibregl-popup')
      // The popup mounts a render after selection (it waits on `shownTree`) and
      // then lays out, so poll a few frames until it has a real size before
      // measuring — otherwise we'd bail out or read a stale/zero box.
      if (!popupEl || !popupEl.offsetWidth) {
        if (tries++ < 15) raf = requestAnimationFrame(run)
        return
      }
      {
        const cRect = container.getBoundingClientRect()
        const w = popupEl.offsetWidth
        const h = popupEl.offsetHeight
        const pad = 12

        // Marker anchor point, then the card box above it (anchor bottom,
        // horizontally centred). Everything is in container-local pixels.
        const pt = m.project([tree.lng, tree.lat])
        const left = pt.x - w / 2
        const right = pt.x + w / 2
        const boxBottom = pt.y - POPUP_OFFSET
        const top = boxBottom - h

        // On mobile the melded bottom bar (search + nav + list) floats over the
        // lower edge of the map. Without reserving that band a popup that looks
        // "in bounds" is actually hidden behind the bar, so a tapped pin never
        // appears to centre. Measure whatever chrome overlaps the map's bottom.
        let bottomChrome = 0
        const chromeEl = document.querySelector('[data-map-bottom-chrome]')
        if (chromeEl) {
          const b = chromeEl.getBoundingClientRect()
          bottomChrome = Math.max(0, cRect.bottom - b.top)
        }

        const minX = pad
        const maxX = cRect.width - pad
        const minY = pad
        const maxY = cRect.height - pad - bottomChrome

        let dx = 0
        if (left < minX) dx = minX - left
        else if (right > maxX) dx = maxX - right

        let dy = 0
        if (h > maxY - minY) {
          // Card taller than the safe area (e.g. the hazard card on a small
          // phone): keep its bottom — the confirm/report buttons — clear of the
          // bar, even if the top clips past the map's top edge.
          dy = maxY - boxBottom
        } else if (top < minY) dy = minY - top
        else if (boxBottom > maxY) dy = maxY - boxBottom

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        // Shift the map so the card box moves by (dx, dy) on screen.
        const center = m.project(m.getCenter())
        const newCenter = m.unproject([center.x - dx, center.y - dy])
        m.easeTo({ center: newCenter, duration: 320 })
      }
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [map, tree])
  return null
}

function PanTo({ target }) {
  const { current: map } = useMap()
  useEffect(() => {
    if (map && target) {
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: Math.max(map.getZoom(), 15),
      })
    }
  }, [map, target])
  return null
}

// Lets an admin drag a rectangle on the map to pick an area to export. While
// active it takes over map dragging and draws a selection box on the canvas.
function BoxSelect({ active, onComplete, onCancel }) {
  const { current: mapRef } = useMap()

  useEffect(() => {
    if (!mapRef || !active) return
    const map = mapRef.getMap ? mapRef.getMap() : mapRef
    const canvas = map.getCanvasContainer()

    let start = null
    let box = null

    const pointFor = (event) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const removeBox = () => {
      if (box) {
        box.remove()
        box = null
      }
    }

    const onMouseMove = (event) => {
      const current = pointFor(event)
      if (!box) {
        box = document.createElement('div')
        box.className = 'export-box'
        canvas.appendChild(box)
      }
      const minX = Math.min(start.x, current.x)
      const minY = Math.min(start.y, current.y)
      box.style.transform = `translate(${minX}px, ${minY}px)`
      box.style.width = `${Math.abs(current.x - start.x)}px`
      box.style.height = `${Math.abs(current.y - start.y)}px`
    }

    const onMouseUp = (event) => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      removeBox()
      map.dragPan.enable()
      const end = pointFor(event)
      const dragged = Math.abs(end.x - start.x) > 4 && Math.abs(end.y - start.y) > 4
      if (!dragged) {
        onCancel()
        return
      }
      const a = map.unproject([start.x, start.y])
      const b = map.unproject([end.x, end.y])
      onComplete({
        min_lat: Math.min(a.lat, b.lat),
        max_lat: Math.max(a.lat, b.lat),
        min_lng: Math.min(a.lng, b.lng),
        max_lng: Math.max(a.lng, b.lng),
      })
    }

    const onMouseDown = (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      map.dragPan.disable()
      start = pointFor(event)
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    canvas.addEventListener('mousedown', onMouseDown)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      removeBox()
      map.dragPan.enable()
    }
  }, [mapRef, active, onComplete, onCancel])

  return null
}

function DraftPin() {
  return (
    <svg width="30" height="42" viewBox="0 0 30 42" className="draft-pin">
      <path
        d="M15 0C6.7 0 0 6.7 0 15c0 11 15 27 15 27s15-16 15-27C30 6.7 23.3 0 15 0z"
        fill="#2e7d32"
        stroke="#1b5e20"
        strokeWidth="1.5"
      />
      <circle cx="15" cy="15" r="5.5" fill="#fff" />
    </svg>
  )
}

export default function MapView({
  trees,
  selectedTree,
  onSelectTree,
  addMode,
  draftPosition,
  onMapClick,
  onBoundsChanged,
  panTarget,
  userPosition,
  selectingArea = false,
  onAreaSelected,
  onAreaCancel,
  areas = [],
  selectedArea,
  onSelectArea,
  drawingArea = false,
  draftPolygon = [],
  areaDetails,
  children,
}) {
  const { name: plantName } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const { theme, markerPx, showLabels, isDark } = useMapSettings()
  const mapStyle = useMemo(() => buildBasemapStyle(theme), [theme])

  // Saved areas as a filled/outlined polygon layer. Each feature carries its
  // colour and whether it's the selected one so the paint expressions can react
  // without extra layers. Rebuilt when the set or the selection changes.
  const selectedAreaId = selectedArea?.id ?? null
  const areaCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: areas
        .filter((area) => area.polygon?.length >= 3)
        .map((area) => ({
          type: 'Feature',
          properties: {
            id: area.id,
            color: plantColor(area),
            selected: area.id === selectedAreaId ? 1 : 0,
          },
          geometry: { type: 'Polygon', coordinates: [closedRing(area.polygon)] },
        })),
    }),
    [areas, selectedAreaId],
  )

  // The polygon being drawn: filled once it has 3+ points, otherwise just the
  // path so far. Vertices are drawn as markers below.
  const draftCollection = useMemo(() => {
    const ring = draftPolygon.map((point) => [point.lng, point.lat])
    const features = []
    if (ring.length >= 3) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
      })
    } else if (ring.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: ring },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [draftPolygon])

  // Keep the popup mounted through its exit animation: `shownTree` lingers after
  // `selectedTree` clears until AnimatePresence reports the card has left.
  const [shownTree, setShownTree] = useState(null)
  const selectedRef = useRef(selectedTree)
  selectedRef.current = selectedTree
  useEffect(() => {
    if (selectedTree) setShownTree(selectedTree)
  }, [selectedTree])

  const reportBounds = useCallback((event) => {
    const bounds = event.target.getBounds()
    onBoundsChanged({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }, [onBoundsChanged])

  // Keep the map locked to north-up: no rotation or pitch, ever.
  const handleLoad = useCallback((event) => {
    const map = event.target
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    reportBounds(event)
  }, [reportBounds])

  const handleClick = useCallback(
    (event) => {
      const latLng = { lat: event.lngLat.lat, lng: event.lngLat.lng }
      // While drawing or placing a plant, every click is a coordinate; don't let
      // an area fill under the cursor swallow it.
      if (drawingArea || addMode) {
        onMapClick(latLng)
        return
      }
      const areaHit = event.features?.find((feature) => feature.layer?.id === 'area-fill')
      if (areaHit && onSelectArea) {
        onSelectArea(Number(areaHit.properties.id))
        return
      }
      onMapClick(latLng)
    },
    [drawingArea, addMode, onMapClick, onSelectArea],
  )

  return (
    <Map
      mapStyle={mapStyle}
      initialViewState={{
        longitude: DEFAULT_CENTER.lng,
        latitude: DEFAULT_CENTER.lat,
        zoom: DEFAULT_ZOOM,
        bearing: 0,
        pitch: 0,
      }}
      style={{ width: '100%', height: '100%' }}
      cursor={addMode || selectingArea || drawingArea ? 'crosshair' : 'grab'}
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      interactiveLayerIds={['area-fill']}
      onClick={handleClick}
      onLoad={handleLoad}
      onMoveEnd={reportBounds}
    >
      <PanToSelected tree={selectedTree} />
      <PanTo target={panTarget} />
      <BoxSelect active={selectingArea} onComplete={onAreaSelected} onCancel={onAreaCancel} />

      {/* Saved plant areas: fill + outline, brighter when selected. */}
      <Source id="areas" type="geojson" data={areaCollection}>
        <Layer
          id="area-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.4, 0.16],
          }}
        />
        <Layer
          id="area-outline"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5],
          }}
        />
      </Source>

      {/* The area currently being drawn. */}
      {drawingArea && (
        <Source id="draft-area" type="geojson" data={draftCollection}>
          <Layer id="draft-fill" type="fill" paint={{ 'fill-color': DRAFT_COLOR, 'fill-opacity': 0.2 }} />
          <Layer
            id="draft-line"
            type="line"
            paint={{ 'line-color': DRAFT_COLOR, 'line-width': 2, 'line-dasharray': [2, 1] }}
          />
        </Source>
      )}

      {drawingArea &&
        draftPolygon.map((point, index) => (
          <Marker key={index} longitude={point.lng} latitude={point.lat} style={{ zIndex: 5 }}>
            <span
              className={cn(
                'block rounded-full border-2 border-white shadow',
                index === 0 ? 'size-3.5' : 'size-2.5',
              )}
              style={{ backgroundColor: DRAFT_COLOR }}
            />
          </Marker>
        ))}

      {selectedArea && areaDetails && (
        <Popup
          longitude={selectedArea.center_lng}
          latitude={selectedArea.center_lat}
          anchor="bottom"
          offset={12}
          maxWidth="300px"
          closeOnClick={false}
          onClose={() => onSelectArea && onSelectArea(null)}
        >
          {areaDetails}
        </Popup>
      )}

      {trees.map((tree) => {
        const selected = selectedTree?.id === tree.id
        const px = Math.round(selected ? markerPx * 1.3 : markerPx)
        return (
          <Marker
            key={tree.id}
            longitude={tree.lng}
            latitude={tree.lat}
            style={{ zIndex: selected ? 4 : 1 }}
            onClick={(event) => {
              event.originalEvent.stopPropagation()
              onSelectTree(tree)
            }}
          >
            <motion.div
              className="flex cursor-pointer flex-col items-center"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              whileHover={{ scale: 1.12 }}
              title={`${plantName(tree.name)} (${localizedType(tree.fruit_type)})`}
            >
              <PlantIcon
                tree={tree}
                size={px}
                className={cn(
                  'block drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]',
                  tree.hazard && 'rounded-full shadow-[0_0_0_3px_rgba(198,40,40,0.4)]',
                )}
              />
              {showLabels && (
                <span
                  className={cn(
                    'mt-1 max-w-[120px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm',
                    isDark ? 'bg-forest-900/85 text-white' : 'bg-white/90 text-forest-900',
                  )}
                >
                  {plantName(tree.name)}
                </span>
              )}
            </motion.div>
          </Marker>
        )
      })}

      {userPosition && (
        <Marker longitude={userPosition.lng} latitude={userPosition.lat} style={{ zIndex: 2 }}>
          <div className="user-dot" title="You are here" />
        </Marker>
      )}

      {draftPosition && (
        <Marker
          longitude={draftPosition.lng}
          latitude={draftPosition.lat}
          anchor="bottom"
          style={{ zIndex: 3 }}
        >
          <DraftPin />
        </Marker>
      )}

      {shownTree && (
        <Popup
          longitude={shownTree.lng}
          latitude={shownTree.lat}
          anchor="bottom"
          offset={22}
          maxWidth="300px"
          closeOnClick={false}
          onClose={() => onSelectTree(null)}
        >
          <AnimatePresence onExitComplete={() => { if (!selectedRef.current) setShownTree(null) }}>
            {selectedTree && (
              <motion.div
                key={selectedTree.id}
                initial={{ opacity: 0, scale: 0.8, y: 16, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, y: 8, filter: 'blur(6px)', transition: { duration: 0.18, ease: 'easeIn' } }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.7 }}
                style={{ transformOrigin: 'bottom center' }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </Popup>
      )}
    </Map>
  )
}
