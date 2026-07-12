import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useDragControls } from 'motion/react'
import { useI18n, LANGUAGES } from '../i18n'
import { MAP_THEMES, MARKER_SIZES, useMapSettings } from '../MapSettingsContext'
import Filters from './Filters'
import Drawer from './Drawer'
import PlantList from './PlantList'
import { cn } from '../lib/utils'

const ICONS = {
  add: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  location: (
    <>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8Z" />
    </>
  ),
  palette: (
    <path d="M12 2a10 10 0 1 0 10 10c0-2-2-2.5-3.5-2.5H16a2 2 0 0 1-1.5-3.3A2 2 0 0 0 12 2Z" />
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="8" cy="18" r="2" fill="currentColor" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </>
  ),
  polygon: (
    <>
      <path d="M12 3 21 9l-3 10H6L3 9l9-6Z" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="1.4" fill="currentColor" />
      <circle cx="21" cy="9" r="1.4" fill="currentColor" />
      <circle cx="18" cy="19" r="1.4" fill="currentColor" />
      <circle cx="6" cy="19" r="1.4" fill="currentColor" />
      <circle cx="3" cy="9" r="1.4" fill="currentColor" />
    </>
  ),
}

function Glyph({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {ICONS[name]}
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  )
}

function BarButton({ name, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-2xl border transition active:scale-95',
        active
          ? 'border-forest-600 bg-forest-600 text-white shadow-glow'
          : 'border-forest-100 bg-white/80 text-forest-700 dark:border-white/10 dark:bg-white/5 dark:text-forest-100',
      )}
    >
      <Glyph name={name} />
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-600 dark:text-forest-300">
      {children}
    </p>
  )
}

