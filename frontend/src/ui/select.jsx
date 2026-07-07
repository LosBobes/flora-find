import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { cn } from '../lib/utils'

function Chevron({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn('shrink-0 text-forest-400 transition-transform duration-200', open && 'rotate-180')}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A styled, animated dropdown that replaces native <select>. Options are
// [{ value, label, disabled }]. The menu renders in a portal at fixed
// coordinates so it is never clipped by a scrolling parent panel.
export function Select({ value, onChange, options, placeholder, className, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const selected = options.find((o) => o.value === value && !o.disabled)
  const label = selected ? selected.label : placeholder ?? ''

  useLayoutEffect(() => {
    if (!open) return undefined
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setRect({ left: r.left, top: r.bottom + 6, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-forest-100 bg-white px-3 py-2 text-left text-sm text-forest-900 shadow-sm outline-none transition hover:border-forest-300 focus:border-forest-400 focus:ring-2 focus:ring-forest-200',
          'dark:border-white/10 dark:bg-white/5 dark:text-forest-50 dark:hover:border-white/25',
          open && 'border-forest-400 ring-2 ring-forest-200 dark:border-forest-300',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-forest-400')}>{label}</span>
        <Chevron open={open} />
      </button>

      {open &&
        rect &&
        createPortal(
          <motion.div
            ref={panelRef}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, zIndex: 60 }}
            className="max-h-64 overflow-y-auto rounded-xl border border-forest-100 bg-white p-1 shadow-card dark:border-white/10 dark:bg-[#16281d]"
          >
              {options.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                      opt.disabled
                        ? 'cursor-default text-forest-400 dark:text-forest-500'
                        : isSelected
                          ? 'bg-forest-50 font-semibold text-forest-800 dark:bg-white/10 dark:text-forest-50'
                          : 'text-forest-700 hover:bg-forest-50 dark:text-forest-100 dark:hover:bg-white/5',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && !opt.disabled && (
                      <span className="text-forest-600">
                        <Check />
                      </span>
                    )}
                  </button>
                )
              })}
          </motion.div>,
          document.body,
        )}
    </>
  )
}
