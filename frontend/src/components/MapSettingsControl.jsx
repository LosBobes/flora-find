import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { MAP_THEMES, MARKER_SIZES, useMapSettings } from '../MapSettingsContext'
import { cn } from '../lib/utils'

function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="13.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1.5 3.3c.4.5.5 1.2.1 1.7A2 2 0 0 1 12 22Z" />
    </svg>
  )
}

// Floating control that lets each visitor tune the map look. `variant="button"`
// renders the trigger (used on desktop, top-right of the map); the dock passes
// `open`/`onToggle` to control it externally on mobile.
export default function MapSettingsControl({ open, onToggle, align = 'right' }) {
  const { t } = useI18n()
  const { theme, markerSize, showLabels, setTheme, setMarkerSize, toggleLabels } = useMapSettings()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : internalOpen
  const setOpen = (next) => (isControlled ? onToggle?.(next) : setInternalOpen(next))

  return (
    <div className="relative">
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(!isOpen)}
          title={t('mapSettings')}
          aria-label={t('mapSettings')}
          className={cn(
            'flex size-11 items-center justify-center rounded-full border border-forest-100 bg-white/90 text-forest-700 shadow-glow backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-[#12241a]/90 dark:text-forest-100 dark:hover:bg-[#12241a]',
            isOpen && 'ring-2 ring-forest-400',
          )}
        >
          <PaletteIcon />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'absolute z-30 mt-2 w-64 rounded-2xl border border-forest-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#12241a]',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-600 dark:text-forest-300">
              {t('mapTheme')}
            </p>
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
                      : 'border-forest-100 hover:bg-forest-50 dark:border-white/10 dark:text-forest-200 dark:hover:bg-white/5',
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

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-600 dark:text-forest-300">
              {t('markerSize')}
            </p>
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
                      : 'text-forest-600 hover:text-forest-800 dark:text-forest-300 dark:hover:text-forest-100',
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center justify-between text-sm font-medium text-forest-800 dark:text-forest-100">
              {t('showLabels')}
              <button
                type="button"
                role="switch"
                aria-checked={showLabels}
                onClick={toggleLabels}
                className={cn(
                  'relative h-6 w-11 rounded-full transition',
                  showLabels ? 'bg-forest-500' : 'bg-forest-200 dark:bg-white/20',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                    showLabels ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
