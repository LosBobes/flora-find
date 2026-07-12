import { useEffect, useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { PlantIcon } from '../icons'
import { plantColor } from '../fruitIcons'
import { cn } from '../lib/utils'

// A user's contribution catalog: how much they've added, plus a grid of "badges"
// — one per distinct plant type — rendered with the same marker artwork the plant
// gets on the map. Fetched by id; usable for the current user or any owner.
export default function ProfilePanel({ userId, onClose }) {
  const { t, lang } = useI18n()
  const { localized: localizedType } = usePlantTypes()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setProfile(null)
    setError(false)
    api
      .userProfile(userId)
      .then((data) => alive && setProfile(data))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [userId])

  const memberSince = profile
    ? new Date(profile.member_since).toLocaleDateString(lang === 'sr' ? 'sr-RS' : 'en-GB', {
        year: 'numeric',
        month: 'long',
      })
    : ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-forest-800 dark:text-forest-50">
            {profile ? t('catalogOf', { user: profile.user.username }) : t('myCatalog')}
          </h3>
          {profile && (
            <p className="text-xs text-forest-500 dark:text-forest-300">
              {t('memberSince', { date: memberSince })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-forest-200 bg-white text-forest-600 transition hover:bg-forest-50 dark:border-white/15 dark:bg-white/5 dark:text-forest-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{t('profileError')}</p>}
      {!profile && !error && <p className="text-sm text-forest-500">{t('loading')}</p>}

      {profile && (
        <>
          {profile.user.is_admin && (
            <span className="w-fit rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              {t('admin')}
            </span>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-forest-100 bg-forest-50/70 p-3 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-2xl font-extrabold text-forest-700 dark:text-forest-100">{profile.plant_count}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-forest-500 dark:text-forest-300">
                {t('plantNoun', { count: profile.plant_count })}
              </p>
            </div>
            <div className="rounded-xl border border-forest-100 bg-forest-50/70 p-3 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-2xl font-extrabold text-forest-700 dark:text-forest-100">{profile.area_count}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-forest-500 dark:text-forest-300">
                {t('layerAreas')}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-600 dark:text-forest-300">
              {t('typesAddedTitle')}
            </p>
            {profile.badges.length === 0 ? (
              <p className="text-sm text-forest-500 dark:text-forest-300">{t('catalogEmpty')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {profile.badges.map((badge) => {
                  const sample = {
                    category: badge.category,
                    fruit_type: badge.fruit_type,
                    hazard: badge.hazard,
                  }
                  return (
                    <li
                      key={`${badge.category}:${badge.fruit_type}`}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2 dark:bg-white/5',
                        badge.hazard
                          ? 'border-red-200 dark:border-red-500/30'
                          : 'border-forest-100 dark:border-white/10',
                      )}
                      title={localizedType(badge.fruit_type)}
                    >
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: `${plantColor(sample)}1a` }}
                      >
                        <PlantIcon tree={sample} size={26} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-forest-800 dark:text-forest-100">
                          {localizedType(badge.fruit_type)}
                        </span>
                        <span className="text-xs font-medium text-forest-500 dark:text-forest-300">
                          {t('badgeCount', { count: badge.count })}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
