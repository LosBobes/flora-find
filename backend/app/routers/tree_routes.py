import csv
import io
import json
import math
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from ..auth import get_current_admin, get_current_user
from ..database import get_db
from ..models import PlantType, Tree, TreeConfirmation, TreePhoto, User, utcnow
from ..schemas import ConfirmationCreate, PhotoOut, PlantCategory, TreeCreate, TreeOut, TreeUpdate
from ..storage import ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_TREE, UPLOAD_DIR

router = APIRouter(prefix="/api/trees", tags=["trees"])

EARTH_RADIUS_KM = 6371.0


def ensure_known_plant_type(db: Session, fruit_type: str) -> None:
    """Plants may only use a type from the managed vocabulary. Any signed-in user
    can add new types via /api/plant-types; here we just require the type exists."""
    wanted = fruit_type.strip().lower()
    exists = any(pt.canonical.strip().lower() == wanted for pt in db.query(PlantType).all())
    if not exists:
        raise HTTPException(
            status_code=400,
            detail="Unknown plant type. Pick one from the list, or add it as a new type.",
        )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


@router.get("", response_model=list[TreeOut])
def list_trees(
    q: str | None = Query(default=None, description="Free-text search over name, fruit type, species, description"),
    fruit_type: str | None = Query(default=None),
    category: PlantCategory | None = Query(default=None),
    hazard: bool | None = Query(
        default=None, description="true = only hazardous plants, false = exclude them"
    ),
    ripe_now: bool = Query(default=False, description="Only trees currently in season"),
    min_lat: float | None = Query(default=None, ge=-90, le=90),
    max_lat: float | None = Query(default=None, ge=-90, le=90),
    min_lng: float | None = Query(default=None, ge=-180, le=180),
    max_lng: float | None = Query(default=None, ge=-180, le=180),
    lat: float | None = Query(default=None, ge=-90, le=90, description="Center for radius search"),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    query = db.query(Tree).options(
        joinedload(Tree.owner), selectinload(Tree.photos), selectinload(Tree.confirmations)
    )

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(Tree.name).like(like),
                func.lower(Tree.fruit_type).like(like),
                func.lower(Tree.species).like(like),
                func.lower(Tree.description).like(like),
            )
        )
    if fruit_type:
        query = query.filter(func.lower(Tree.fruit_type) == fruit_type.lower())
    if category:
        query = query.filter(Tree.category == category)
    if hazard is not None:
        query = query.filter(Tree.hazard == hazard)

    if ripe_now:
        month = utcnow().month
        query = query.filter(
            Tree.season_start.isnot(None),
            Tree.season_end.isnot(None),
            or_(
                and_(
                    Tree.season_start <= Tree.season_end,
                    Tree.season_start <= month,
                    Tree.season_end >= month,
                ),
                # Season wraps around the new year, e.g. November-February.
                and_(
                    Tree.season_start > Tree.season_end,
                    or_(Tree.season_start <= month, Tree.season_end >= month),
                ),
            ),
        )

    # Viewport (bounding box) filter, e.g. current map bounds.
    if min_lat is not None and max_lat is not None:
        query = query.filter(Tree.lat >= min_lat, Tree.lat <= max_lat)
    if min_lng is not None and max_lng is not None:
        if min_lng <= max_lng:
            query = query.filter(Tree.lng >= min_lng, Tree.lng <= max_lng)
        else:
            # Viewport crosses the antimeridian.
            query = query.filter(or_(Tree.lng >= min_lng, Tree.lng <= max_lng))

    # Radius search: prefilter with a bounding box in SQL, then refine in Python.
    center = None
    if lat is not None and lng is not None and radius_km is not None:
        center = (lat, lng)
        dlat = math.degrees(radius_km / EARTH_RADIUS_KM)
        cos_lat = max(math.cos(math.radians(lat)), 1e-6)
        dlng = math.degrees(radius_km / (EARTH_RADIUS_KM * cos_lat))
        query = query.filter(Tree.lat >= lat - dlat, Tree.lat <= lat + dlat)
        if dlng < 180:
            query = query.filter(Tree.lng >= lng - dlng, Tree.lng <= lng + dlng)

    trees = query.order_by(Tree.created_at.desc()).limit(limit * 4 if center else limit).all()

    results = []
    for tree in trees:
        out = TreeOut.model_validate(tree)
        if center:
            out.distance_km = round(haversine_km(center[0], center[1], tree.lat, tree.lng), 3)
            if out.distance_km > radius_km:
                continue
        results.append(out)

    if center:
        results.sort(key=lambda t: t.distance_km)
    return results[:limit]


