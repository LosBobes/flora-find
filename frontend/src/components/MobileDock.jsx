import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { Dock, DockIcon } from '../ui/dock'
import { MAP_THEMES, MARKER_SIZES, useMapSettings } from '../MapSettingsContext'
import Filters from './Filters'
import { cn } from '../lib/utils'

const ICONS = {
  add: (
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  ),
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
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
}

function Glyph({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {ICONS[name]}
    </svg>
  )
}

function DockButton({ name, label, active, onClick }) {
  return (
    <DockIcon
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'border shadow-glow backdrop-blur transition',
        active
          ? 'border-forest-600 bg-forest-600 text-white'
          : 'border-forest-100 bg-white/90 text-forest-700 dark:border-white/10 dark:bg-[#12241a]/90 dark:text-forest-100',
      )}
    >
      <Glyph name={name} />
    </DockIcon>
  )
}

function Panel({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="pointer-events-auto absolute bottom-full left-1/2 mb-3 w-[min(340px,92vw)] -translate-x-1/2 rounded-2xl border border-forest-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#12241a]"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-forest-800 dark:text-forest-50">{title}</p>
        <button type="button" onClick={onClose} aria-label="close" className="text-forest-500 dark:text-forest-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {ICONS.close}
          </svg>
        </button>
      </div>
      {children}
    </motion.div>
  )
}

export default function MobileDock({
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
  filterProps,
}) {
  const { t } = useI18n()
  const { theme, markerSize, showLabels, setTheme, setMarkerSize, toggleLabels } = useMapSettings()
  const [panel, setPanel] = useState(null) // 'settings' | 'filters' | 'account' | null
  const toggle = (name) => setPanel((current) => (current === name ? null : name))

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center md:hidden">
      <div className="pointer-events-auto relative">
        <AnimatePresence>
          {panel === 'settings' && (
            <Panel title={t('mapSettings')} onClose={() => setPanel(null)}>
              <div className="grid grid-cols-2 gap-2">
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
              <div className="mt-3 flex gap-1 rounded-xl bg-forest-50 p-1 dark:bg-white/5">
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
              <label className="mt-3 flex items-center justify-between text-sm font-medium text-forest-800 dark:text-forest-100">
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
            </Panel>
          )}
          {panel === 'filters' && (
            <Panel title={t('filters')} onClose={() => setPanel(null)}>
              <Filters variant="stack" {...filterProps} />
            </Panel>
          )}
          {panel === 'account' && (
            <Panel title={t('account')} onClose={() => setPanel(null)}>
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
            </Panel>
          )}
        </AnimatePresence>

        <Dock className="border border-forest-100 bg-white/70 px-3 py-2 shadow-card backdrop-blur-md dark:border-white/10 dark:bg-[#12241a]/80">
          <DockButton name="add" label={t('registerPlant')} active={addMode} onClick={onToggleAdd} />
          <DockButton
            name="location"
            label={t('nearMe')}
            active={!!nearMe || locating}
            onClick={onNearMe}
          />
          {isAdmin && (
            <DockButton
              name="export"
              label={t('exportArea')}
              active={selectingArea}
              onClick={onToggleExport}
            />
          )}
          <DockButton
            name="palette"
            label={t('mapSettings')}
            active={panel === 'settings'}
            onClick={() => toggle('settings')}
          />
          <DockButton
            name="sliders"
            label={t('filters')}
            active={panel === 'filters'}
            onClick={() => toggle('filters')}
          />
          <DockButton
            name="user"
            label={t('account')}
            active={panel === 'account'}
            onClick={() => toggle('account')}
          />
        </Dock>
      </div>
    </div>
  )
}
