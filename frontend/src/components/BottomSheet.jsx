import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'motion/react'

// A draggable bottom sheet for mobile. Collapsed it shows only its peek header
// (a grab handle); dragged or tapped up it expands to reveal its children.
// It sits above the floating dock (which App renders separately).
export default function BottomSheet({ children }) {
  const sheetRef = useRef(null)
  const peekRef = useRef(null)
  const controls = useAnimationControls()
  const [collapsedY, setCollapsedY] = useState(360)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const sheetH = sheetRef.current?.offsetHeight ?? 0
      const peekH = peekRef.current?.offsetHeight ?? 64
      setCollapsedY(Math.max(0, sheetH - peekH))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    controls.start({ y: expanded ? 0 : collapsedY, transition: { type: 'spring', stiffness: 320, damping: 34 } })
  }, [expanded, collapsedY, controls])

  return (
    <motion.div
      ref={sheetRef}
      drag="y"
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
      className="fixed inset-x-0 bottom-0 z-30 flex h-[74vh] flex-col rounded-t-3xl border border-forest-100 bg-white shadow-card dark:border-white/10 dark:bg-[#0e1f14] md:hidden"
    >
      <button
        ref={peekRef}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex shrink-0 flex-col items-center gap-1 py-3"
        aria-label="Toggle plant list"
      >
        <span className="h-1.5 w-10 rounded-full bg-forest-200 dark:bg-white/20" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-28">{children}</div>
    </motion.div>
  )
}
