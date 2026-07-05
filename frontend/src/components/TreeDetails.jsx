import { categoryInfo, plantEmoji } from '../fruitIcons'
import { formatSeason } from '../seasons'

function daysAgo(dateString) {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function TreeDetails({ tree, currentUser, onEdit, onDelete, onConfirm }) {
  const isOwner = currentUser && tree.owner?.id === currentUser.id
  const season = formatSeason(tree)
  const isFruit = tree.category === 'fruit_tree' || !tree.category
  return (
    <div className="tree-details">
      <h3>
        {plantEmoji(tree)} {tree.name}
      </h3>
      {tree.hazard && (
        <p className="hazard-flag">☠️ Poisonous / hazardous — do not touch or eat</p>
      )}
      {tree.flagged_gone && (
        <p className="gone-flag">⚠️ Reported gone by {tree.gone_reports} people</p>
      )}
      <p className="detail-row">
        <strong>{isFruit ? 'Fruit:' : 'Type:'}</strong> {tree.fruit_type}
        {tree.species ? ` (${tree.species})` : ''}
        {!isFruit && <span className="category-tag"> · {categoryInfo(tree.category).label}</span>}
      </p>
      {season && (
        <p className="detail-row">
          <strong>{tree.category === 'flowerbed' ? 'Blooms:' : 'Season:'}</strong> {season}
          {tree.in_season && (
            <span className="badge-in-season">
              {' '}
              🟢 {tree.category === 'flowerbed' ? 'Blooming' : 'In season'}
            </span>
          )}
        </p>
      )}
      {tree.description && <p className="detail-row">{tree.description}</p>}
      {tree.photos?.length > 0 && (
        <div className="photo-gallery">
          {tree.photos.map((photo) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
              <img className="photo-thumb" src={photo.url} alt={`Photo of ${tree.name}`} />
            </a>
          ))}
        </div>
      )}
      {typeof tree.distance_km === 'number' && (
        <p className="detail-row">
          <strong>Distance:</strong> {tree.distance_km.toFixed(1)} km
        </p>
      )}
      <p className="detail-meta">
        Registered by {tree.owner?.username ?? 'unknown'} on{' '}
        {new Date(tree.created_at).toLocaleDateString()}
        {tree.last_confirmed_at && <> · Last confirmed {daysAgo(tree.last_confirmed_at)}</>}
      </p>
      <div className="confirm-actions">
        <button className="btn btn-small" onClick={() => onConfirm('present')}>
          👍 Still there
        </button>
        <button className="btn btn-small" onClick={() => onConfirm('gone')}>
          👎 Gone
        </button>
      </div>
      {isOwner && (
        <div className="detail-actions">
          <button className="btn btn-small" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-small btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
