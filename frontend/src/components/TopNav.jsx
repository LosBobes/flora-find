import { useI18n, LANGUAGES } from '../i18n'
import { useAuth } from '../AuthContext'
import { BrandMark } from '../icons'
import { Particles } from '../ui/particles'
import Filters from './Filters'
import { cn } from '../lib/utils'

// Always-visible wordmark: solid forest text with a white shine that sweeps
// across every few seconds (an overlaid copy clipped to a moving white band).
function Wordmark() {
  return (
    <span className="relative inline-block text-xl font-extrabold tracking-tight text-forest-700 dark:text-forest-100">
      FloraFind
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-logo-shine bg-gradient-to-r from-transparent via-white to-transparent bg-clip-text bg-no-repeat text-transparent [background-position:-60px_0] [background-size:60px_100%]"
      >
        FloraFind
      </span>
    </span>
  )
}

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t('language')}
      className="inline-flex overflow-hidden rounded-xl border border-forest-200 dark:border-white/15"
    >
      {LANGUAGES.map((entry) => (
        <button
          key={entry.code}
          type="button"
          onClick={() => setLang(entry.code)}
          title={entry.name}
          className={cn(
            'px-2.5 py-1.5 text-xs font-bold transition',
            lang === entry.code
              ? 'bg-forest-600 text-white'
              : 'bg-white text-forest-600 hover:bg-forest-50 dark:bg-white/5 dark:text-forest-200 dark:hover:bg-white/10',
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  )
}

function HelpButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-forest-200 bg-white text-forest-600 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-200 dark:hover:bg-white/10"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2-2.5 3.4" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </button>
  )
}

export default function TopNav({ filterProps, onLogin, onRegister, onHelp, onOpenProfile }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()

  return (
    <header className="relative z-20 shrink-0 overflow-hidden border-b border-forest-100 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0e1f14]/80">
      <Particles className="absolute inset-0 h-full w-full opacity-60" quantity={40} color="#43a047" />
      <div className="relative flex items-center gap-3 px-3 py-2.5 md:px-5">
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-forest-600 shadow-glow ring-1 ring-inset ring-white/25">
            <BrandMark size={22} />
          </span>
          <Wordmark />
        </div>

        {/* Desktop: full filter bar inline. On mobile search + filters live in
            the melded bottom bar, so the header stays just the wordmark. */}
        <div className="hidden flex-1 md:flex">
          <Filters variant="bar" {...filterProps} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {/* Language toggle: desktop only. On mobile it lives in the settings
              drawer so the search box gets the full width. */}
          <div className="hidden md:block">
            <HelpButton onClick={onHelp} label={t('helpTitle')} />
          </div>
          <div className="hidden md:block">
            <LangSwitch />
          </div>
          {/* Account controls: desktop only; mobile uses the dock. */}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(user.id)}
                  title={t('myCatalog')}
                  className="max-w-[140px] truncate rounded-lg px-1.5 py-0.5 text-sm font-medium text-forest-700 underline decoration-forest-300 underline-offset-2 transition hover:bg-forest-50 hover:text-forest-900 dark:text-forest-100 dark:hover:bg-white/10"
                >
                  {t('hi', { username: user.username })}
                </button>
                {user.is_admin && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {t('admin')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-forest-200 bg-white px-3 py-1.5 text-sm font-medium text-forest-700 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10"
                >
                  {t('logOut')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onLogin}
                  className="rounded-xl border border-forest-200 bg-white px-3 py-1.5 text-sm font-medium text-forest-700 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10"
                >
                  {t('logIn')}
                </button>
                <button
                  type="button"
                  onClick={onRegister}
                  className="rounded-xl bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700"
                >
                  {t('register')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
