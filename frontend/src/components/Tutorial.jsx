import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { usePwa } from '../PwaContext'
import { cn } from '../lib/utils'

export const TOUR_DONE_KEY = 'florafind_tour_done'

// Each step optionally points at an on-screen element via a `data-tour` attribute.
// Because the same logical control lives in different places on desktop vs mobile
// (and some sit inside collapsed drawers), we tag every candidate with the same
// `data-tour` value and, at runtime, spotlight whichever one is actually visible.
// A step with no `target` renders as a centred card.
const STEPS = [
  { id: 'welcome', titleKey: 'tourWelcomeTitle', bodyKey: 'tourWelcomeBody' },
  { id: 'search', target: 'search', titleKey: 'tourSearchTitle', bodyKey: 'tourSearchBody' },
  { id: 'register', target: 'register', titleKey: 'tourRegisterTitle', bodyKey: 'tourRegisterBody' },
  { id: 'near-me', target: 'near-me', titleKey: 'tourNearMeTitle', bodyKey: 'tourNearMeBody' },
  { id: 'filters', target: 'filters', titleKey: 'tourFiltersTitle', bodyKey: 'tourFiltersBody' },
  { id: 'finish', titleKey: 'tourFinishTitle', bodyKey: 'tourFinishBody' },
]

const PAD = 8 // spotlight padding around the target
const GAP = 14 // gap between spotlight and card
const MARGIN = 12 // viewport edge margin

// First on-screen element carrying data-tour="name" that has real dimensions.
function findVisibleTarget(name) {
  const els = document.querySelectorAll(`[data-tour="${name}"]`)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

// Walk from `index` in `dir` (+1/-1) to the next step that can actually render:
// a centred step, or a targeted step whose element is visible. Returns -1 if none.
function resolveStep(index, dir) {
  let i = index
  while (i >= 0 && i < STEPS.length) {
    const step = STEPS[i]
    if (!step.target || findVisibleTarget(step.target)) return i
    i += dir
  }
  return -1
}

function computeCardPosition(rect, size, vw, vh) {
  if (!rect) {
    return { left: Math.max(MARGIN, (vw - size.w) / 2), top: Math.max(MARGIN, (vh - size.h) / 2) }
  }
  const below = rect.bottom + GAP
  const above = rect.top - GAP - size.h
  let top
  if (below + size.h <= vh - MARGIN) top = below
  else if (above >= MARGIN) top = above
  else top = Math.min(Math.max(MARGIN, vh - size.h - MARGIN), Math.max(MARGIN, below))
  let left = rect.left + rect.width / 2 - size.w / 2
  left = Math.min(Math.max(MARGIN, left), vw - size.w - MARGIN)
  return { left, top }
}

export default function Tutorial({ open, onClose }) {
  const { t } = useI18n()
  const { installable, promptInstall, canPromptInstall } = usePwa()

  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardSize, setCardSize] = useState({ w: 320, h: 200 })
  const cardRef = useRef(null)

  const step = STEPS[index]

  // Recompute the spotlight rect for the current step, tracking layout changes.
  const syncRect = useCallback(() => {
    const current = STEPS[index]
    if (!current?.target) {
      setRect(null)
      return
    }
    const el = findVisibleTarget(current.target)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom, right: r.right })
  }, [index])

  // Reset to the first renderable step whenever the tour opens.
  useEffect(() => {
    if (!open) return
    const first = resolveStep(0, 1)
    setIndex(first === -1 ? 0 : first)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    syncRect()
  }, [open, index, syncRect])

  useEffect(() => {
    if (!open) return
    const handler = () => syncRect()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open, syncRect])

  // Measure the card so we can place it without overflowing the viewport.
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return
    const measure = () => {
      const r = cardRef.current?.getBoundingClientRect()
      if (r) setCardSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [open, index])

  // Lock body scroll while the tour is up.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_DONE_KEY, '1')
    onClose()
  }, [onClose])

  const goNext = useCallback(() => {
    const next = resolveStep(index + 1, 1)
    if (next === -1) finish()
    else setIndex(next)
  }, [index, finish])

  const goBack = useCallback(() => {
    const prev = resolveStep(index - 1, -1)
    if (prev !== -1) setIndex(prev)
  }, [index])

  // Keyboard: arrows navigate, Escape skips.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, finish, goNext, goBack])

  if (!open || !step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardPos = computeCardPosition(rect, cardSize, vw, vh)
  const isLast = resolveStep(index + 1, 1) === -1
  const isFirst = resolveStep(index - 1, -1) === -1
  const stepNumber = index + 1

  async function handleInstall() {
    if (canPromptInstall) await promptInstall()
    finish()
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t('helpTitle')}>
      {/* Dim + spotlight. The box-shadow spread darkens everything outside the
          highlighted rect; a transparent backdrop below it swallows stray taps. */}
      <div className="absolute inset-0" />
      <AnimatePresence>
        {rect ? (
          <motion.div
            key="spot"
            initial={false}
            animate={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90"
            style={{ boxShadow: '0 0 0 9999px rgba(8, 22, 12, 0.66)' }}
          />
        ) : (
          <div className="absolute inset-0 bg-[rgba(8,22,12,0.66)]" />
        )}
      </AnimatePresence>

      {/* Coach-mark card. Positioning lives on an outer wrapper so it can't be
          clobbered by the inline `transform` Framer Motion writes for the card's
          scale animation. Centred steps (no target) use flex centring and never
          depend on a measured width; targeted steps are placed by computed
          left/top next to the spotlight. */}
      <div
        className={cn(
          'pointer-events-none absolute',
          rect ? '' : 'inset-0 flex items-center justify-center p-3',
        )}
        style={rect ? { left: cardPos.left, top: cardPos.top } : undefined}
      >
      <motion.div
        ref={cardRef}
        key={step.id}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-forest-100 bg-white p-5 shadow-card dark:border-white/10 dark:bg-[#12241a]"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-forest-500 dark:text-forest-300">
            {t('tourStepOf', { current: stepNumber, total: STEPS.length })}
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-2 py-1 text-xs font-medium text-forest-500 transition hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-white/5"
          >
            {t('tourSkip')}
          </button>
        </div>

        <h3 className="text-lg font-bold text-forest-800 dark:text-forest-50">{t(step.titleKey)}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-forest-600 dark:text-forest-200">{t(step.bodyKey)}</p>

        {isLast && installable && (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 w-full rounded-full border border-forest-200 bg-forest-50 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-100 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10"
          >
            {t('tourInstallCta')}
          </button>
        )}

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-4 bg-forest-600' : 'w-1.5 bg-forest-200 dark:bg-white/20',
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirst}
            className="rounded-full px-3 py-2 text-sm font-medium text-forest-600 transition enabled:hover:bg-forest-50 disabled:opacity-0 dark:text-forest-300 dark:enabled:hover:bg-white/5"
          >
            {t('tourBack')}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700"
          >
            {isLast ? t('tourDone') : t('tourNext')}
          </button>
        </div>
      </motion.div>
      </div>
    </div>
  )
}
