import { useState } from 'react'
import { COMMON_FRUITS } from '../fruitIcons'

export default function TreeForm({ position, initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [fruitType, setFruitType] = useState(initial?.fruit_type ?? '')
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [season, setSeason] = useState(initial?.season ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit({
        name,
        fruit_type: fruitType,
        species: species || null,
        season: season || null,
        description: description || null,
        lat: position.lat,
        lng: position.lng,
      })
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
        <input
          value={season}
          onChange={(event) => setSeason(event.target.value)}
          placeholder="e.g. June–July"
          maxLength={120}
        />
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
