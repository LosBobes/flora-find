import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { PLANT_CATEGORIES } from '../fruitIcons'
import { LANGUAGES, useI18n } from '../i18n'
import { usePlantTypes } from '../PlantTypesContext'
import { ShimmerButton } from '../ui/shimmer-button'
import { Select } from '../ui/select'
import { fieldInput, labelText, btnGhost, btnPrimary, btnSmall } from '../ui/form'
import { cn } from '../lib/utils'

const MAX_PHOTOS = 3
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'

const emptyNames = () => Object.fromEntries(LANGUAGES.map((entry) => [entry.code, '']))

export default function TreeForm({ position, initial, onSubmit, onCancel }) {
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

  // Admin-only "add a new type" panel.
  const [addingType, setAddingType] = useState(false)
  const [newTypeNames, setNewTypeNames] = useState(emptyNames)
  const [typeError, setTypeError] = useState(null)
  const [savingType, setSavingType] = useState(false)

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])

  const isFruit = category === 'fruit_tree'
  const isFlowerbed = category === 'flowerbed'
  const typeOptions = byCategory(category)

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
    try {
      await onSubmit(
        {
          name,
          category,
          fruit_type: fruitType,
          hazard,
          species: species || null,
          season_start: seasonStart ? Number(seasonStart) : null,
          season_end: seasonEnd ? Number(seasonEnd) : null,
          description: description || null,
          lat: position.lat,
          lng: position.lng,
        },
        photos,
      )
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-lg font-bold text-forest-800 dark:text-forest-50">
          {initial ? t('editPlant') : t('registerPlant')}
        </h3>
        <p className="text-xs text-forest-500 dark:text-forest-300">
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      </div>

      <label className={labelText}>
        {t('category')}
        <span className="mt-1 block">
          <Select value={category} onChange={handleCategoryChange} options={categoryOptions} />
        </span>
      </label>

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

      {/* Only admins can extend the vocabulary; they must name it in every language. */}
      {user?.is_admin && !addingType && (
        <button
          type="button"
          className="self-start text-sm font-semibold text-forest-700 underline dark:text-forest-200"
          onClick={() => setAddingType(true)}
        >
          + {t('addNewType')}
        </button>
      )}
      {user?.is_admin && addingType && (
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

      {!initial && (
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
