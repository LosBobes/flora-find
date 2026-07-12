import React from 'react'
import { cn } from '../lib/utils'

// Magic UI ShimmerButton: a solid button with a rotating light sweep behind it.
export const ShimmerButton = React.forwardRef(function ShimmerButton(
  {
    shimmerColor = '#ffffff',
    shimmerSize = '0.05em',
    shimmerDuration = '3s',
    borderRadius = '100px',
    background = 'linear-gradient(135deg, #2e7d32, #1b5e20)',
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      style={{
        '--spread': '90deg',
        '--shimmer-color': shimmerColor,
        '--radius': borderRadius,
        '--speed': shimmerDuration,
        '--cut': shimmerSize,
        '--bg': background,
      }}
      className={cn(
        'shimmer-btn group relative z-0 flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/10 px-5 py-2.5 font-semibold text-white [background:var(--bg)] [border-radius:var(--radius)]',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <div className="-z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <div
        className={cn(
          'absolute inset-0 size-full',
          'transform-gpu transition-all duration-300 ease-in-out',
          'shadow-[inset_0_-8px_10px_#ffffff1f]',
          'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
          'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]',
        )}
        style={{ borderRadius: 'var(--radius)' }}
      />
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  )
})
