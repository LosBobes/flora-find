import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map, Marker, Popup, useMap } from '@vis.gl/react-maplibre'
import { AnimatePresence, motion } from 'motion/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PlantIcon } from '../icons'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { buildBasemapStyle, useMapSettings } from '../MapSettingsContext'
import { cn } from '../lib/utils'

const DEFAULT_CENTER = { lat: 44.8125, lng: 20.4612 }
const DEFAULT_ZOOM = 13

// When a plant is selected, make sure its popup card is fully on screen. The
// popup opens above the marker, so a marker near the top or side edge would be
// clipped. We measure the rendered popup and ease the map just enough to bring
// the whole card into view (with padding), without recentring unnecessarily.
function PanToSelected({ tree }) {
  const { current: map } = useMap()
  useEffect(() => {
    if (!map || !tree) return
    const m = map.getMap ? map.getMap() : map
    let raf2 = 0
    // Two frames so the popup is fully laid out before we measure its real box
    // (the hazard card is the tallest, so an estimate would clip it).
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const container = m.getContainer()
        const popupEl = container.querySelector('.maplibregl-popup')
        if (!popupEl) return
        const c = container.getBoundingClientRect()
        const p = popupEl.getBoundingClientRect()
        const pad = 12

        let dy = 0
        if (p.top < c.top + pad) dy = c.top + pad - p.top
        else if (p.bottom > c.bottom - pad) dy = c.bottom - pad - p.bottom

        let dx = 0
        if (p.left < c.left + pad) dx = c.left + pad - p.left
        else if (p.right > c.right - pad) dx = c.right - pad - p.right

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        // Shift the map so the popup box moves by (dx, dy) on screen.
        const center = m.project(m.getCenter())
        const newCenter = m.unproject([center.x - dx, center.y - dy])
        m.easeTo({ center: newCenter, duration: 320 })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
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
  children,
}) {
  const { name: plantName } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const { theme, markerPx, showLabels, isDark } = useMapSettings()
  const mapStyle = useMemo(() => buildBasemapStyle(theme), [theme])

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
      cursor={addMode || selectingArea ? 'crosshair' : 'grab'}
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      onClick={(event) => onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
      onLoad={handleLoad}
      onMoveEnd={reportBounds}
    >
      <PanToSelected tree={selectedTree} />
      <PanTo target={panTarget} />
      <BoxSelect active={selectingArea} onComplete={onAreaSelected} onCancel={onAreaCancel} />

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
