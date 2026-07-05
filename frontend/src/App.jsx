import { useCallback, useEffect, useRef, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { api } from './api'
import { useAuth } from './AuthContext'
import { fruitEmoji } from './fruitIcons'
import AuthModal from './components/AuthModal'
import MapView from './components/MapView'
import TreeDetails from './components/TreeDetails'
import TreeForm from './components/TreeForm'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export default function App() {
  const { user, logout } = useAuth()

  const [trees, setTrees] = useState([])
  const [fruitTypes, setFruitTypes] = useState([])
  const [searchText, setSearchText] = useState('')
  const [fruitFilter, setFruitFilter] = useState('')
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
    const params = { q: searchText || undefined, fruit_type: fruitFilter || undefined }
    const bounds = boundsRef.current
    if (bounds && !searchText) {
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
  }, [searchText, fruitFilter])

  useEffect(() => {
    refreshTrees()
    api.fruitTypes().then(setFruitTypes).catch(() => {})
  }, [refreshTrees])

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
    api.fruitTypes().then(setFruitTypes).catch(() => {})
  }

  async function handleUpdate(payload) {
    const updated = await api.updateTree(editingTree.id, payload)
    setEditingTree(null)
    setSelectedTree(updated)
    showNotice('Tree updated ✓')
    refreshTrees()
  }

  async function handleDelete() {
    if (!window.confirm(`Delete “${selectedTree.name}”?`)) return
    try {
      await api.deleteTree(selectedTree.id)
      setSelectedTree(null)
      showNotice('Tree deleted')
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
              placeholder="Search trees, fruits, notes…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <select
              className="fruit-select"
              value={fruitFilter}
              onChange={(event) => setFruitFilter(event.target.value)}
            >
              <option value="">All fruits</option>
              {fruitTypes.map((fruit) => (
                <option key={fruit} value={fruit}>
                  {fruitEmoji(fruit)} {fruit}
                </option>
              ))}
            </select>
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
              {addMode ? '✕ Cancel adding' : '+ Register a tree'}
            </button>
            {addMode && !draftPosition && (
              <p className="hint">Click on the map where the tree stands.</p>
            )}
            <h2 className="sidebar-title">
              {trees.length} tree{trees.length === 1 ? '' : 's'}
              {searchText ? ' matching' : ' in view'}
            </h2>
            <ul className="tree-list">
              {trees.map((tree) => (
                <li
                  key={tree.id}
                  className={selectedTree?.id === tree.id ? 'selected' : ''}
                  onClick={() => selectFromList(tree)}
                >
                  <span className="tree-list-emoji">{fruitEmoji(tree.fruit_type)}</span>
                  <span>
                    <strong>{tree.name}</strong>
                    <br />
                    <small>
                      {tree.fruit_type}
                      {tree.season ? ` · ${tree.season}` : ''}
                    </small>
                  </span>
                </li>
              ))}
              {trees.length === 0 && (
                <li className="empty">Nothing here yet — register the first tree!</li>
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
            >
              {selectedTree && (
                <TreeDetails
                  tree={selectedTree}
                  currentUser={user}
                  onEdit={() => setEditingTree(selectedTree)}
                  onDelete={handleDelete}
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
