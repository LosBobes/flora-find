import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

// A small styled tooltip. Rendered in a portal on document.body so it is never
// clipped by a card's `overflow-hidden`. It appears just above the cursor and
// follows it, growing upward from the pointer.
export function Tooltip({ label, children, className }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  if (!label) return children

  const track = (event) => setPos({ x: event.clientX, y: event.clientY })
  const hide = () => setPos(null)
  const focusShow = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }

  return (
    <>
      <span
        ref={ref}
        className={cn('inline-flex', className)}
        onMouseEnter={track}
        onMouseMove={track}
        onMouseLeave={hide}
        onFocus={focusShow}
        onBlur={hide}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: 'fixed', left: pos.x, top: pos.y - 12, transformOrigin: 'bottom center' }}
            className="pointer-events-none z-[1000] -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-90 slide-in-from-bottom-1 duration-100 ease-out"
          >
            <span className="relative block whitespace-nowrap rounded-lg bg-forest-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg dark:bg-white dark:text-forest-900">
              {label}
              <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-forest-900 dark:bg-white" />
            </span>
          </span>,
          document.body,
        )}
    </>
  )
}
