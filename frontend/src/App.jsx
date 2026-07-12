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
import PlantFormSheet from './components/PlantFormSheet'
import ProfilePanel from './components/ProfilePanel'
import AreaDetails from './components/AreaDetails'
import TopNav from './components/TopNav'
import PlantList from './components/PlantList'
import MapSettingsControl from './components/MapSettingsControl'
import MobileBottomBar from './components/MobileBottomBar'
import Tutorial, { TOUR_DONE_KEY } from './components/Tutorial'
import InstallPrompt from './components/InstallPrompt'
import { ShimmerButton } from './ui/shimmer-button'
import { cn } from './lib/utils'

const NEAR_ME_RADIUS_KM = 5

// Mobile browsers discard a backgrounded tab, so add-mode state (which lives only
// in memory) is lost the moment a user switches apps — e.g. to look up a plant's
// name — and returns to a reset map with their placed pin gone. Persist the draft
// pin so it survives that round trip and the add form reopens where they left it.
const DRAFT_STORAGE_KEY = 'florafind_add_draft'

function loadDraftPosition() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng }
    }
  } catch {
    // Ignore malformed/unavailable storage; just start without a restored draft.
  }
  return null
}

// A floating map panel (form / details / export). Rounded card with a travelling
// border beam; top-right on desktop, a bottom card on mobile.
//
// On mobile it must clear the collapsed MobileBottomBar (grab handle + search +
// nav row, ~135px tall, fixed at bottom-0 z-40). Anchoring the bottom edge above
// that band — plus z-50 so the panel always wins the stacking order — keeps the
// form's footer (Save / Cancel) reachable instead of hidden behind the search bar.
function FloatingPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="beam-border absolute inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 flex max-h-[62vh] flex-col overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-card dark:border-white/10 dark:bg-[#12241a] md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:z-40 md:max-h-[68vh] md:w-[360px]"
    >
      {/* Scroll on an inner wrapper, not on the beam-border element itself: the
          beam's absolutely-positioned ::before would otherwise scroll with the
          content and leave a stray border edge stranded mid-card. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </motion.div>
  )
}

export default function App() {
  const { user, logout } = useAuth()
  const { t, name: plantName } = useI18n()

  const [trees, setTrees] = useState([])
  const [areas, setAreas] = useState([])
  const [fruitTypes, setFruitTypes] = useState([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [fruitFilter, setFruitFilter] = useState('')
  const [ripeNow, setRipeNow] = useState(false)
  const [layerView, setLayerView] = useState('all') // 'all' | 'plants' | 'areas'
  const [nearMe, setNearMe] = useState(null) // {lat, lng} | null
  const [locating, setLocating] = useState(false)
  const [selectedTree, setSelectedTree] = useState(null)
  const [selectedArea, setSelectedArea] = useState(null)
  const [panTarget, setPanTarget] = useState(null)

  const [authModal, setAuthModal] = useState(null) // 'login' | 'register' | null
  // Restore a persisted draft pin (if any) so add-mode survives an app switch.
  const [addMode, setAddMode] = useState(() => loadDraftPosition() !== null)
  const [draftPosition, setDraftPosition] = useState(loadDraftPosition)
  const [editingTree, setEditingTree] = useState(null)
  const [editingArea, setEditingArea] = useState(null)
  const [notice, setNotice] = useState(null)
  const [selectingArea, setSelectingArea] = useState(false)
  const [exportArea, setExportArea] = useState(null)
  const [drawingArea, setDrawingArea] = useState(false)
  const [draftPolygon, setDraftPolygon] = useState([]) // [{lat, lng}]
  const [areaFormOpen, setAreaFormOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [profileUserId, setProfileUserId] = useState(null)

  const showPlants = layerView !== 'areas'
  const showAreas = layerView !== 'plants'

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

  const refreshAreas = useCallback(async () => {
    const params = {
      q: searchText || undefined,
      category: categoryFilter || undefined,
      fruit_type: fruitFilter || undefined,
      ripe_now: ripeNow || undefined,
    }
    const bounds = boundsRef.current
    // Areas have no radius search; follow the viewport like trees do, except
    // during a text search (which is global) or a near-me lookup.
    if (!nearMe && bounds && !searchText) {
      params.min_lat = bounds.south
      params.max_lat = bounds.north
      params.min_lng = bounds.west
      params.max_lng = bounds.east
    }
    try {
      setAreas(await api.listAreas(params))
    } catch (err) {
      console.error('Failed to load areas', err)
    }
  }, [searchText, categoryFilter, fruitFilter, ripeNow, nearMe])

  useEffect(() => {
    refreshTrees()
    refreshAreas()
  }, [refreshTrees, refreshAreas])

  useEffect(() => {
    api.fruitTypes(categoryFilter || undefined).then(setFruitTypes).catch(() => {})
    setFruitFilter('')
  }, [categoryFilter])

  // On first mount, recentre the map on a restored draft pin so a returning user
  // lands where they placed it rather than at the default map view.
  useEffect(() => {
    const draft = loadDraftPosition()
    if (draft) setPanTarget({ ...draft, ts: Date.now() })
  }, [])

  // Keep the persisted draft in sync: store it while a pin is placed, clear it
  // once the user leaves add-mode, cancels, or saves the plant.
  useEffect(() => {
    try {
      if (addMode && draftPosition) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPosition))
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
      }
    } catch {
      // Storage may be unavailable (private mode); persistence is best-effort.
    }
  }, [addMode, draftPosition])

  // First-visit onboarding: launch the interactive tour once the layout has
  // settled so the spotlight can find its targets. Runs only until dismissed.
  useEffect(() => {
    if (localStorage.getItem(TOUR_DONE_KEY) === '1') return
    const timer = setTimeout(() => setTourOpen(true), 700)
    return () => clearTimeout(timer)
  }, [])

  // Drop a selection when its layer is hidden so no stray popup lingers.
  useEffect(() => {
    if (!showPlants) setSelectedTree(null)
    if (!showAreas) setSelectedArea(null)
  }, [showPlants, showAreas])

  const handleBoundsChanged = useCallback(
    (bounds) => {
      boundsRef.current = bounds
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        refreshTrees()
        refreshAreas()
      }, 400)
    },
    [refreshTrees, refreshAreas],
  )

  function showNotice(message) {
    setNotice(message)
    setTimeout(() => setNotice(null), 4000)
  }

  function cancelDrawArea() {
    setDrawingArea(false)
    setDraftPolygon([])
    setAreaFormOpen(false)
  }

  function startAddMode() {
    if (!user) {
      setAuthModal('login')
      return
    }
    setSelectingArea(false)
    cancelDrawArea()
    setAddMode(true)
    setSelectedTree(null)
    setSelectedArea(null)
    setEditingTree(null)
    setEditingArea(null)
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
    cancelDrawArea()
    setExportArea(null)
    setSelectingArea(true)
    showNotice(t('dragToSelectNotice'))
  }

  function handleAreaSelected(area) {
    setSelectingArea(false)
    setExportArea(area)
  }

  function startDrawArea() {
    if (!user) {
      setAuthModal('login')
      return
    }
    setAddMode(false)
    setDraftPosition(null)
    setSelectingArea(false)
    setExportArea(null)
    setSelectedTree(null)
    setSelectedArea(null)
    setEditingTree(null)
    setEditingArea(null)
    setDraftPolygon([])
    setAreaFormOpen(false)
    setDrawingArea(true)
    showNotice(t('drawAreaNotice'))
  }

  function toggleDrawArea() {
    if (drawingArea || areaFormOpen) {
      cancelDrawArea()
    } else {
      startDrawArea()
    }
  }

  function undoDraftPoint() {
    setDraftPolygon((current) => current.slice(0, -1))
  }

  function finishDrawArea() {
    if (draftPolygon.length < 3) return
    setDrawingArea(false)
    setAreaFormOpen(true)
  }

  function selectArea(id) {
    if (id == null) {
      setSelectedArea(null)
      return
    }
    const area = areas.find((entry) => entry.id === id)
    if (area) {
      setSelectedArea(area)
      setSelectedTree(null)
    }
  }

  function handleMapClick(latLng) {
    if (drawingArea) {
      setDraftPolygon((current) => [...current, latLng])
    } else if (addMode) {
      setDraftPosition(latLng)
    } else {
      setSelectedTree(null)
      setSelectedArea(null)
    }
  }

  // Dragging the draft pin to fine-tune placement — the key to precise spots when
  // several plants sit close together along a path.
  function handleDraftMove(latLng) {
    setDraftPosition(latLng)
  }

  // Drop the draft pin at the device's GPS position (high accuracy). Placing a
  // plant right where you're standing beats eyeballing a tap on the map, which is
  // what makes walked routes come out zig-zagged.
  function placeAtMyLocation() {
    if (!user) {
      setAuthModal('login')
      return
    }
    if (!navigator.geolocation) {
      showNotice(t('geolocationUnsupported'))
      return
    }
    if (!addMode) startAddMode()
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setLocating(false)
        setAddMode(true)
        setDraftPosition(location)
        setPanTarget({ ...location, ts: Date.now() })
        const acc = Math.round(position.coords.accuracy ?? 0)
        showNotice(t('locationPlaced', { acc }))
      },
      (err) => {
        setLocating(false)
        showNotice(t('locationError', { message: err.message }))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  function openProfile(userId) {
    if (userId == null) return
    // Give the catalog the floating panel to itself.
    setAddMode(false)
    setDraftPosition(null)
    setEditingTree(null)
    setEditingArea(null)
    setExportArea(null)
    setAreaFormOpen(false)
    setProfileUserId(userId)
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

  async function handleUpdate(payload, newPhotos = [], removedPhotoIds = []) {
    const treeId = editingTree.id
    const updated = await api.updateTree(treeId, payload)
    let photos = (updated.photos ?? []).filter((photo) => !removedPhotoIds.includes(photo.id))
    let message = t('plantUpdated')
    for (const photoId of removedPhotoIds) {
      try {
        await api.deletePhoto(treeId, photoId)
      } catch (err) {
        message = t('photoUploadFailed', { message: err.message })
      }
    }
    if (newPhotos.length) {
      try {
        photos = [...photos, ...(await api.uploadPhotos(treeId, newPhotos))]
      } catch (err) {
        message = t('photoUploadFailed', { message: err.message })
      }
    }
    setEditingTree(null)
    setSelectedTree({ ...updated, photos })
    showNotice(message)
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

  async function handleCreateArea(payload) {
    const created = await api.createArea(payload)
    setAreaFormOpen(false)
    setDraftPolygon([])
    setSelectedTree(null)
    setSelectedArea(created)
    showNotice(t('areaSavedNotice', { name: created.name }))
    refreshAreas()
  }

  async function handleUpdateArea(payload) {
    const updated = await api.updateArea(editingArea.id, payload)
    setEditingArea(null)
    setSelectedArea(updated)
    showNotice(t('areaUpdated'))
    refreshAreas()
  }

  async function handleDeleteArea() {
    if (!window.confirm(t('confirmDelete', { name: plantName(selectedArea.name) }))) return
    try {
      await api.deleteArea(selectedArea.id)
      setSelectedArea(null)
      showNotice(t('areaDeleted'))
      refreshAreas()
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
    layerView,
    setLayerView,
  }

  const visibleTrees = showPlants ? trees : []
  const visibleAreas = showAreas ? areas : []

  return (
    <div className="flex h-full flex-col bg-forest-50 dark:bg-[#0e1f14]">
      <TopNav
        filterProps={filterProps}
        onLogin={() => setAuthModal('login')}
        onRegister={() => setAuthModal('register')}
        onHelp={() => setTourOpen(true)}
        onOpenProfile={openProfile}
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
            <ShimmerButton data-tour="register" className="w-full" onClick={startAddMode}>
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
            data-tour="near-me"
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
          <button
            type="button"
            onClick={toggleDrawArea}
            className={cn(
              'w-full rounded-full border px-4 py-2 text-sm font-semibold transition',
              drawingArea || areaFormOpen
                ? 'border-forest-600 bg-forest-600 text-white shadow-glow'
                : 'border-forest-200 bg-white text-forest-700 hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10',
            )}
          >
            {drawingArea || areaFormOpen ? `× ${t('cancelArea')}` : t('drawArea')}
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
            trees={visibleTrees}
            selectedTree={selectedTree}
            onSelect={selectFromList}
            countSuffix={countSuffix}
          />
        </aside>

        {/* Map */}
        <main className="relative min-w-0 flex-1">
          <MapView
            trees={visibleTrees}
            selectedTree={selectedTree}
            onSelectTree={(tree) => {
              setSelectedArea(null)
              setSelectedTree((cur) => (tree && cur?.id === tree.id ? null : tree))
            }}
            addMode={addMode}
            draftPosition={draftPosition}
            onMapClick={handleMapClick}
            onDraftMove={handleDraftMove}
            onBoundsChanged={handleBoundsChanged}
            panTarget={panTarget}
            userPosition={nearMe}
            selectingArea={selectingArea}
            onAreaSelected={handleAreaSelected}
            onAreaCancel={() => setSelectingArea(false)}
            areas={visibleAreas}
            selectedArea={selectedArea}
            onSelectArea={selectArea}
            drawingArea={drawingArea}
            draftPolygon={draftPolygon}
            areaDetails={
              selectedArea && (
                <AreaDetails
                  area={selectedArea}
                  currentUser={user}
                  onEdit={() => {
                    setSelectedArea(null)
                    setEditingArea(selectedArea)
                  }}
                  onDelete={handleDeleteArea}
                />
              )
            }
          >
            {selectedTree && (
              <TreeDetails
                tree={selectedTree}
                currentUser={user}
                onEdit={() => {
                  // Close the map popup so the full-screen edit sheet is the only
                  // surface up (mirrors the area-edit flow); otherwise the popup
                  // can paint over the sheet and hide it.
                  setSelectedTree(null)
                  setEditingTree(selectedTree)
                }}
                onDelete={handleDelete}
                onConfirm={handleConfirm}
                onOpenProfile={openProfile}
              />
            )}
          </MapView>

          {/* Drawing toolbar while placing an area's vertices. */}
          <AnimatePresence>
            {drawingArea && (
              <motion.div
                key="draw-toolbar"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute inset-x-3 top-3 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-forest-100 bg-white/95 px-3 py-2 shadow-card backdrop-blur dark:border-white/10 dark:bg-[#12241a]/95"
              >
                <span className="px-1 text-xs font-medium text-forest-700 dark:text-forest-100">
                  {t('drawAreaProgress', { count: draftPolygon.length })}
                </span>
                <button
                  type="button"
                  onClick={undoDraftPoint}
                  disabled={draftPolygon.length === 0}
                  className="rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-700 transition hover:bg-forest-50 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-forest-100"
                >
                  {t('undoPoint')}
                </button>
                <button
                  type="button"
                  onClick={finishDrawArea}
                  disabled={draftPolygon.length < 3}
                  className="rounded-full bg-forest-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-forest-700 disabled:opacity-40"
                >
                  {t('finishArea')}
                </button>
                <button
                  type="button"
                  onClick={cancelDrawArea}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                >
                  {t('cancel')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* While placing a plant: a GPS shortcut + drag hint so pins land on the
              exact spot instead of an eyeballed tap. */}
          <AnimatePresence>
            {addMode && (
              <motion.div
                key="place-toolbar"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute inset-x-3 top-3 z-30 mx-auto flex w-fit max-w-full flex-col items-center gap-1.5 rounded-2xl border border-forest-100 bg-white/95 px-3 py-2 shadow-card backdrop-blur dark:border-white/10 dark:bg-[#12241a]/95"
              >
                <button
                  type="button"
                  onClick={placeAtMyLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-60"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8Z" />
                  </svg>
                  {locating ? t('locating') : t('useMyLocation')}
                </button>
                <span className="px-1 text-center text-[11px] font-medium leading-tight text-forest-600 dark:text-forest-200">
                  {draftPosition ? t('dragPinHint') : t('clickToPlace')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop map appearance control */}
          <div className="absolute right-3 top-3 z-20 hidden md:block">
            <MapSettingsControl />
          </div>

          <AnimatePresence>
            {/* The add/edit plant form gets its own full-viewport sheet on mobile
                (a standalone scroll surface — no map or bottom bar behind it to
                catch a stray swipe); on desktop it stays a floating card. */}
            {addMode && draftPosition && (
              <PlantFormSheet
                key="add-form"
                title={t('registerPlant')}
                onClose={() => setDraftPosition(null)}
              >
                <TreeForm
                  position={draftPosition}
                  onSubmit={handleCreate}
                  onCancel={() => setDraftPosition(null)}
                />
              </PlantFormSheet>
            )}
            {editingTree && (
              <PlantFormSheet
                key="edit-form"
                title={t('editPlant')}
                onClose={() => setEditingTree(null)}
              >
                <TreeForm
                  position={{ lat: editingTree.lat, lng: editingTree.lng }}
                  initial={editingTree}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingTree(null)}
                />
              </PlantFormSheet>
            )}
            {exportArea && (
              <FloatingPanel key="export-panel">
                <ExportPanel area={exportArea} onClose={() => setExportArea(null)} onNotice={showNotice} />
              </FloatingPanel>
            )}
            {areaFormOpen && (
              <FloatingPanel key="area-form">
                <TreeForm
                  variant="area"
                  polygon={draftPolygon.map((point) => [point.lng, point.lat])}
                  onSubmit={handleCreateArea}
                  onCancel={cancelDrawArea}
                />
              </FloatingPanel>
            )}
            {editingArea && (
              <FloatingPanel key="area-edit-form">
                <TreeForm
                  variant="area"
                  initial={editingArea}
                  polygon={editingArea.polygon}
                  onSubmit={handleUpdateArea}
                  onCancel={() => setEditingArea(null)}
                />
              </FloatingPanel>
            )}
            {profileUserId != null && (
              <FloatingPanel key="profile-panel">
                <ProfilePanel userId={profileUserId} onClose={() => setProfileUserId(null)} />
              </FloatingPanel>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-none absolute bottom-24 left-1/2 z-40 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-2xl bg-forest-700 px-5 py-2.5 text-center text-sm font-medium text-white shadow-card md:bottom-6"
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      </div>

      {/* Mobile: one melded bar — search + nav + the pull-up plant list. */}
      <MobileBottomBar
        trees={visibleTrees}
        selectedTree={selectedTree}
        onSelectTree={selectFromList}
        countSuffix={countSuffix}
        user={user}
        onLogin={() => setAuthModal('login')}
        onLogout={logout}
        onOpenProfile={openProfile}
        addMode={addMode}
        onToggleAdd={toggleAddMode}
        nearMe={nearMe}
        locating={locating}
        onNearMe={handleNearMe}
        isAdmin={!!user?.is_admin}
        selectingArea={selectingArea}
        onToggleExport={toggleSelectArea}
        drawingArea={drawingArea || areaFormOpen}
        onToggleDraw={toggleDrawArea}
        filterProps={filterProps}
        onHelp={() => setTourOpen(true)}
      />

      {/* Keep the install banner out of the way while the guided tour is up —
          the tour's final step has its own install call-to-action. */}
      {!tourOpen && <InstallPrompt />}
      <Tutorial open={tourOpen} onClose={() => setTourOpen(false)} />

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  )
}