@router.get("/fruit-types", response_model=list[str])
def fruit_types(category: PlantCategory | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Tree.fruit_type).distinct()
    if category:
        query = query.filter(Tree.category == category)
    rows = query.order_by(Tree.fruit_type).all()
    return [row[0] for row in rows]


EXPORT_FIELDS = [
    "id", "name", "category", "fruit_type", "hazard", "species", "description",
    "season_start", "season_end", "lat", "lng", "owner", "gone_reports",
    "last_confirmed_at", "created_at",
]


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _tree_record(tree: Tree) -> dict:
    return {
        "id": tree.id,
        "name": tree.name,
        "category": tree.category,
        "fruit_type": tree.fruit_type,
        "hazard": tree.hazard,
        "species": tree.species,
        "description": tree.description,
        "season_start": tree.season_start,
        "season_end": tree.season_end,
        "lat": tree.lat,
        "lng": tree.lng,
        "owner": tree.owner.username if tree.owner else None,
        "gone_reports": tree.gone_reports,
        "last_confirmed_at": _iso(tree.last_confirmed_at),
        "created_at": _iso(tree.created_at),
    }


def _trees_to_geojson(trees: list[Tree]) -> str:
    features = []
    for tree in trees:
        record = _tree_record(tree)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [tree.lng, tree.lat]},
                "properties": {k: v for k, v in record.items() if k not in ("lat", "lng")},
            }
        )
    return json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False)


