import { useMemo, useState } from 'react'
import { HAZARD_SUGGESTIONS, PLANT_CATEGORIES, TYPE_SUGGESTIONS } from '../fruitIcons'
import { MONTHS } from '../seasons'

const MAX_PHOTOS = 3
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'

const NAME_PLACEHOLDERS = {
  fruit_tree: 'e.g. Old cherry by the school',
  tree: 'e.g. Big oak in the park',
  shrub: 'e.g. Lilac hedge on the corner',
  flowerbed: 'e.g. Tulip bed by the fountain',
  vine: 'e.g. Wisteria over the gate',
  other: 'e.g. Herb patch by the path',
}

export default function TreeForm({ position, initial, onSubmit, onCancel }) {
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

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])

  const isFruit = category === 'fruit_tree'
  const isFlowerbed = category === 'flowerbed'
  const typeSuggestions = hazard ? HAZARD_SUGGESTIONS : (TYPE_SUGGESTIONS[category] ?? [])

  function handlePhotosChange(event) {
    const files = Array.from(event.target.files).slice(0, MAX_PHOTOS)
    setPhotos(files)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
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
    <form className="tree-form" onSubmit={handleSubmit}>
      <h3>{initial ? 'Edit plant' : 'Register a plant'}</h3>
      <p className="coords">
        📍 {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
      </p>
      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {PLANT_CATEGORIES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.emoji} {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={NAME_PLACEHOLDERS[category]}
          maxLength={120}
          required
          autoFocus
        />
      </label>
      <label>
        {isFruit ? 'Fruit' : 'Plant type'}
        <input
          value={fruitType}
          onChange={(event) => setFruitType(event.target.value)}
          list="type-suggestions"
          placeholder={isFruit ? 'e.g. Cherry' : 'e.g. ' + (typeSuggestions[0] ?? 'Oak')}
          maxLength={80}
          required
        />
        <datalist id="type-suggestions">
          {typeSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </label>
      <label className="hazard-checkbox">
        <input
          type="checkbox"
          checked={hazard}
          onChange={(event) => setHazard(event.target.checked)}
        />
        ☠️ Poisonous or hazardous (e.g. poison ivy) — warn people
      </label>
      <label>
        Species <span className="optional">(optional)</span>
        <input
          value={species}
          onChange={(event) => setSpecies(event.target.value)}
          placeholder={isFruit ? 'e.g. Prunus avium' : 'e.g. Quercus robur'}
          maxLength={120}
        />
      </label>
      <label>
        {isFruit ? 'Season' : isFlowerbed ? 'Blooming season' : 'Season'}{' '}
        <span className="optional">(optional)</span>
        <span className="season-selects">
          <select value={seasonStart} onChange={(event) => setSeasonStart(event.target.value)}>
            <option value="">From…</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <select value={seasonEnd} onChange={(event) => setSeasonEnd(event.target.value)}>
            <option value="">To…</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label>
        Notes <span className="optional">(optional)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Access, ripeness, anything useful…"
          rows={3}
          maxLength={2000}
        />
      </label>
      {!initial && (
        <label>
          Photos <span className="optional">(optional, up to {MAX_PHOTOS})</span>
          <input type="file" accept={PHOTO_TYPES} multiple onChange={handlePhotosChange} />
          {photos.length > 0 && (
            <span className="photo-previews">
              {photos.map((file, index) => (
                <img
                  key={file.name}
                  className="photo-preview"
                  src={photoPreviews[index]}
                  alt={file.name}
                />
              ))}
            </span>
          )}
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
