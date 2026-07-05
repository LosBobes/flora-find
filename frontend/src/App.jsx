import { useCallback, useEffect, useRef, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { api } from './api'
import { useAuth } from './AuthContext'
import { PLANT_CATEGORIES, fruitEmoji, plantEmoji } from './fruitIcons'
import { formatSeason } from './seasons'
import AuthModal from './components/AuthModal'
import MapView from './components/MapView'
import TreeDetails from './components/TreeDetails'
import TreeForm from './components/TreeForm'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const NEAR_ME_RADIUS_KM = 5

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export default function App() {
  const { user, logout } = useAuth()

  const [trees, setTrees] = useState([])
  const [fruitTypes, setFruitTypes] = useState([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [fruitFilter, setFruitFilter] = useState('')
  const [ripeNow, setRipeNow] = useState(false)
  const [nearMe, setNearMe] = useState(null) // {lat, lng} | null
  const [locating, setLocating] = useState(false)
  const [selectedTree, setSelectedTree] = useState(null)
  const [panTarget, setPanTarget] = useState(null)

  const [authModal, setAuthModal] = useState(null) // 'login' | 'register' | null
  const [addMode, setAddMode] = useState(false)
  const [draftPosition, setDraftPosition] = useState(null)
  const [editingTree, setEditingTree] = useState(null)
  const [notice, setNotice] = useState(null)

  const boundsRef = useRef(null)
  const debounceRef = useRef(null)

  const refreshTrees = useCallback(async () => {
    const params = {
      q: searchText || undefined,
      category: categoryFilter || undefined,
      fruit_type: fruitFilter || undefined,
      ripe_now: ripeNow || undefined,
    }
    const bounds = boundsRef.current
    if (nearMe) {
      // Radius search from the user's position; results come back distance-sorted.
      params.lat = nearMe.lat
      params.lng = nearMe.lng
      params.radius_km = NEAR_ME_RADIUS_KM
    } else if (bounds && !searchText) {
      // Only constrain to the viewport when not doing a text search, so
      // searches can find trees anywhere.
      params.min_lat = bounds.south
      params.max_lat = bounds.north
      params.min_lng = bounds.west
      params.max_lng = bounds.east
    }
    try {
      setTrees(await api.listTrees(params))
    } catch (err) {
      console.error('Failed to load trees', err)
    }
  }, [searchText, categoryFilter, fruitFilter, ripeNow, nearMe])

  useEffect(() => {
    refreshTrees()
  }, [refreshTrees])

  useEffect(() => {
    // Scope the type dropdown to the selected category (e.g. only fruits).
    api.fruitTypes(categoryFilter || undefined).then(setFruitTypes).catch(() => {})
    setFruitFilter('')
  }, [categoryFilter])

  const handleBoundsChanged = useCallback(
    (bounds) => {
      boundsRef.current = bounds
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(refreshTrees, 400)
    },
    [refreshTrees],
  )

  function showNotice(message) {
    setNotice(message)
    setTimeout(() => setNotice(null), 4000)
  }

  function startAddMode() {
    if (!user) {
      setAuthModal('login')
      return
    }
    setAddMode(true)
    setSelectedTree(null)
    setEditingTree(null)
    setDraftPosition(null)
  }

  function handleMapClick(latLng) {
    if (addMode) {
      setDraftPosition(latLng)
    } else {
      setSelectedTree(null)
    }
  }

  async function handleCreate(payload, photos) {
    const created = await api.createTree(payload)
    let message = `Registered “${created.name}” 🌱`
    if (photos?.length) {
      try {
        created.photos = await api.uploadPhotos(created.id, photos)
      } catch (err) {
        message = `Tree saved, but photo upload failed: ${err.message}`
      }
    }
    setAddMode(false)
    setDraftPosition(null)
    setSelectedTree(created)
    showNotice(message)
    refreshTrees()
    api.fruitTypes(categoryFilter || undefined).then(setFruitTypes).catch(() => {})
  }

  async function handleUpdate(payload) {
    const updated = await api.updateTree(editingTree.id, payload)
    setEditingTree(null)
    setSelectedTree(updated)
    showNotice('Plant updated ✓')
    refreshTrees()
  }

  async function handleDelete() {
    if (!window.confirm(`Delete “${selectedTree.name}”?`)) return
    try {
      await api.deleteTree(selectedTree.id)
      setSelectedTree(null)
      showNotice('Plant deleted')
      refreshTrees()
    } catch (err) {
      showNotice(err.message)
    }
  }

  function handleNearMe() {
    if (nearMe) {
      setNearMe(null)
      return
    }
    if (!navigator.geolocation) {
      showNotice('Geolocation is not supported by this browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setLocating(false)
        setNearMe(location)
        setPanTarget({ ...location, ts: Date.now() })
      },
      (err) => {
        setLocating(false)
        showNotice(`Could not get your location: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleConfirm(status) {
    if (!user) {
      setAuthModal('login')
      return
    }
    try {
      const updated = await api.confirmTree(selectedTree.id, status)
      setSelectedTree(updated)
      showNotice(status === 'present' ? 'Thanks for confirming! 👍' : 'Noted — thanks for reporting.')
      refreshTrees()
    } catch (err) {
      showNotice(err.message)
    }
  }

  function selectFromList(tree) {
    setSelectedTree(tree)
    setPanTarget({ lat: tree.lat, lng: tree.lng, ts: Date.now() })
  }

  if (!MAPS_API_KEY) {
    return (
      <div className="setup-hint">
        <h1>🌳 FloraFind</h1>
        <p>
          Missing Google Maps API key. Copy <code>frontend/.env.example</code> to{' '}
          <code>frontend/.env</code> and set <code>VITE_GOOGLE_MAPS_API_KEY</code>, then restart
          the dev server.
        </p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <div className="app">
        <header className="topbar">
          <div className="brand">🌳 FloraFind</div>
          <div className="search-controls">
            <input
              className="search-input"
              placeholder="Search plants, fruits, notes…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <select
              className="fruit-select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {PLANT_CATEGORIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.emoji} {entry.label}
                </option>
              ))}
            </select>
            <select
              className="fruit-select"
              value={fruitFilter}
              onChange={(event) => setFruitFilter(event.target.value)}
            >
              <option value="">All types</option>
              {fruitTypes.map((fruit) => (
                <option key={fruit} value={fruit}>
                  {fruitEmoji(fruit)} {fruit}
                </option>
              ))}
            </select>
            <button
              className={`btn btn-toggle${ripeNow ? ' active' : ''}`}
              onClick={() => setRipeNow((value) => !value)}
              title="Only show plants currently in season or bloom"
            >
              🟢 In season
            </button>
          </div>
          <div className="user-controls">
            {user ? (
              <>
                <span className="hello">Hi, {user.username}</span>
                <button className="btn" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={() => setAuthModal('login')}>
                  Log in
                </button>
                <button className="btn btn-primary" onClick={() => setAuthModal('register')}>
                  Register
                </button>
              </>
            )}
          </div>
        </header>

        <div className="content">
          <aside className="sidebar">
            <button
              className={`btn btn-add ${addMode ? 'btn-danger' : 'btn-primary'}`}
              onClick={addMode ? () => { setAddMode(false); setDraftPosition(null) } : startAddMode}
            >
              {addMode ? '✕ Cancel adding' : '+ Register a plant'}
            </button>
            {addMode && !draftPosition && (
              <p className="hint">Click on the map where the plant grows.</p>
            )}
            <button
              className={`btn btn-near-me${nearMe ? ' active' : ''}`}
              onClick={handleNearMe}
              disabled={locating}
            >
              {locating ? 'Locating…' : nearMe ? '✕ Leave near me' : '📍 Near me'}
            </button>
            <h2 className="sidebar-title">
              {trees.length} plant{trees.length === 1 ? '' : 's'}
              {nearMe
                ? ` within ${NEAR_ME_RADIUS_KM} km`
                : searchText
                  ? ' matching'
                  : ' in view'}
            </h2>
            <ul className="tree-list">
              {trees.map((tree) => (
                <li
                  key={tree.id}
                  className={selectedTree?.id === tree.id ? 'selected' : ''}
                  onClick={() => selectFromList(tree)}
                >
                  <span className="tree-list-emoji">{plantEmoji(tree)}</span>
                  <span>
                    <strong>
                      {tree.name}
                      {tree.hazard && <span title="Poisonous / hazardous"> ☠️</span>}
                      {tree.in_season && <span title="In season now"> 🟢</span>}
                      {tree.flagged_gone && <span title="Reported gone"> ⚠️</span>}
                    </strong>
                    <br />
                    <small>
                      {tree.fruit_type}
                      {formatSeason(tree) ? ` · ${formatSeason(tree)}` : ''}
                      {typeof tree.distance_km === 'number' && (
                        <span className="distance"> · {formatDistance(tree.distance_km)}</span>
                      )}
                    </small>
                  </span>
                </li>
              ))}
              {trees.length === 0 && (
                <li className="empty">Nothing here yet — register the first plant!</li>
              )}
            </ul>
          </aside>

          <main className="map-wrap">
            <MapView
              trees={trees}
              selectedTree={selectedTree}
              onSelectTree={setSelectedTree}
              addMode={addMode}
              draftPosition={draftPosition}
              onMapClick={handleMapClick}
              onBoundsChanged={handleBoundsChanged}
              panTarget={panTarget}
              userPosition={nearMe}
            >
              {selectedTree && (
                <TreeDetails
                  tree={selectedTree}
                  currentUser={user}
                  onEdit={() => setEditingTree(selectedTree)}
                  onDelete={handleDelete}
                  onConfirm={handleConfirm}
                />
              )}
            </MapView>

            {addMode && draftPosition && (
              <div className="form-panel">
                <TreeForm
                  position={draftPosition}
                  onSubmit={handleCreate}
                  onCancel={() => setDraftPosition(null)}
                />
              </div>
            )}
            {editingTree && (
              <div className="form-panel">
                <TreeForm
                  position={{ lat: editingTree.lat, lng: editingTree.lng }}
                  initial={editingTree}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingTree(null)}
                />
              </div>
            )}
            {notice && <div className="notice">{notice}</div>}
          </main>
        </div>

        {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
      </div>
    </APIProvider>
  )
}
