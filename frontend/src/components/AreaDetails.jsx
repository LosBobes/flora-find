import { motion } from 'motion/react'
import { categoryInfo, plantColor } from '../fruitIcons'
import { PlantIcon } from '../icons'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { formatSeason, seasonMonths } from '../seasons'
import { cn } from '../lib/utils'

// A compact 12-cell strip showing which months the area is in season/bloom.
function SeasonStrip({ area, monthsShort, accent }) {
  const active = seasonMonths(area)
  if (!active) return null
  const now = new Date().getMonth() + 1
  return (
    <div className="mt-1.5 flex gap-[3px]">
      {monthsShort.map((label, i) => {
        const month = i + 1
        const on = active.has(month)
        const isNow = month === now
        return (
          <div key={month} className="flex flex-1 flex-col items-center gap-0.5" title={label}>
            <span
              className={cn(
                'h-4 w-full rounded-[3px] transition-colors',
                !on && 'bg-forest-100 dark:bg-white/10',
                isNow && 'ring-1 ring-forest-900 dark:ring-white',
              )}
              style={on ? { backgroundColor: accent } : undefined}
            />
            <span
              className={cn(
                'text-[8px] font-semibold leading-none',
                on ? 'text-forest-800 dark:text-forest-100' : 'text-forest-400 dark:text-forest-500',
              )}
            >
              {label.charAt(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function AreaDetails({ area, currentUser, onEdit, onDelete }) {
  const { t, lang, name: plantName, desc, monthsShort } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const isOwner = currentUser && area.owner?.id === currentUser.id
  const season = formatSeason(area, monthsShort)
  const isFruit = area.category === 'fruit_tree' || !area.category
  const isFlowerbed = area.category === 'flowerbed'
  const accent = plantColor(area)

  const wikiQuery = area.species || localizedType(area.fruit_type)
  const wikiUrl = wikiQuery
    ? `https://${lang === 'sr' ? 'sr' : 'en'}.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`
    : null

  return (
    <div className="relative w-[272px] max-w-[82vw] overflow-hidden rounded-2xl bg-white shadow-card dark:bg-[#12241a]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <div className="p-4 pb-3">
        <h3 className="mb-1.5 flex items-start gap-2 pr-5 text-base font-bold leading-snug text-forest-900 dark:text-forest-50">
          <PlantIcon tree={area} size={26} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{plantName(area.name)}</span>
        </h3>

        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-600 dark:bg-white/10 dark:text-forest-300">
          {t('areaBadge')}
        </span>

        {area.hazard && (
          <p className="my-2 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-bold text-white">
            {t('hazardFlag')}
          </p>
        )}

        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-forest-500 dark:text-forest-300">
              {isFruit ? t('fruitLabel') : t('typeLabel')}
            </dt>
            <dd className="min-w-0 break-words text-forest-800 dark:text-forest-100">
              <span className="font-medium">{localizedType(area.fruit_type)}</span>
              {area.species && (
                <span className="italic text-forest-400 dark:text-forest-500"> ({area.species})</span>
              )}
              {!isFruit && (
                <span className="ml-1.5 inline-block rounded-full bg-forest-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-forest-600 dark:bg-white/10 dark:text-forest-300">
                  {t(categoryInfo(area.category).labelKey)}
                </span>
              )}
            </dd>
          </div>

          {season && (
            <div>
              <dt className="font-semibold text-forest-500 dark:text-forest-300">
                {isFlowerbed ? t('bloomsLabel') : t('seasonLabel')}
              </dt>
              <SeasonStrip area={area} monthsShort={monthsShort} accent={accent} />
            </div>
          )}
        </dl>

        {area.description && (
          <p className="mt-2 text-sm text-forest-700 dark:text-forest-200">{desc(area.description)}</p>
        )}

        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('learnMore')}
          </a>
        )}

        <p className="mt-3 text-[11px] text-forest-500 dark:text-forest-400">
          {t('registeredBy', {
            user: area.owner?.username ?? t('unknown'),
            date: new Date(area.created_at).toLocaleDateString(),
          })}
        </p>
      </div>

      {isOwner && (
        <div className="border-t border-forest-100 bg-forest-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center rounded-xl border border-forest-200 bg-white px-3 py-1.5 text-xs font-medium text-forest-700 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10"
              onClick={onEdit}
            >
              {t('edit')}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              onClick={onDelete}
            >
              {t('delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
