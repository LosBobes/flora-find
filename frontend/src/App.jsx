import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from './api'
import { useAuth } from './AuthContext'
import { useI18n } from './i18n'
import AuthModal from './components/AuthModal'
import ExportPanel from './components/ExportPanel'
import MapView from './components/MapView'
import TreeDetails from './components/TreeDetails'
import TreeForm from './components/TreeForm'
import TopNav from './components/TopNav'
import PlantList from './components/PlantList'
import MapSettingsControl from './components/MapSettingsControl'
import MobileDock from './components/MobileDock'
import BottomSheet from './components/BottomSheet'
import { ShimmerButton } from './ui/shimmer-button'
import { cn } from './lib/utils'

const NEAR_ME_RADIUS_KM = 5

// A floating map panel (form / details / export). Rounded card with a travelling
// border beam; top-right on desktop, a bottom card on mobile (above the dock).
function FloatingPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="beam-border absolute inset-x-3 bottom-24 z-40 max-h-[68vh] overflow-y-auto rounded-2xl border border-forest-100 bg-white p-5 shadow-card dark:border-white/10 dark:bg-[#12241a] md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:w-[360px]"
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const { user, logout } = useAuth()
  const { t, name: plantName } = useI18n()

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
  const [selectingArea, setSelectingArea] = useState(false)
  const [exportArea, setExportArea] = useState(null)

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
      params.lat = nearMe.lat
      params.lng = nearMe.lng
      params.radius_km = NEAR_ME_RADIUS_KM
    } else if (bounds && !searchText) {
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
    setSelectingArea(false)
    setAddMode(true)
    setSelectedTree(null)
    setEditingTree(null)
    setDraftPosition(null)
  }

  function toggleAddMode() {
    if (addMode) {
      setAddMode(false)
      setDraftPosition(null)
    } else {
      startAddMode()
    }
  }

  function toggleSelectArea() {
    if (selectingArea) {
      setSelectingArea(false)
      return
    }
    setAddMode(false)
    setDraftPosition(null)
    setExportArea(null)
    setSelectingArea(true)
    showNotice(t('dragToSelectNotice'))
  }

  function handleAreaSelected(area) {
    setSelectingArea(false)
    setExportArea(area)
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
    let message = t('registeredNotice', { name: created.name })
    if (photos?.length) {
      try {
        created.photos = await api.uploadPhotos(created.id, photos)
      } catch (err) {
        message = t('photoUploadFailed', { message: err.message })
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
    showNotice(t('plantUpdated'))
    refreshTrees()
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDelete', { name: plantName(selectedTree.name) }))) return
    try {
      await api.deleteTree(selectedTree.id)
      setSelectedTree(null)
      showNotice(t('plantDeleted'))
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
      showNotice(t('geolocationUnsupported'))
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
        showNotice(t('locationError', { message: err.message }))
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
      showNotice(status === 'present' ? t('thanksConfirming') : t('thanksReporting'))
      refreshTrees()
    } catch (err) {
      showNotice(err.message)
    }
  }

  function selectFromList(tree) {
    setSelectedTree(tree)
    setPanTarget({ lat: tree.lat, lng: tree.lng, ts: Date.now() })
  }

  const countSuffix = nearMe
    ? t('withinKm', { km: NEAR_ME_RADIUS_KM })
    : searchText
      ? t('matchingSuffix')
      : t('inViewSuffix')

  const filterProps = {
    searchText,
    setSearchText,
    categoryFilter,
    setCategoryFilter,
    fruitFilter,
    setFruitFilter,
    fruitTypes,
    ripeNow,
    setRipeNow,
  }

  return (
    <div className="flex h-full flex-col bg-forest-50 dark:bg-[#0e1f14]">
      <TopNav
        filterProps={filterProps}
        onLogin={() => setAuthModal('login')}
        onRegister={() => setAuthModal('register')}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-[320px] shrink-0 flex-col gap-3 border-r border-forest-100 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5 md:flex">
          {addMode ? (
            <button
              type="button"
              onClick={toggleAddMode}
              className="w-full rounded-full border border-red-200 bg-red-50 px-5 py-2.5 font-semibold text-red-600 transition hover:bg-red-100"
            >
              × {t('cancelAdding')}
            </button>
          ) : (
            <ShimmerButton className="w-full" onClick={startAddMode}>
              + {t('registerPlant')}
            </ShimmerButton>
          )}
          {addMode && !draftPosition && (
            <p className="rounded-xl bg-forest-100 px-3 py-2 text-sm text-forest-700 dark:bg-white/10 dark:text-forest-100">
              {t('clickToPlace')}
            </p>
          )}
          <button
            type="button"
            onClick={handleNearMe}
            disabled={locating}
            className={cn(
              'w-full rounded-full border px-4 py-2 text-sm font-semibold transition',
              nearMe
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-forest-200 bg-white text-forest-700 hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10',
            )}
          >
            {locating ? t('locating') : nearMe ? `× ${t('leaveNearMe')}` : t('nearMe')}
          </button>
          {user?.is_admin && (
            <button
              type="button"
              onClick={toggleSelectArea}
              className={cn(
                'w-full rounded-full border px-4 py-2 text-sm font-semibold transition',
                selectingArea
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-forest-200 bg-white text-forest-700 hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10',
              )}
            >
              {selectingArea ? `× ${t('cancelExport')}` : t('exportArea')}
            </button>
          )}
          {selectingArea && (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">{t('dragToSelect')}</p>
          )}
          <PlantList
            trees={trees}
            selectedTree={selectedTree}
            onSelect={selectFromList}
            countSuffix={countSuffix}
          />
        </aside>

        {/* Map */}
        <main className="relative min-w-0 flex-1">
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
            selectingArea={selectingArea}
            onAreaSelected={handleAreaSelected}
            onAreaCancel={() => setSelectingArea(false)}
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

          {/* Desktop map appearance control */}
          <div className="absolute right-3 top-3 z-20 hidden md:block">
            <MapSettingsControl />
          </div>

          <AnimatePresence>
            {addMode && draftPosition && (
              <FloatingPanel key="add-form">
                <TreeForm
                  position={draftPosition}
                  onSubmit={handleCreate}
                  onCancel={() => setDraftPosition(null)}
                />
              </FloatingPanel>
            )}
            {editingTree && (
              <FloatingPanel key="edit-form">
                <TreeForm
                  position={{ lat: editingTree.lat, lng: editingTree.lng }}
                  initial={editingTree}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingTree(null)}
                />
              </FloatingPanel>
            )}
            {exportArea && (
              <FloatingPanel key="export-panel">
                <ExportPanel area={exportArea} onClose={() => setExportArea(null)} onNotice={showNotice} />
              </FloatingPanel>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-none absolute bottom-24 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-forest-700 px-5 py-2.5 text-sm font-medium text-white shadow-card md:bottom-6"
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Mobile: bottom sheet with the list + floating dock */}
        <BottomSheet>
          <PlantList
            trees={trees}
            selectedTree={selectedTree}
            onSelect={selectFromList}
            countSuffix={countSuffix}
          />
        </BottomSheet>
      </div>

      <MobileDock
        user={user}
        onLogin={() => setAuthModal('login')}
        onLogout={logout}
        addMode={addMode}
        onToggleAdd={toggleAddMode}
        nearMe={nearMe}
        locating={locating}
        onNearMe={handleNearMe}
        isAdmin={!!user?.is_admin}
        selectingArea={selectingArea}
        onToggleExport={toggleSelectArea}
        filterProps={filterProps}
      />

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  )
}
