import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { usePwa } from '../PwaContext'
import { BrandMark } from '../icons'
import { cn } from '../lib/utils'

const DISMISS_KEY = 'florafind_install_dismissed'

function IconTile() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-600 shadow-glow ring-1 ring-inset ring-white/25">
      <BrandMark size={22} />
    </span>
  )
}

function ShareGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom">
      <path d="M12 3v13M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" strokeLinecap="round" />
    </svg>
  )
}

// A single positioned card that clears the mobile bottom bar and the desktop edge.
function Banner({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-x-3 bottom-[calc(9.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-forest-100 bg-white/95 p-4 shadow-card backdrop-blur-md dark:border-white/10 dark:bg-[#12241a]/95 md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-[420px]"
    >
      {children}
    </motion.div>
  )
}

export default function InstallPrompt() {
  const { t } = useI18n()
  const { installable, canPromptInstall, isIOS, promptInstall, updateReady, applySwUpdate } = usePwa()

  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [showIosSteps, setShowIosSteps] = useState(false)

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function handleInstall() {
    if (canPromptInstall) {
      const outcome = await promptInstall()
      if (outcome === 'accepted') dismiss()
      return
    }
    if (isIOS) setShowIosSteps((v) => !v)
  }

  // The update toast takes priority and ignores the dismissed flag.
  if (updateReady) {
    return (
      <AnimatePresence>
        <Banner>
          <div className="flex items-center gap-3">
            <IconTile />
            <p className="flex-1 text-sm font-medium text-forest-800 dark:text-forest-100">{t('updateReady')}</p>
            <button
              type="button"
              onClick={applySwUpdate}
              className="rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700"
            >
              {t('updateAction')}
            </button>
          </div>
        </Banner>
      </AnimatePresence>
    )
  }

  if (!installable || dismissed) return null

  return (
    <AnimatePresence>
      <Banner>
        <div className="flex items-start gap-3">
          <IconTile />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-forest-800 dark:text-forest-50">{t('installTitle')}</p>
            <p className="mt-0.5 text-sm text-forest-600 dark:text-forest-300">{t('installBody')}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('installLater')}
            className="grid size-7 shrink-0 place-items-center rounded-full text-forest-400 transition hover:bg-forest-50 dark:hover:bg-white/5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isIOS && showIosSteps && (
            <motion.ol
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 overflow-hidden rounded-xl bg-forest-50 p-3 text-sm text-forest-700 dark:bg-white/5 dark:text-forest-100"
            >
              <li className="mb-1 font-semibold text-forest-800 dark:text-forest-50">{t('installIosBody')}</li>
              <li className="flex items-center gap-2">
                <Step n={1} /> <span>{t('installIosStep1')} <ShareGlyph /></span>
              </li>
              <li className="flex items-center gap-2">
                <Step n={2} /> <span>{t('installIosStep2')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Step n={3} /> <span>{t('installIosStep3')}</span>
              </li>
            </motion.ol>
          )}
        </AnimatePresence>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full px-3 py-2 text-sm font-medium text-forest-600 transition hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-white/5"
          >
            {t('installLater')}
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700"
          >
            {isIOS ? (showIosSteps ? t('close') : t('installAction')) : t('installAction')}
          </button>
        </div>
      </Banner>
    </AnimatePresence>
  )
}

function Step({ n }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-forest-600 text-[11px] font-bold text-white">
      {n}
    </span>
  )
}
