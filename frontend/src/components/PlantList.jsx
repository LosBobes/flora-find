import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { PlantIcon, HazardBadge, SeasonBadge, GoneBadge } from '../icons'
import { plantColor } from '../fruitIcons'
import { formatSeason } from '../seasons'
import { BlurFade } from '../ui/blur-fade'
import { NumberTicker } from '../ui/number-ticker'
import { cn } from '../lib/utils'

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// The scrollable plant list plus its count header. Shared by the desktop
// sidebar and the mobile bottom sheet.
export default function PlantList({ trees, selectedTree, onSelect, countSuffix }) {
  const { t, name: plantName, monthsShort } = useI18n()
  const { localized: localizedType } = usePlantTypes()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-2 flex items-baseline gap-1 px-1 text-sm font-semibold text-forest-600 dark:text-forest-200">
        <NumberTicker value={trees.length} className="text-base font-bold text-forest-700 dark:text-forest-100" />
        <span>{t('plantNoun', { count: trees.length })}</span>
        <span className="text-forest-500 dark:text-forest-300">{countSuffix}</span>
      </h2>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {trees.map((tree, index) => (
          <BlurFade key={tree.id} delay={Math.min(index * 0.025, 0.3)}>
            <li
              onClick={() => onSelect(tree)}
              className={cn(
                'group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-forest-100 bg-white p-2.5 pl-4 shadow-sm transition',
                'hover:-translate-y-0.5 hover:shadow-md',
                'dark:border-white/10 dark:bg-white/5',
                selectedTree?.id === tree.id &&
                  'ring-2 ring-forest-400 dark:ring-forest-300',
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-2/3 rounded-r-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(to right, transparent, ${plantColor(tree)}cc)` }}
              />
              <PlantIcon tree={tree} size={32} className="relative block shrink-0" />
              <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold text-forest-900 dark:text-forest-50">
                  <span className="truncate">{plantName(tree.name)}</span>
                  {tree.hazard && <HazardBadge size={16} className="shrink-0" title={t('tipHazard')} />}
                  {tree.in_season && <SeasonBadge size={16} className="shrink-0" title={t('tipInSeason')} />}
                  {tree.flagged_gone && <GoneBadge size={16} className="shrink-0" title={t('tipGone')} />}
                </span>
                <span className="block truncate text-xs text-forest-500 dark:text-forest-300">
                  {localizedType(tree.fruit_type)}
                  {formatSeason(tree, monthsShort) ? ` · ${formatSeason(tree, monthsShort)}` : ''}
                  {typeof tree.distance_km === 'number' && (
                    <span className="font-semibold text-blue-600"> · {formatDistance(tree.distance_km)}</span>
                  )}
                </span>
              </span>
            </li>
          </BlurFade>
        ))}
        {trees.length === 0 && (
          <li className="px-2 py-6 text-center text-sm italic text-forest-500 dark:text-forest-300">
            {t('emptyList')}
          </li>
        )}
      </ul>
    </div>
  )
}
