import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { btnSmall, btnGhost } from '../ui/form'
import { cn } from '../lib/utils'

const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'

// "Not sure what it is?" helper: the user picks (or snaps) a photo, we ask the
// backend to identify it, and offer the ranked matches as one-tap fills for the
// form. Renders nothing when the server has no identification key configured, so
// there's never a dead button. Applying a suggestion also hands the photo back to
// the form so it can be attached to the plant.
export default function PlantIdentifier({ onApply }) {
  const { t } = useI18n()
  const { localized } = usePlantTypes()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [file, setFile] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true
    api
      .identifyConfig()
      .then((config) => {
        if (active) setEnabled(Boolean(config?.enabled))
      })
      .catch(() => {
        /* leave the feature hidden if we can't reach the config endpoint */
      })
    return () => {
      active = false
    }
  }, [])

  if (!enabled) return null

  async function handleFile(event) {
    const picked = event.target.files?.[0]
    event.target.value = '' // allow re-picking the same file
    if (!picked) return
    setFile(picked)
    setError(null)
    setSuggestions(null)
    setBusy(true)
    try {
      const result = await api.identifyPlant(picked)
      setSuggestions(result?.suggestions ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function apply(suggestion) {
    onApply(suggestion, file)
  }

  return (
    <div className="rounded-2xl border border-forest-100 bg-forest-50/60 p-3 dark:border-white/10 dark:bg-white/5">
      {!open ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left text-sm font-semibold text-forest-700 dark:text-forest-200"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden className="text-base leading-none">🔍</span>
          {t('identifyPrompt')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="block text-sm font-semibold text-forest-800 dark:text-forest-100">
                {t('identifyTitle')}
              </strong>
              <span className="text-xs text-forest-500 dark:text-forest-300">
                {t('identifyHint')}
              </span>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-forest-500 underline dark:text-forest-300"
              onClick={() => setOpen(false)}
            >
              {t('close')}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={PHOTO_TYPES}
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            className={cn(btnGhost, btnSmall, 'self-start')}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? t('identifyBusy') : suggestions ? t('identifyRetry') : t('identifyPick')}
          </button>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {suggestions && suggestions.length === 0 && !busy && (
            <p className="text-sm text-forest-500 dark:text-forest-300">{t('identifyNoMatch')}</p>
          )}

          {suggestions && suggestions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((suggestion) => {
                const confidence = Math.round((suggestion.score ?? 0) * 100)
                const typeLabel = suggestion.known_type
                  ? localized(suggestion.fruit_type)
                  : null
                return (
                  <li
                    key={suggestion.scientific_name}
                    className="flex items-center justify-between gap-2 rounded-xl border border-forest-100 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-forest-800 dark:text-forest-100">
                        {suggestion.common_name || suggestion.scientific_name}
                      </p>
                      <p className="truncate text-xs italic text-forest-500 dark:text-forest-300">
                        {suggestion.scientific_name}
                        {typeLabel ? ` · ${typeLabel}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-semibold text-forest-700 dark:bg-white/10 dark:text-forest-200"
                        title={t('identifyConfidence', { pct: confidence })}
                      >
                        {confidence}%
                      </span>
                      <button
                        type="button"
                        className="rounded-lg bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white transition active:scale-95 hover:bg-forest-700"
                        onClick={() => apply(suggestion)}
                      >
                        {t('identifyUse')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
