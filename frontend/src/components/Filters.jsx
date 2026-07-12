import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { PLANT_CATEGORIES } from '../fruitIcons'
import { Select } from '../ui/select'
import { cn } from '../lib/utils'

const inputClass =
  'w-full rounded-xl border border-forest-100 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-200 dark:border-white/10 dark:bg-white/5 dark:text-forest-50 dark:placeholder-forest-300'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  )
}

// Search + category + type + in-season controls. `variant="bar"` lays them out
// in a row (desktop nav); `variant="stack"` stacks them (mobile sheet).
export default function Filters({
  searchText,
  setSearchText,
  categoryFilter,
  setCategoryFilter,
  fruitFilter,
  setFruitFilter,
  fruitTypes,
  ripeNow,
  setRipeNow,
  layerView = 'all',
  setLayerView,
  variant = 'bar',
}) {
  const { t } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const isBar = variant === 'bar'

  const layerOptions = [
    { value: 'all', label: t('layerAll') },
    { value: 'plants', label: t('layerPlants') },
    { value: 'areas', label: t('layerAreas') },
  ]

  const categoryOptions = [
    { value: '', label: t('allCategories') },
    ...PLANT_CATEGORIES.map((entry) => ({ value: entry.value, label: t(entry.labelKey) })),
  ]
  const typeOptions = [
    { value: '', label: t('allTypes') },
    ...fruitTypes.map((fruit) => ({ value: fruit, label: localizedType(fruit) })),
  ]

  return (
    <div
      className={cn(
        isBar ? 'flex flex-1 items-center gap-2' : 'flex flex-col gap-3',
      )}
    >
      <div data-tour="search" className={cn('relative', isBar ? 'flex-1 min-w-[160px] max-w-md' : 'w-full')}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400">
          <SearchIcon />
        </span>
        <input
          className={cn(inputClass, 'pl-9')}
          placeholder={t('searchPlaceholder')}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>
      <Select
        className={cn(isBar && 'w-auto min-w-[150px]')}
        ariaLabel={t('allCategories')}
        value={categoryFilter}
        onChange={setCategoryFilter}
        options={categoryOptions}
      />
      <Select
        className={cn(isBar && 'w-auto min-w-[140px]')}
        ariaLabel={t('allTypes')}
        value={fruitFilter}
        onChange={setFruitFilter}
        options={typeOptions}
      />
      <button
        type="button"
        data-tour="filters"
        onClick={() => setRipeNow((value) => !value)}
        title={t('inSeasonTitle')}
        className={cn(
          'shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition',
          isBar ? 'whitespace-nowrap' : 'w-full',
          ripeNow
            ? 'border-forest-500 bg-forest-500 text-white shadow-sm'
            : 'border-forest-100 bg-white text-forest-700 hover:bg-forest-50 dark:border-white/10 dark:bg-white/5 dark:text-forest-100 dark:hover:bg-white/10',
        )}
      >
        {t('inSeason')}
      </button>
      {/* Layer visibility: single plants, drawn areas, or everything. */}
      <div
        className={cn(
          'flex shrink-0 rounded-xl border border-forest-100 bg-white p-0.5 dark:border-white/10 dark:bg-white/5',
          isBar ? 'whitespace-nowrap' : 'w-full',
        )}
        role="group"
        aria-label={t('layers')}
      >
        {layerOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLayerView?.(option.value)}
            aria-pressed={layerView === option.value}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-sm font-semibold transition',
              isBar ? '' : 'flex-1',
              layerView === option.value
                ? 'bg-forest-600 text-white shadow-sm'
                : 'text-forest-700 hover:bg-forest-50 dark:text-forest-100 dark:hover:bg-white/10',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