def _trees_to_csv(trees: list[Tree]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for tree in trees:
        record = _tree_record(tree)
        # Keep descriptions on a single CSV line.
        if record.get("description"):
            record["description"] = " ".join(record["description"].split())
        writer.writerow({k: ("" if v is None else v) for k, v in record.items()})
    return buffer.getvalue()


@router.get("/export")
def export_trees(
    min_lat: float = Query(..., ge=-90, le=90, description="South edge of the area"),
    max_lat: float = Query(..., ge=-90, le=90, description="North edge of the area"),
    min_lng: float = Query(..., ge=-180, le=180, description="West edge of the area"),
    max_lng: float = Query(..., ge=-180, le=180, description="East edge of the area"),
    format: Literal["geojson", "csv"] = Query("geojson", description="Export file format"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin-only: export every plant inside a map rectangle as GeoJSON or CSV."""
    if min_lat > max_lat:
        raise HTTPException(status_code=400, detail="min_lat must be <= max_lat")

    query = (
        db.query(Tree)
        .options(joinedload(Tree.owner), selectinload(Tree.confirmations))
        .filter(Tree.lat >= min_lat, Tree.lat <= max_lat)
    )
    if min_lng <= max_lng:
        query = query.filter(Tree.lng >= min_lng, Tree.lng <= max_lng)
    else:
        # Area crosses the antimeridian.
        query = query.filter(or_(Tree.lng >= min_lng, Tree.lng <= max_lng))
    trees = query.order_by(Tree.created_at.desc()).all()

    if format == "csv":
        content = _trees_to_csv(trees)
        media_type = "text/csv"
        filename = "florafind-export.csv"
    else:
        content = _trees_to_geojson(trees)
        media_type = "application/geo+json"
        filename = "florafind-export.geojson"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Count": str(len(trees)),
        },
    )


@router.get("/{tree_id}", response_model=TreeOut)
def get_tree(tree_id: int, db: Session = Depends(get_db)):
    tree = (
        db.query(Tree)
        .options(joinedload(Tree.owner), selectinload(Tree.photos))
        .filter(Tree.id == tree_id)
        .first()
    )
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@router.post("", response_model=TreeOut, status_code=status.HTTP_201_CREATED)
def create_tree(
    payload: TreeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_known_plant_type(db, payload.fruit_type)
    tree = Tree(**payload.model_dump(), owner_id=current_user.id)
    db.add(tree)
    db.commit()
    db.refresh(tree)
    return tree


@router.put("/{tree_id}", response_model=TreeOut)
def update_tree(
    tree_id: int,
    payload: TreeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tree = db.get(Tree, tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    if tree.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit trees you registered")
    if payload.fruit_type is not None:
        ensure_known_plant_type(db, payload.fruit_type)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tree, field, value)
    db.commit()
    db.refresh(tree)
    return tree


@router.delete("/{tree_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tree(
    tree_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tree = db.get(Tree, tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    if tree.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete trees you registered")
    filenames = [photo.filename for photo in tree.photos]
    db.delete(tree)
    db.commit()
    for filename in filenames:
        (UPLOAD_DIR / filename).unlink(missing_ok=True)


@router.post("/{tree_id}/confirmations", response_model=TreeOut)
def confirm_tree(
    tree_id: int,
    payload: ConfirmationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tree = db.get(Tree, tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")

    # One vote per user per tree: a new vote replaces the previous one.
    confirmation = (
        db.query(TreeConfirmation)
        .filter(TreeConfirmation.tree_id == tree_id, TreeConfirmation.user_id == current_user.id)
        .first()
    )
    if confirmation is None:
        confirmation = TreeConfirmation(tree_id=tree_id, user_id=current_user.id)
        db.add(confirmation)
    confirmation.status = payload.status
    confirmation.created_at = utcnow()
    db.commit()
    db.refresh(tree)
    return tree


@router.post("/{tree_id}/photos", response_model=list[PhotoOut], status_code=status.HTTP_201_CREATED)
def upload_photos(
    tree_id: int,
    files: list[UploadFile],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tree = db.get(Tree, tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    if tree.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only add photos to trees you registered")
    if len(tree.photos) + len(files) > MAX_PHOTOS_PER_TREE:
        raise HTTPException(
            status_code=400, detail=f"A tree can have at most {MAX_PHOTOS_PER_TREE} photos"
        )

    photos = []
    for file in files:
        extension = ALLOWED_PHOTO_TYPES.get(file.content_type)
        if extension is None:
            allowed = ", ".join(sorted(ALLOWED_PHOTO_TYPES))
            raise HTTPException(status_code=415, detail=f"Unsupported photo type. Use one of: {allowed}")
        data = file.file.read(MAX_PHOTO_BYTES + 1)
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=413, detail=f"Photos must be at most {MAX_PHOTO_BYTES // (1024 * 1024)} MB"
            )
        if not data:
            raise HTTPException(status_code=400, detail="Empty photo upload")
        photos.append((f"{secrets.token_hex(12)}{extension}", file.content_type, data))

    saved = []
    for filename, content_type, data in photos:
        (UPLOAD_DIR / filename).write_bytes(data)
        photo = TreePhoto(filename=filename, content_type=content_type, tree=tree)
        db.add(photo)
        saved.append(photo)
    db.commit()
    for photo in saved:
        db.refresh(photo)
    return saved


@router.delete("/{tree_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    tree_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = db.get(TreePhoto, photo_id)
    if photo is None or photo.tree_id != tree_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.tree.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only remove photos from trees you registered")
    filename = photo.filename
    db.delete(photo)
    db.commit()
    (UPLOAD_DIR / filename).unlink(missing_ok=True)
