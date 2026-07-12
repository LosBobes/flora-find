import { useEffect } from 'react'
import { motion } from 'motion/react'

// A standalone, full-viewport home for the add/edit plant form on phones.
//
// The plant form is the tallest surface in the app. Shown as a floating card
// over the live map (see FloatingPanel), its inner scroll could "leak" to the
// map or the bottom bar sitting behind it once it reached the top/bottom edge —
// the mis-scroll users hit. Here it gets its own fixed layer that covers the
// whole screen (above the map and the MobileBottomBar) with a single, contained
// scroll region, so there is nothing behind it for a stray swipe to grab.
//
// On desktop, where there is no touch mis-scroll, it collapses back to the same
// floating top-right card the other panels use. Rendered inside the parent's
// <AnimatePresence> with a key, exactly like FloatingPanel, so enter/exit is
// driven from App and children only mount while their data exists.
export default function PlantFormSheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#12241a] md:absolute md:inset-auto md:right-3 md:top-3 md:z-40 md:max-h-[68vh] md:w-[360px] md:overflow-hidden md:rounded-2xl md:border md:border-forest-100 md:shadow-card md:dark:border-white/10"
    >
      {/* Mobile-only header: a clear way out that doesn't require scrolling all
          the way down to the form's footer. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-forest-100 px-3 py-2.5 dark:border-white/10 md:hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label={title ? `Close ${title}` : 'Close'}
          className="grid size-9 place-items-center rounded-full text-forest-600 transition hover:bg-forest-50 dark:text-forest-200 dark:hover:bg-white/5"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-base font-bold text-forest-800 dark:text-forest-50">{title}</span>
      </div>
      {/* The single scroll region. `overscroll-contain` keeps a swipe that hits an
          edge from chaining anywhere else. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-5 md:pb-5">
        {children}
      </div>
    </motion.div>
  )
}
