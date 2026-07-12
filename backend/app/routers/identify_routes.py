"""Photo-based plant identification.

A thin HTTP layer over :mod:`app.identify`: one endpoint reports whether the
feature is configured (so the frontend can hide a dead button), the other takes
an uploaded photo and returns ranked, form-ready suggestions. Requires a signed-in
user, matching the rest of the contribution flow and keeping the shared Pl@ntNet
quota from being spent anonymously.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import identify as identify_service
from ..auth import get_current_user
from ..database import get_db
from ..models import PlantType, User
from ..schemas import IdentifyConfig, IdentifyResponse, IdentifySuggestion
from ..storage import ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES

router = APIRouter(prefix="/api/identify", tags=["identify"])


@router.get("/config", response_model=IdentifyConfig)
def identify_config():
    """Public: whether photo identification is available on this server."""
    return IdentifyConfig(enabled=identify_service.enabled())


@router.post("", response_model=IdentifyResponse)
def identify_plant(
    image: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Identify a plant from a single photo and return ranked suggestions."""
    if not identify_service.enabled():
        raise HTTPException(
            status_code=503, detail="Plant identification is not available on this server."
        )

    if ALLOWED_PHOTO_TYPES.get(image.content_type) is None:
        allowed = ", ".join(sorted(ALLOWED_PHOTO_TYPES))
        raise HTTPException(status_code=415, detail=f"Unsupported photo type. Use one of: {allowed}")

    data = image.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=413, detail=f"Photos must be at most {MAX_PHOTO_BYTES // (1024 * 1024)} MB"
        )
    if not data:
        raise HTTPException(status_code=400, detail="Empty photo upload")

    try:
        candidates = identify_service.identify(
            data, image.content_type, image.filename or "photo"
        )
    except identify_service.IdentifyError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    known_types = {
        pt.canonical.strip().lower() for pt in db.query(PlantType).all() if pt.canonical
    }
    suggestions = [
        IdentifySuggestion(**identify_service.build_suggestion(candidate, known_types))
        for candidate in candidates
    ]
    return IdentifyResponse(suggestions=suggestions)
