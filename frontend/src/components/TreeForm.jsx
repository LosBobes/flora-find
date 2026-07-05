import { useState } from 'react'
import { COMMON_FRUITS } from '../fruitIcons'
import { MONTHS } from '../seasons'

const MAX_PHOTOS = 3
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'

export default function TreeForm({ position, initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [fruitType, setFruitType] = useState(initial?.fruit_type ?? '')
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [seasonStart, setSeasonStart] = useState(initial?.season_start ?? '')
  const [seasonEnd, setSeasonEnd] = useState(initial?.season_end ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

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
          fruit_type: fruitType,
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
      <h3>{initial ? 'Edit tree' : 'Register a tree'}</h3>
      <p className="coords">
        📍 {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
      </p>
      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Old cherry by the school"
          maxLength={120}
          required
          autoFocus
        />
      </label>
      <label>
        Fruit
        <input
          value={fruitType}
          onChange={(event) => setFruitType(event.target.value)}
          list="fruit-suggestions"
          placeholder="e.g. Cherry"
          maxLength={80}
          required
        />
        <datalist id="fruit-suggestions">
          {COMMON_FRUITS.map((fruit) => (
            <option key={fruit} value={fruit} />
          ))}
        </datalist>
      </label>
      <label>
        Species <span className="optional">(optional)</span>
        <input
          value={species}
          onChange={(event) => setSpecies(event.target.value)}
          placeholder="e.g. Prunus avium"
          maxLength={120}
        />
      </label>
      <label>
        Season <span className="optional">(optional)</span>
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
              {photos.map((file) => (
                <img
                  key={file.name}
                  className="photo-preview"
                  src={URL.createObjectURL(file)}
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
