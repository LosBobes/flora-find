import { motion } from 'motion/react'
import { cn } from '../lib/utils'

// Magic UI BorderBeam: a light travelling around a rounded container's border.
// The parent must be `relative` and rounded; this fills it as an overlay.
export function BorderBeam({
  className,
  size = 60,
  delay = 0,
  duration = 6,
  colorFrom = '#5fa163',
  colorTo = '#2e7d32',
  transition,
  style,
  reverse = false,
  initialOffset = 0,
}) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={cn(
          'absolute aspect-square bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent',
          className,
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          ...style,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  )
}
