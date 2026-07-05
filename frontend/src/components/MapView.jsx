import { useEffect } from 'react'
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps'
import { plantEmoji } from '../fruitIcons'

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

const DEFAULT_CENTER = { lat: 44.8125, lng: 20.4612 }
const DEFAULT_ZOOM = 13

function PanTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (map && target) {
      map.panTo({ lat: target.lat, lng: target.lng })
      if (map.getZoom() < 15) map.setZoom(15)
    }
  }, [map, target])
  return null
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
  children,
}) {
  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      className={addMode ? 'map map-add-mode' : 'map'}
      onClick={(event) => {
        const latLng = event.detail?.latLng
        if (latLng) onMapClick(latLng)
      }}
      onIdle={(event) => {
        const bounds = event.map.getBounds()
        if (bounds) onBoundsChanged(bounds.toJSON())
      }}
    >
      <PanTo target={panTarget} />

      {trees.map((tree) => (
        <AdvancedMarker
          key={tree.id}
          position={{ lat: tree.lat, lng: tree.lng }}
          title={`${tree.name} (${tree.fruit_type})${tree.hazard ? ' — hazardous!' : ''}`}
          onClick={() => onSelectTree(tree)}
        >
          <div
            className={`fruit-marker${selectedTree?.id === tree.id ? ' selected' : ''}${
              tree.hazard ? ' hazard' : ''
            }`}
          >
            {plantEmoji(tree)}
          </div>
        </AdvancedMarker>
      ))}

      {userPosition && (
        <AdvancedMarker position={userPosition} title="You are here" zIndex={999}>
          <div className="user-dot" />
        </AdvancedMarker>
      )}

      {draftPosition && (
        <AdvancedMarker position={draftPosition} zIndex={1000}>
          <Pin background="#2e7d32" borderColor="#1b5e20" glyphColor="#fff" />
        </AdvancedMarker>
      )}

      {selectedTree && (
        <InfoWindow
          position={{ lat: selectedTree.lat, lng: selectedTree.lng }}
          pixelOffset={[0, -36]}
          onCloseClick={() => onSelectTree(null)}
        >
          {children}
        </InfoWindow>
      )}
    </Map>
  )
}
