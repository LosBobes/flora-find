import { fruitEmoji } from '../fruitIcons'

export default function TreeDetails({ tree, currentUser, onEdit, onDelete }) {
  const isOwner = currentUser && tree.owner?.id === currentUser.id
  return (
    <div className="tree-details">
      <h3>
        {fruitEmoji(tree.fruit_type)} {tree.name}
      </h3>
      <p className="detail-row">
        <strong>Fruit:</strong> {tree.fruit_type}
        {tree.species ? ` (${tree.species})` : ''}
      </p>
      {tree.season && (
        <p className="detail-row">
          <strong>Season:</strong> {tree.season}
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
      </p>
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
