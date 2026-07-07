import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const int = parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

// Magic UI Particles: a canvas of drifting dots that gently repel the cursor.
export function Particles({
  className,
  quantity = 60,
  staticity = 50,
  ease = 50,
  size = 0.5,
  color = '#2e7d32',
  vx = 0,
  vy = 0,
  ...props
}) {
  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const context = useRef(null)
  const circles = useRef([])
  const mouse = useRef({ x: 0, y: 0 })
  const canvasSize = useRef({ w: 0, h: 0 })
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const rafID = useRef(null)
  const [rgb] = useState(() => hexToRgb(color))

  const circleParams = useCallback(() => {
    const x = Math.floor(Math.random() * canvasSize.current.w)
    const y = Math.floor(Math.random() * canvasSize.current.h)
    const pSize = Math.floor(Math.random() * 2) + size
    return {
      x,
      y,
      translateX: 0,
      translateY: 0,
      size: pSize,
      alpha: 0,
      targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    }
  }, [size])

  const drawCircle = useCallback(
    (circle, update = false) => {
      if (!context.current) return
      const { x, y, translateX, translateY, size: s, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, s, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.join(', ')}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!update) circles.current.push(circle)
    },
    [dpr, rgb],
  )

  const clearContext = useCallback(() => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    if (!canvasContainerRef.current || !canvasRef.current || !context.current) return
    canvasSize.current.w = canvasContainerRef.current.offsetWidth
    canvasSize.current.h = canvasContainerRef.current.offsetHeight
    canvasRef.current.width = canvasSize.current.w * dpr
    canvasRef.current.height = canvasSize.current.h * dpr
    canvasRef.current.style.width = `${canvasSize.current.w}px`
    canvasRef.current.style.height = `${canvasSize.current.h}px`
    context.current.scale(dpr, dpr)
    circles.current = []
    for (let i = 0; i < quantity; i += 1) drawCircle(circleParams())
  }, [circleParams, dpr, drawCircle, quantity])

  const remapValue = (value, start1, end1, start2, end2) => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2
    return remapped > 0 ? remapped : 0
  }

  const animate = useCallback(() => {
    clearContext()
    circles.current.forEach((circle, i) => {
      const edge = [
        circle.x + circle.translateX - circle.size,
        canvasSize.current.w - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        canvasSize.current.h - circle.y - circle.translateY - circle.size,
      ]
      const closestEdge = edge.reduce((a, b) => Math.min(a, b))
      const remapClosestEdge = parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2))
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02
        if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge
      }
      circle.x += circle.dx + vx
      circle.y += circle.dy + vy
      circle.translateX += (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease
      circle.translateY += (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease
      drawCircle(circle, true)
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current[i] = circleParams()
      }
    })
    rafID.current = window.requestAnimationFrame(animate)
  }, [circleParams, clearContext, drawCircle, ease, staticity, vx, vy])

  useEffect(() => {
    if (canvasRef.current) context.current = canvasRef.current.getContext('2d')
    resizeCanvas()
    animate()
    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)
    return () => {
      if (rafID.current != null) window.cancelAnimationFrame(rafID.current)
      window.removeEventListener('resize', onResize)
    }
  }, [animate, resizeCanvas])

  const onMouseMove = (event) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const { w, h } = canvasSize.current
    const x = event.clientX - rect.left - w / 2
    const y = event.clientY - rect.top - h / 2
    if (x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2) {
      mouse.current.x = x
      mouse.current.y = y
    }
  }

  return (
    <div
      ref={canvasContainerRef}
      className={cn('pointer-events-none', className)}
      onMouseMove={onMouseMove}
      aria-hidden="true"
      {...props}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  )
}
