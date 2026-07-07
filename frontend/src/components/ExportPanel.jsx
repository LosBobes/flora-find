import { useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { ShimmerButton } from '../ui/shimmer-button'
import { Select } from '../ui/select'
import { labelText, btnGhost } from '../ui/form'

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
  const { t } = useI18n()
  const [format, setFormat] = useState('geojson')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const { blob, count, filename } = await api.exportArea(area, format)
      triggerDownload(blob, filename)
      onNotice(t('exportedNotice', { count, format: format.toUpperCase() }))
      onClose()
    } catch (err) {
      onNotice(err.status === 403 ? t('adminsOnly') : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-forest-800 dark:text-forest-50">{t('exportAreaTitle')}</h3>
      <p className="rounded-xl bg-forest-50 px-3 py-2 text-xs text-forest-600 dark:bg-white/5 dark:text-forest-200">
        {t('selectedRectangle')}
        <br />
        {area.min_lat.toFixed(4)}, {area.min_lng.toFixed(4)} to {area.max_lat.toFixed(4)},{' '}
        {area.max_lng.toFixed(4)}
      </p>

      <label className={labelText}>
        {t('format')}
        <span className="mt-1 block">
          <Select
            value={format}
            onChange={setFormat}
            options={[
              { value: 'geojson', label: 'GeoJSON (.geojson)' },
              { value: 'csv', label: 'CSV (.csv)' },
            ]}
          />
        </span>
      </label>

      <div className="flex gap-2">
        <ShimmerButton onClick={handleExport} disabled={busy} className="flex-1">
          {busy ? t('exporting') : t('download')}
        </ShimmerButton>
        <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
