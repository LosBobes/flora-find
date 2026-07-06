import { useCallback, useEffect } from 'react'
import { Map, Marker, Popup, useMap } from '@vis.gl/react-maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { plantEmoji } from '../fruitIcons'

const DEFAULT_CENTER = { lat: 44.8125, lng: 20.4612 }
const DEFAULT_ZOOM = 13

// Raster OpenStreetMap style — no API key or tile provider account required.
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
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
  const reportBounds = useCallback(
    (event) => {
      const bounds = event.target.getBounds()
      onBoundsChanged({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    },
    [onBoundsChanged],
  )

  return (
    <Map
      mapStyle={OSM_STYLE}
      initialViewState={{
        longitude: DEFAULT_CENTER.lng,
        latitude: DEFAULT_CENTER.lat,
        zoom: DEFAULT_ZOOM,
      }}
      style={{ width: '100%', height: '100%' }}
      cursor={addMode || selectingArea ? 'crosshair' : 'grab'}
      onClick={(event) => onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
      onLoad={reportBounds}
      onMoveEnd={reportBounds}
    >
      <PanTo target={panTarget} />
      <BoxSelect active={selectingArea} onComplete={onAreaSelected} onCancel={onAreaCancel} />

      {trees.map((tree) => (
        <Marker
          key={tree.id}
          longitude={tree.lng}
          latitude={tree.lat}
          onClick={(event) => {
            event.originalEvent.stopPropagation()
            onSelectTree(tree)
          }}
        >
          <div
            className={`fruit-marker${selectedTree?.id === tree.id ? ' selected' : ''}${
              tree.hazard ? ' hazard' : ''
            }`}
            title={`${tree.name} (${tree.fruit_type})${tree.hazard ? ' — hazardous!' : ''}`}
          >
            {plantEmoji(tree)}
          </div>
        </Marker>
      ))}

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

      {selectedTree && (
        <Popup
          longitude={selectedTree.lng}
          latitude={selectedTree.lat}
          anchor="bottom"
          offset={22}
          maxWidth="300px"
          closeOnClick={false}
          onClose={() => onSelectTree(null)}
        >
          {children}
        </Popup>
      )}
    </Map>
  )
}
