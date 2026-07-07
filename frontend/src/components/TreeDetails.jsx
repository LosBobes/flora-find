import { categoryInfo, plantColor } from '../fruitIcons'
import { PlantIcon, HazardBadge, GoneBadge } from '../icons'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { formatSeason, seasonMonths } from '../seasons'
import { cn } from '../lib/utils'

function useDaysAgo() {
  const { t } = useI18n()
  return (dateString) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
    if (days <= 0) return t('today')
    if (days === 1) return t('yesterday')
    return t('daysAgo', { days })
  }
}

// A 12-cell strip visualising which months a plant is in season. The current
// month is ringed. Active cells use the plant's accent colour.
function SeasonStrip({ tree, monthsShort, accent }) {
  const active = seasonMonths(tree)
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

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function TreeDetails({ tree, currentUser, onEdit, onDelete, onConfirm }) {
  const { t, lang, name: plantName, desc, monthsShort } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const daysAgo = useDaysAgo()
  const isOwner = currentUser && tree.owner?.id === currentUser.id
  const season = formatSeason(tree, monthsShort)
  const isFruit = tree.category === 'fruit_tree' || !tree.category
  const isFlowerbed = tree.category === 'flowerbed'
  const accent = plantColor(tree)

  // Wikipedia lookup keyed on the botanical species when known (unambiguous),
  // otherwise the localised type name. Search URL so a near-match still lands.
  const wikiQuery = tree.species || localizedType(tree.fruit_type)
  const wikiUrl = wikiQuery
    ? `https://${lang === 'sr' ? 'sr' : 'en'}.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`
    : null

  return (
    <div className="w-[272px] max-w-[82vw] overflow-hidden rounded-2xl bg-white shadow-card dark:bg-[#12241a]">
      <div className="p-4 pb-3">
        <h3 className="mb-1.5 flex items-start gap-2 pr-5 text-base font-bold leading-snug text-forest-900 dark:text-forest-50">
          <PlantIcon tree={tree} size={26} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{plantName(tree.name)}</span>
        </h3>

        {tree.hazard && (
          <p className="my-2 flex items-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-bold text-white">
            <HazardBadge size={16} className="shrink-0" />
            {t('hazardFlag')}
          </p>
        )}
        {tree.flagged_gone && (
          <p className="my-2 flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
            <GoneBadge size={16} className="shrink-0" />
            {t('goneFlag', { count: tree.gone_reports })}
          </p>
        )}

        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-forest-500 dark:text-forest-300">
              {isFruit ? t('fruitLabel') : t('typeLabel')}
            </dt>
            <dd className="min-w-0 break-words text-forest-800 dark:text-forest-100">
              <span className="font-medium">{localizedType(tree.fruit_type)}</span>
              {tree.species && (
                <span className="italic text-forest-400 dark:text-forest-500"> ({tree.species})</span>
              )}
              {!isFruit && (
                <span className="ml-1.5 inline-block rounded-full bg-forest-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-forest-600 dark:bg-white/10 dark:text-forest-300">
                  {t(categoryInfo(tree.category).labelKey)}
                </span>
              )}
            </dd>
          </div>

          {season && (
            <div>
              <dt className="font-semibold text-forest-500 dark:text-forest-300">
                {isFlowerbed ? t('bloomsLabel') : t('seasonLabel')}
              </dt>
              <SeasonStrip tree={tree} monthsShort={monthsShort} accent={accent} />
            </div>
          )}

          {typeof tree.distance_km === 'number' && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-forest-500 dark:text-forest-300">{t('distanceLabel')}</dt>
              <dd className="text-forest-800 dark:text-forest-100">{tree.distance_km.toFixed(1)} km</dd>
            </div>
          )}
        </dl>

        {tree.description && (
          <p className="mt-2 text-sm text-forest-700 dark:text-forest-200">{desc(tree.description)}</p>
        )}

        {tree.photos?.length > 0 && (
          <div className="mt-2.5 flex gap-1.5">
            {tree.photos.map((photo) => (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                <img
                  className="size-[76px] rounded-lg border border-forest-100 object-cover"
                  src={photo.url}
                  alt={tree.name}
                  title={photo.attribution ?? tree.name}
                />
              </a>
            ))}
          </div>
        )}
        {tree.photos?.some((photo) => photo.attribution) && (
          <p className="mt-1 text-[10px] leading-tight text-forest-500 dark:text-forest-400">
            {tree.photos
              .filter((photo) => photo.attribution)
              .map((photo) =>
                photo.source_url ? (
                  <a key={photo.id} className="underline" href={photo.source_url} target="_blank" rel="noreferrer">
                    {photo.attribution}
                  </a>
                ) : (
                  <span key={photo.id}>{photo.attribution}</span>
                ),
              )
              .reduce((acc, el) => (acc === null ? [el] : [...acc, ' · ', el]), null)}
          </p>
        )}

        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('learnMore')}
            <ExternalLinkIcon />
          </a>
        )}

        <p className="mt-3 text-[11px] text-forest-500 dark:text-forest-400">
          {t('registeredBy', {
            user: tree.owner?.username ?? t('unknown'),
            date: new Date(tree.created_at).toLocaleDateString(),
          })}
          {tree.last_confirmed_at && <> · {t('lastConfirmed', { when: daysAgo(tree.last_confirmed_at) })}</>}
        </p>
      </div>

      <div className="border-t border-forest-100 bg-forest-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="grid grid-cols-2 gap-2">
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 active:scale-[0.97]"
            onClick={() => onConfirm('present')}
          >
            <CheckIcon />
            {t('stillThere')}
          </button>
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 active:scale-[0.97] dark:border-white/15 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10"
            onClick={() => onConfirm('gone')}
          >
            <CrossIcon />
            {t('gone')}
          </button>
        </div>
        {isOwner && (
          <div className="mt-2 grid grid-cols-2 gap-2">
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
        )}
      </div>
    </div>
  )
}