// The single mobile bottom element: a draggable sheet whose always-visible header
// carries the search field and the nav icon row, and which expands upward to
// reveal the plant list. It replaces the old separate floating dock + bottom
// sheet so the two read as one melded surface rising from the bottom edge.
export default function MobileBottomBar({
  trees,
  selectedTree,
  onSelectTree,
  countSuffix,
  user,
  onLogin,
  onLogout,
  addMode,
  onToggleAdd,
  nearMe,
  locating,
  onNearMe,
  isAdmin,
  selectingArea,
  onToggleExport,
  drawingArea,
  onToggleDraw,
  filterProps,
}) {
  const { t, lang, setLang } = useI18n()
  const { searchText, setSearchText } = filterProps
  const { theme, markerSize, showLabels, setTheme, setMarkerSize, toggleLabels } = useMapSettings()

  const [panel, setPanel] = useState(null) // 'settings' | 'filters' | 'account' | null
  const toggle = (name) => setPanel((current) => (current === name ? null : name))

  const sheetRef = useRef(null)
  const headerRef = useRef(null)
  const controls = useAnimationControls()
  const dragControls = useDragControls()
  const [collapsedY, setCollapsedY] = useState(420)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const sheetH = sheetRef.current?.offsetHeight ?? 0
      const headerH = headerRef.current?.offsetHeight ?? 0
      setCollapsedY(Math.max(0, sheetH - headerH))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    controls.start({ y: expanded ? 0 : collapsedY, transition: { type: 'spring', stiffness: 320, damping: 34 } })
  }, [expanded, collapsedY, controls])

  return (
    <>
      <Drawer open={panel === 'settings'} title={t('mapSettings')} onClose={() => setPanel(null)}>
        <SectionLabel>{t('language')}</SectionLabel>
        <div className="mb-4 flex gap-1 rounded-xl bg-forest-50 p-1 dark:bg-white/5">
          {LANGUAGES.map((entry) => (
            <button
              key={entry.code}
              type="button"
              onClick={() => setLang(entry.code)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-sm font-semibold transition',
                lang === entry.code
                  ? 'bg-white text-forest-800 shadow-sm dark:bg-white/15 dark:text-forest-50'
                  : 'text-forest-600 dark:text-forest-300',
              )}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <SectionLabel>{t('mapTheme')}</SectionLabel>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {MAP_THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-2 text-left text-sm transition',
                theme === option.id
                  ? 'border-forest-500 bg-forest-50 font-semibold text-forest-800 dark:bg-white/10 dark:text-forest-50'
                  : 'border-forest-100 text-forest-700 dark:border-white/10 dark:text-forest-200',
              )}
            >
              <span
                className="size-5 shrink-0 rounded-full border border-black/10"
                style={{ background: option.swatch }}
              />
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <SectionLabel>{t('markerSize')}</SectionLabel>
        <div className="mb-4 flex gap-1 rounded-xl bg-forest-50 p-1 dark:bg-white/5">
          {MARKER_SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMarkerSize(option.id)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-sm font-medium transition',
                markerSize === option.id
                  ? 'bg-white text-forest-800 shadow-sm dark:bg-white/15 dark:text-forest-50'
                  : 'text-forest-600 dark:text-forest-300',
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between text-sm font-medium text-forest-800 dark:text-forest-100">
          {t('showLabels')}
          <button
            type="button"
            role="switch"
            aria-checked={showLabels}
            onClick={toggleLabels}
            className={cn('relative h-6 w-11 rounded-full transition', showLabels ? 'bg-forest-500' : 'bg-forest-200 dark:bg-white/20')}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                showLabels ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </button>
        </label>
      </Drawer>

      <Drawer open={panel === 'filters'} title={t('filters')} onClose={() => setPanel(null)}>
        <Filters variant="stack" {...filterProps} />
      </Drawer>

      <Drawer open={panel === 'account'} title={t('account')} onClose={() => setPanel(null)}>
        {user ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-forest-700 dark:text-forest-100">
              {t('hi', { username: user.username })}
            </p>
            <button
              type="button"
              onClick={() => {
                onLogout()
                setPanel(null)
              }}
              className="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm font-medium text-forest-700 dark:border-white/15 dark:bg-white/5 dark:text-forest-100"
            >
              {t('logOut')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onLogin()
              setPanel(null)
            }}
            className="w-full rounded-xl bg-forest-600 px-3 py-2 text-sm font-semibold text-white"
          >
            {t('logIn')}
          </button>
        )}
      </Drawer>

      <motion.div
        ref={sheetRef}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: collapsedY }}
        dragElastic={0.06}
        initial={false}
        animate={controls}
        onDragEnd={(event, info) => {
          const up = info.velocity.y < -300 || info.offset.y < -80
          const down = info.velocity.y > 300 || info.offset.y > 80
          if (up) setExpanded(true)
          else if (down) setExpanded(false)
          else controls.start({ y: expanded ? 0 : collapsedY })
        }}
        className="fixed inset-x-0 bottom-0 z-40 flex h-[80vh] flex-col rounded-t-3xl border border-forest-100 bg-white/95 shadow-card backdrop-blur-md dark:border-white/10 dark:bg-[#0e1f14]/95 md:hidden"
      >
        {/* Always-visible header: grab handle + search + nav. This is the band
            the map's PanToSelected keeps popups clear of (data attribute). */}
        <div ref={headerRef} data-map-bottom-chrome className="shrink-0 px-3 pb-3">
          <div
            onPointerDown={(event) => dragControls.start(event)}
            onClick={() => setExpanded((v) => !v)}
            className="flex cursor-grab touch-none flex-col items-center py-2.5 active:cursor-grabbing"
            aria-label={t('togglePlantList')}
          >
            <span className="h-1.5 w-10 rounded-full bg-forest-200 dark:bg-white/20" />
          </div>

          <div className="relative mb-2.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400">
              <SearchIcon />
            </span>
            <input
              className="w-full rounded-xl border border-forest-100 bg-white py-2.5 pl-10 pr-3 text-sm text-forest-900 shadow-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 dark:border-white/10 dark:bg-white/5 dark:text-forest-50 dark:placeholder-forest-300"
              placeholder={t('searchPlaceholder')}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <BarButton name="add" label={t('registerPlant')} active={addMode} onClick={onToggleAdd} />
            <BarButton
              name="polygon"
              label={t('drawArea')}
              active={drawingArea}
              onClick={onToggleDraw}
            />
            <BarButton
              name="location"
              label={t('nearMe')}
              active={!!nearMe || locating}
              onClick={onNearMe}
            />
            {isAdmin && (
              <BarButton
                name="export"
                label={t('exportArea')}
                active={selectingArea}
                onClick={onToggleExport}
              />
            )}
            <BarButton
              name="palette"
              label={t('mapSettings')}
              active={panel === 'settings'}
              onClick={() => toggle('settings')}
            />
            <BarButton
              name="sliders"
              label={t('filters')}
              active={panel === 'filters'}
              onClick={() => toggle('filters')}
            />
            <BarButton
              name="user"
              label={t('account')}
              active={panel === 'account'}
              onClick={() => toggle('account')}
            />
          </div>
        </div>

        {/* Expanded body: the plant list, revealed when the sheet is pulled up. */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-forest-100 px-4 pt-3 pb-28 dark:border-white/10">
          <PlantList
            trees={trees}
            selectedTree={selectedTree}
            onSelect={onSelectTree}
            countSuffix={countSuffix}
          />
        </div>
      </motion.div>
    </>
  )
}
