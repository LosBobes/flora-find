"""Endpoints for drawn plant areas (polygons).

Areas mirror the descriptive side of trees (category, type, hazard, season,
notes) but are anchored to a polygon instead of a single point. They live under
``/api/areas`` and reuse the tree router's plant-type vocabulary check so an area
can only be tagged with a known type. Ownership is enforced on edit/delete the
same way trees are.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import Area, User, polygon_centroid, utcnow
from ..schemas import AreaCreate, AreaOut, AreaUpdate, PlantCategory
from .tree_routes import ensure_known_plant_type

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("", response_model=list[AreaOut])
def list_areas(
    q: str | None = Query(default=None, description="Free-text search over name, type, species, notes"),
    fruit_type: str | None = Query(default=None),
    category: PlantCategory | None = Query(default=None),
    hazard: bool | None = Query(default=None),
    ripe_now: bool = Query(default=False, description="Only areas currently in season"),
    min_lat: float | None = Query(default=None, ge=-90, le=90),
    max_lat: float | None = Query(default=None, ge=-90, le=90),
    min_lng: float | None = Query(default=None, ge=-180, le=180),
    max_lng: float | None = Query(default=None, ge=-180, le=180),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    query = db.query(Area).options(joinedload(Area.owner))

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(Area.name).like(like),
                func.lower(Area.fruit_type).like(like),
                func.lower(Area.species).like(like),
                func.lower(Area.description).like(like),
            )
        )
    if fruit_type:
        query = query.filter(func.lower(Area.fruit_type) == fruit_type.lower())
    if category:
        query = query.filter(Area.category == category)
    if hazard is not None:
        query = query.filter(Area.hazard == hazard)

    if ripe_now:
        month = utcnow().month
        query = query.filter(
            Area.season_start.isnot(None),
            Area.season_end.isnot(None),
            or_(
                and_(
                    Area.season_start <= Area.season_end,
                    Area.season_start <= month,
                    Area.season_end >= month,
                ),
                # Season wraps around the new year, e.g. November-February.
                and_(
                    Area.season_start > Area.season_end,
                    or_(Area.season_start <= month, Area.season_end >= month),
                ),
            ),
        )

    # Viewport filter on the centroid, mirroring how trees are filtered.
    if min_lat is not None and max_lat is not None:
        query = query.filter(Area.center_lat >= min_lat, Area.center_lat <= max_lat)
    if min_lng is not None and max_lng is not None:
        if min_lng <= max_lng:
            query = query.filter(Area.center_lng >= min_lng, Area.center_lng <= max_lng)
        else:
            query = query.filter(or_(Area.center_lng >= min_lng, Area.center_lng <= max_lng))

    return query.order_by(Area.created_at.desc()).limit(limit).all()


@router.get("/{area_id}", response_model=AreaOut)
def get_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(Area).options(joinedload(Area.owner)).filter(Area.id == area_id).first()
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    return area


@router.post("", response_model=AreaOut, status_code=status.HTTP_201_CREATED)
def create_area(
    payload: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_known_plant_type(db, payload.fruit_type)
    center_lat, center_lng = polygon_centroid(payload.polygon)
    area = Area(
        **payload.model_dump(),
        center_lat=center_lat,
        center_lng=center_lng,
        owner_id=current_user.id,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put("/{area_id}", response_model=AreaOut)
def update_area(
    area_id: int,
    payload: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    area = db.get(Area, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    if area.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit areas you drew")
    if payload.fruit_type is not None:
        ensure_known_plant_type(db, payload.fruit_type)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(area, field, value)
    if "polygon" in data and data["polygon"] is not None:
        area.center_lat, area.center_lng = polygon_centroid(data["polygon"])
    db.commit()
    db.refresh(area)
    return area


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    area = db.get(Area, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    if area.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete areas you drew")
    db.delete(area)
    db.commit()
