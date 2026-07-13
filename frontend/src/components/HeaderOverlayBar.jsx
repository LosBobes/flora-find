import { cn } from '../lib/utils'

// The compact toolbar that replaces the top nav on mobile while a map action is
// in progress (placing a plant, drawing an area). Layout: a cancel button on the
// left, a wrapping instruction that keeps priority for width, and icon actions on
// the right. It's built to sit inside the top nav's height so the header can morph
// in place without the map below reflowing.
//
// The hint wraps (line-clamp-2) instead of truncating to a single ellipsised word,
// and the actions are icon-only squares — matching the mobile bottom bar's
// icon-forward language — so a long instruction like "Klikni na mapu gde biljka
// raste" stays fully readable in the narrow header.
export function HeaderOverlayBar({ onCancel, cancelLabel, hint, children }) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label={cancelLabel}
        title={cancelLabel}
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-lg font-bold leading-none text-red-600 transition active:scale-95 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      >
        ×
      </button>
      <p className="line-clamp-2 min-w-0 flex-1 text-[11px] font-semibold leading-tight text-forest-700 dark:text-forest-100">
        {hint}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </>
  )
}

// A single icon action in the header overlay. `primary` gives it the filled
// forest highlight for the main call-to-action (confirm, finish, drop-here).
export function OverlayIconButton({ onClick, label, disabled = false, primary = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl border transition active:scale-95 disabled:opacity-40',
        primary
          ? 'border-forest-600 bg-forest-600 text-white shadow-glow'
          : 'border-forest-200 bg-white text-forest-700 dark:border-white/15 dark:bg-white/5 dark:text-forest-100',
      )}
    >
      {children}
    </button>
  )
}
