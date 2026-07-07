import { cn } from '../lib/utils'

// Magic UI AnimatedShinyText: a light sweeps across the text periodically.
export function AnimatedShinyText({ children, className, shimmerWidth = 100, ...props }) {
  return (
    <span
      style={{ '--shiny-width': `${shimmerWidth}px` }}
      className={cn(
        'animate-shiny-text bg-clip-text bg-no-repeat text-transparent [background-position:0_0] [background-size:var(--shiny-width)_100%]',
        'bg-gradient-to-r from-forest-700 via-white via-50% to-forest-700',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
