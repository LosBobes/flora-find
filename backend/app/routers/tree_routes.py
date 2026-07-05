import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import Tree, User
from ..schemas import TreeCreate, TreeOut, TreeUpdate

router = APIRouter(prefix="/api/trees", tags=["trees"])

EARTH_RADIUS_KM = 6371.0


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
    query = db.query(Tree).options(joinedload(Tree.owner))

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
def fruit_types(db: Session = Depends(get_db)):
    rows = db.query(Tree.fruit_type).distinct().order_by(Tree.fruit_type).all()
    return [row[0] for row in rows]


@router.get("/{tree_id}", response_model=TreeOut)
def get_tree(tree_id: int, db: Session = Depends(get_db)):
    tree = db.query(Tree).options(joinedload(Tree.owner)).filter(Tree.id == tree_id).first()
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@router.post("", response_model=TreeOut, status_code=status.HTTP_201_CREATED)
def create_tree(
    payload: TreeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    db.delete(tree)
    db.commit()
