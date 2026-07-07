from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..database import get_db
from ..models import DEFAULT_LANGUAGE, PlantType, User
from ..schemas import PlantCategory, PlantTypeCreate, PlantTypeOut

router = APIRouter(prefix="/api/plant-types", tags=["plant-types"])


@router.get("", response_model=list[PlantTypeOut])
def list_plant_types(
    category: PlantCategory | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(PlantType)
    if category:
        query = query.filter(PlantType.category == category)
    types = query.all()
    # Sort by the canonical (English) name for a stable, alphabetical dropdown.
    types.sort(key=lambda pt: pt.canonical.lower())
    return types


@router.post("", response_model=PlantTypeOut, status_code=status.HTTP_201_CREATED)
def create_plant_type(
    payload: PlantTypeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin-only: add a new plant type with a name in every supported language."""
    canonical = payload.names[DEFAULT_LANGUAGE].strip().lower()
    existing = next(
        (pt for pt in db.query(PlantType).all() if pt.canonical.strip().lower() == canonical),
        None,
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="A plant type with this name already exists")

    plant_type = PlantType(category=payload.category, names=payload.names)
    db.add(plant_type)
    db.commit()
    db.refresh(plant_type)
    return plant_type
