import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { PLANT_CATEGORIES } from '../fruitIcons'
import { PlantIcon } from '../icons'
import { LANGUAGES, useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { ShimmerButton } from '../ui/shimmer-button'
import { Select } from '../ui/select'
import PlantIdentifier from './PlantIdentifier'
import { fieldInput, labelText, btnGhost, btnPrimary, btnSmall } from '../ui/form'
import { cn } from '../lib/utils'

const MAX_PHOTOS = 3
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'

// A friendly emoji per category, used only in the picker tiles (the canonical
// marker artwork stays the coloured SVG glyph from icons.jsx / fruitIcons.js).
const CATEGORY_EMOJI = {
  fruit_tree: '🍎',
  tree: '🌳',
  evergreen: '🌲',
  shrub: '🌿',
  flowerbed: '🌸',
  vine: '🍇',
  fungi: '🍄',
  other: '🌱',
}

const emptyNames = () => Object.fromEntries(LANGUAGES.map((entry) => [entry.code, '']))

export default function TreeForm({ position, initial, onSubmit, onCancel, variant = 'plant', polygon }) {
  const isArea = variant === 'area'
  const { t, lang, months } = useI18n()
  const { user } = useAuth()
  const { byCategory, addType } = usePlantTypes()

  const [category, setCategory] = useState(initial?.category ?? 'fruit_tree')
  const [name, setName] = useState(initial?.name ?? '')
  const [fruitType, setFruitType] = useState(initial?.fruit_type ?? '')
  const [hazard, setHazard] = useState(initial?.hazard ?? false)
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [seasonStart, setSeasonStart] = useState(initial?.season_start ?? '')
  const [seasonEnd, setSeasonEnd] = useState(initial?.season_end ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // "Add a new type" panel — open to any signed-in user.
  const [addingType, setAddingType] = useState(false)
  const [newTypeNames, setNewTypeNames] = useState(emptyNames)
  const [typeError, setTypeError] = useState(null)
  const [savingType, setSavingType] = useState(false)

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])

  const isFruit = category === 'fruit_tree'
  const isFlowerbed = category === 'flowerbed'
  const isFungi = category === 'fungi'
  const typeOptions = byCategory(category)

  // Mirrors the shape the map marker / list icon expect, so the preview shows
  // exactly the artwork this plant will get once saved.
  const previewTree = { category, fruit_type: fruitType, hazard }

  const categoryOptions = PLANT_CATEGORIES.map((entry) => ({
    value: entry.value,
    label: t(entry.labelKey),
  }))
  const typeSelectOptions = typeOptions.map((type) => ({
    value: type.names.en,
    label: type.names[lang] ?? type.names.en,
  }))
  const monthOptions = (firstLabel) => [
    { value: '', label: firstLabel },
    ...months.map((month, index) => ({ value: index + 1, label: month })),
  ]

  function handleCategoryChange(value) {
    setCategory(value)
    const stillValid = byCategory(value).some((type) => type.names.en === fruitType)
    if (!stillValid) setFruitType('')
    setAddingType(false)
  }

  function handlePhotosChange(event) {
    const files = Array.from(event.target.files).slice(0, MAX_PHOTOS)
    setPhotos(files)
  }

  // Apply a photo-identification match: fill in whatever the recogniser is
  // confident about (species always; category / type / season / hazard only when
  // the species maps to a type we carry) and attach the photo that was
  // identified so the user doesn't have to pick it again.
  function handleIdentified(suggestion, file) {
    if (suggestion.category) setCategory(suggestion.category)
    if (suggestion.known_type && suggestion.fruit_type) setFruitType(suggestion.fruit_type)
    if (suggestion.scientific_name) setSpecies(suggestion.scientific_name)
    if (suggestion.season_start != null) setSeasonStart(suggestion.season_start)
    if (suggestion.season_end != null) setSeasonEnd(suggestion.season_end)
    setHazard(Boolean(suggestion.hazard))
    if (!name.trim() && suggestion.common_name) setName(suggestion.common_name)
    if (file) {
      setPhotos((current) =>
        current.some((f) => f.name === file.name && f.size === file.size)
          ? current
          : [...current, file].slice(0, MAX_PHOTOS),
      )
    }
  }

  async function handleAddType(event) {
    event.preventDefault()
    setTypeError(null)
    const missing = LANGUAGES.filter((entry) => !newTypeNames[entry.code].trim())
    if (missing.length) {
      setTypeError(t('typeNameForLang', { language: missing.map((e) => e.name).join(', ') }))
      return
    }
    setSavingType(true)
    try {
      const created = await addType({ category, names: newTypeNames })
      setFruitType(created.names.en)
      setNewTypeNames(emptyNames())
      setAddingType(false)
    } catch (err) {
      setTypeError(err.message)
    } finally {
      setSavingType(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (!fruitType) {
      setError(t('selectTypePlaceholder'))
      return
    }
    setBusy(true)
    const common = {
      name,
      category,
      fruit_type: fruitType,
      hazard,
      species: species || null,
      season_start: seasonStart ? Number(seasonStart) : null,
      season_end: seasonEnd ? Number(seasonEnd) : null,
      description: description || null,
    }
    const payload = isArea
      ? { ...common, polygon }
      : { ...common, lat: position.lat, lng: position.lng }
    try {
      await onSubmit(payload, photos)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-lg font-bold text-forest-800 dark:text-forest-50">
          {isArea ? (initial ? t('editArea') : t('nameArea')) : initial ? t('editPlant') : t('registerPlant')}
        </h3>
        <p className="text-xs text-forest-500 dark:text-forest-300">
          {isArea ? t('areaFormHint') : t('formTapHint')}
        </p>
      </div>

      {/* Live preview: the real marker artwork updates as you pick a category,
          type or the hazard flag, so you see exactly how the plant will land on
          the map before saving. */}
      <div className="relative overflow-hidden rounded-2xl border border-forest-100 bg-gradient-to-br from-forest-50 via-white to-forest-50 p-3 dark:border-white/10 dark:from-forest-500/15 dark:via-transparent dark:to-forest-500/10">
        <span className="pointer-events-none absolute -right-3 -top-3 select-none text-5xl opacity-15">
          {CATEGORY_EMOJI[category]}
        </span>
        <div className="relative flex items-center gap-3">
          <span
            key={`${category}-${fruitType}-${hazard}`}
            className="grid size-14 shrink-0 animate-pop-in place-items-center rounded-2xl bg-white shadow-sm dark:bg-white/10"
          >
            <PlantIcon tree={previewTree} size={40} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-forest-500 dark:text-forest-300">
              {t('formPreview')}
            </p>
            <p className="truncate text-sm font-bold text-forest-800 dark:text-forest-50">
              {name.trim() || t(`namePlaceholder_${category}`)}
            </p>
            <p className="truncate text-xs text-forest-500 dark:text-forest-300">
              {CATEGORY_EMOJI[category]} {t(`cat_${category}`)}
              {fruitType ? ` · ${fruitType}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div>
        <span className={labelText}>{t('category')}</span>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {categoryOptions.map((entry) => {
            const active = category === entry.value
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => handleCategoryChange(entry.value)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-center transition active:scale-95',
                  active
                    ? 'border-forest-500 bg-forest-50 ring-2 ring-forest-300 dark:border-forest-400 dark:bg-forest-500/20 dark:ring-forest-500/40'
                    : 'border-forest-100 bg-white hover:-translate-y-0.5 hover:border-forest-300 hover:bg-forest-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
                )}
              >
                <span className="text-2xl leading-none">{CATEGORY_EMOJI[entry.value]}</span>
                <span className="text-[11px] font-semibold leading-tight text-forest-800 dark:text-forest-100">
                  {entry.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Fungi are far more ephemeral than plants: warn that the find ages out. */}
      {isFungi && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <span aria-hidden className="text-sm leading-none">⏳</span>
          {t('ephemeralHint')}
        </p>
      )}

      {/* Don't know what it is? Let a photo do the identifying and pre-fill the
          form. Only on new plants (not areas, not edits) since it also attaches
          the identified photo. */}
      {!initial && !isArea && <PlantIdentifier onApply={handleIdentified} />}

      <label className={labelText}>
        {t('name')}
        <input
          className={fieldInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t(`namePlaceholder_${category}`)}
          maxLength={120}
          required
          autoFocus
        />
      </label>

      <label className={labelText}>
        {isFruit ? t('fruit') : t('plantType')}
        <span className="mt-1 block">
          <Select
            value={fruitType}
            onChange={setFruitType}
            options={typeSelectOptions}
            placeholder={typeOptions.length ? t('selectTypePlaceholder') : t('noTypesYet')}
          />
        </span>
      </label>

      {/* Any signed-in user can extend the vocabulary; they must name it in every language. */}
      {user && !addingType && (
        <button
          type="button"
          className="self-start text-sm font-semibold text-forest-700 underline dark:text-forest-200"
          onClick={() => setAddingType(true)}
        >
          + {t('addNewType')}
        </button>
      )}
      {user && addingType && (
        <div className="flex flex-col gap-2 rounded-xl border border-forest-100 bg-forest-50 p-3 dark:border-white/10 dark:bg-white/5">
          <strong className="text-sm font-semibold text-forest-800 dark:text-forest-100">
            {t('newTypePanelTitle')}
          </strong>
          {LANGUAGES.map((entry) => (
            <label key={entry.code} className={labelText}>
              {t('typeNameForLang', { language: entry.name })}
              <input
                className={fieldInput}
                value={newTypeNames[entry.code]}
                onChange={(event) =>
                  setNewTypeNames((current) => ({ ...current, [entry.code]: event.target.value }))
                }
                maxLength={80}
              />
            </label>
          ))}
          {typeError && <p className="text-sm font-medium text-red-600">{typeError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnPrimary, btnSmall)}
              onClick={handleAddType}
              disabled={savingType}
            >
              {savingType ? t('saving') : t('addTypeAction')}
            </button>
            <button
              type="button"
              className={cn(btnGhost, btnSmall)}
              onClick={() => {
                setAddingType(false)
                setTypeError(null)
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-forest-800 dark:text-forest-100">
        <input
          type="checkbox"
          className="size-4 rounded border-forest-300 text-forest-600 focus:ring-forest-400"
          checked={hazard}
          onChange={(event) => setHazard(event.target.checked)}
        />
        {t('hazardCheckbox')}
      </label>

      <label className={labelText}>
        {t('species')} <span className="font-normal text-forest-500">{t('optional')}</span>
        <input
          className={fieldInput}
          value={species}
          onChange={(event) => setSpecies(event.target.value)}
          placeholder={isFruit ? t('speciesFruitPlaceholder') : t('speciesPlaceholder')}
          maxLength={120}
        />
      </label>

      <label className={labelText}>
        {isFlowerbed ? t('bloomingSeason') : t('season')}{' '}
        <span className="font-normal text-forest-500">{t('optional')}</span>
        <span className="mt-1 flex gap-2">
          <Select value={seasonStart} onChange={setSeasonStart} options={monthOptions(t('from'))} />
          <Select value={seasonEnd} onChange={setSeasonEnd} options={monthOptions(t('to'))} />
        </span>
      </label>

      <label className={labelText}>
        {t('notes')} <span className="font-normal text-forest-500">{t('optional')}</span>
        <textarea
          className={fieldInput}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('notesPlaceholder')}
          rows={3}
          maxLength={2000}
        />
      </label>

      {!initial && !isArea && (
        <label className={labelText}>
          {t('photos', { max: MAX_PHOTOS })}
          <input
            type="file"
            accept={PHOTO_TYPES}
            multiple
            onChange={handlePhotosChange}
            className="mt-1 block w-full text-sm text-forest-600 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-forest-700"
          />
          {photos.length > 0 && (
            <span className="mt-2 flex gap-1.5">
              {photos.map((file, index) => (
                <img
                  key={file.name}
                  className="size-14 rounded-lg border border-forest-100 object-cover"
                  src={photoPreviews[index]}
                  alt={file.name}
                />
              ))}
            </span>
          )}
        </label>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <ShimmerButton type="submit" disabled={busy} className="flex-1">
          {busy ? t('saving') : t('save')}
        </ShimmerButton>
        <button type="button" className={btnGhost} onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
