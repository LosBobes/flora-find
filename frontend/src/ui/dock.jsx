import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { cn } from '../lib/utils'

const DEFAULT_SIZE = 44
const DEFAULT_MAGNIFICATION = 66
const DEFAULT_DISTANCE = 140

// Magic UI Dock: a macOS-style row of icons that magnify near the cursor.
export const Dock = React.forwardRef(function Dock(
  {
    className,
    children,
    iconSize = DEFAULT_SIZE,
    iconMagnification = DEFAULT_MAGNIFICATION,
    iconDistance = DEFAULT_DISTANCE,
    ...props
  },
  ref,
) {
  const mouseX = useMotionValue(Infinity)
  const renderChildren = () =>
    React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === DockIcon) {
        return React.cloneElement(child, {
          mouseX,
          size: iconSize,
          magnification: iconMagnification,
          distance: iconDistance,
        })
      }
      return child
    })

  return (
    <motion.div
      ref={ref}
      onMouseMove={(event) => mouseX.set(event.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      {...props}
      className={cn('mx-auto flex w-max items-end gap-3 rounded-3xl', className)}
    >
      {renderChildren()}
    </motion.div>
  )
})

export function DockIcon({
  size = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className,
  children,
  ...props
}) {
  const ref = useRef(null)
  const padding = Math.max(6, size * 0.2)
  const defaultMouseX = useMotionValue(Infinity)

  const distanceCalc = useTransform(mouseX ?? defaultMouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })
  const sizeTransform = useTransform(distanceCalc, [-distance, 0, distance], [size, magnification, size])
  const scaleSize = useSpring(sizeTransform, { mass: 0.1, stiffness: 150, damping: 12 })

  return (
    <motion.div
      ref={ref}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn('flex aspect-square cursor-pointer items-center justify-center rounded-2xl', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
