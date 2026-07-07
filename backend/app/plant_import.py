"""Shared plumbing for the bulk importers (``import_osm.py``, ``import_gbif.py``).

Every importer boils down to the same shape: turn a source record into a
``PlantInfo`` (via ``app.species_map.classify``), dedupe it against what's already
on the map, and insert a ``Tree``. This module owns the dedupe + insert so each
importer only has to parse its own source format. See ``docs/SEED_DATA_SOURCES.md``.
"""

from sqlalchemy.orm import Session

from .models import Tree
from .species_map import PlantInfo

# Two plants within ~11 m (coordinates rounded to 4 decimals) are treated as the
# same planting, so re-running an import or overlapping sources don't duplicate.
_COORD_PRECISION = 4


def dedup_key(lat: float, lng: float) -> tuple[float, float]:
    return (round(lat, _COORD_PRECISION), round(lng, _COORD_PRECISION))


def load_existing_keys(db: Session) -> set[tuple[float, float]]:
    return {dedup_key(lat, lng) for lat, lng in db.query(Tree.lat, Tree.lng).all()}


def add_plant(
    db: Session,
    existing: set,
    contributor_id: int,
    *,
    lat: float,
    lng: float,
    info: PlantInfo,
    name: str,
    species: str | None = None,
    description: str | None = None,
) -> bool:
    """Insert one plant unless a plant already sits at the same rounded spot.

    ``existing`` is mutated so callers can dedupe within a single batch too.
    Returns ``True`` if a row was added, ``False`` if it was a duplicate.
    """
    key = dedup_key(lat, lng)
    if key in existing:
        return False
    existing.add(key)
    db.add(
        Tree(
            name=name[:120],
            category=info.category,
            fruit_type=info.fruit_type,
            lat=lat,
            lng=lng,
            species=species,
            description=description,
            season_start=info.season_start,
            season_end=info.season_end,
            hazard=info.hazard,
            owner_id=contributor_id,
        )
    )
    return True
