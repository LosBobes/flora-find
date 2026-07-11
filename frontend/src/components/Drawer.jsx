import { useEffect } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { cn } from '../lib/utils'

// A modal bottom drawer for mobile. Slides up from the bottom edge, full-width,
// behind a dimmed backdrop, with a grab handle you can drag down to dismiss.
// Replaces the floating popups that used to clip off narrow phone screens.
// Only the handle/header starts a drag, so the scrollable body scrolls freely.
export default function Drawer({ open, title, onClose, children }) {
  const dragControls = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-forest-900/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(event, info) => {
              if (info.velocity.y > 400 || info.offset.y > 120) onClose()
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl border border-forest-100 bg-white shadow-card dark:border-white/10 dark:bg-[#12241a]"
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-3 pt-3 active:cursor-grabbing"
            >
              <span className="h-1.5 w-10 rounded-full bg-forest-200 dark:bg-white/20" />
              <div className="flex w-full items-center justify-between px-5 pb-1">
                <p className="text-base font-bold text-forest-800 dark:text-forest-50">{title}</p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={title ? `Close ${title}` : 'Close'}
                  className="grid size-8 place-items-center rounded-full text-forest-500 transition hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-white/5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pt-2', 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]')}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
