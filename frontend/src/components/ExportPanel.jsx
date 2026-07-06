import { useState } from 'react'
import { api } from '../api'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Shown once an admin has drawn an area on the map: pick a format and download
// every plant inside that rectangle.
export default function ExportPanel({ area, onClose, onNotice }) {
  const [format, setFormat] = useState('geojson')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const { blob, count, filename } = await api.exportArea(area, format)
      triggerDownload(blob, filename)
      onNotice(`Exported ${count} plant${count === 1 ? '' : 's'} as ${format.toUpperCase()} 📦`)
      onClose()
    } catch (err) {
      onNotice(err.status === 403 ? 'Admins only — export is not available.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tree-form export-panel">
      <h3>Export area</h3>
      <p className="hint">
        Selected rectangle:
        <br />
        {area.min_lat.toFixed(4)}, {area.min_lng.toFixed(4)} →{' '}
        {area.max_lat.toFixed(4)}, {area.max_lng.toFixed(4)}
      </p>

      <label>
        Format
        <select value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="geojson">GeoJSON (.geojson)</option>
          <option value="csv">CSV (.csv)</option>
        </select>
      </label>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
          {busy ? 'Exporting…' : '⬇ Download'}
        </button>
        <button className="btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}
