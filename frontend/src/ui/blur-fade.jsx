import { useRef } from 'react'
import { motion, useInView } from 'motion/react'

// Magic UI BlurFade: fade + slide + de-blur entrance, optionally on scroll.
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 8,
  direction = 'down',
  inView = false,
  inViewMargin = '-40px',
  blur = '6px',
}) {
  const ref = useRef(null)
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y'
  const shift = direction === 'right' || direction === 'down' ? -offset : offset
  const defaultVariants = {
    hidden: { [axis]: shift, opacity: 0, filter: `blur(${blur})` },
    visible: { [axis]: 0, opacity: 1, filter: 'blur(0px)' },
  }
  const combinedVariants = variant || defaultVariants
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={combinedVariants}
      transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
