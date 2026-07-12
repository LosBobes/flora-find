from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Area, Tree, User
from ..schemas import ProfileBadge, ProfileOut, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}/profile", response_model=ProfileOut)
def get_profile(user_id: int, db: Session = Depends(get_db)):
    """Public contribution profile: how much a user has added and a catalog of
    the plant types they've contributed, as "badges" the map can render."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    trees = db.query(Tree).filter(Tree.owner_id == user_id).all()
    areas = db.query(Area).filter(Area.owner_id == user_id).all()

    # Tally distinct (category, type) contributions across both points and areas.
    # A type counts as a hazard badge if any of the user's plants of that type is
    # flagged, so the badge gets the warning artwork.
    tally: dict[tuple[str, str], dict] = {}
    for item in (*trees, *areas):
        key = (item.category, item.fruit_type)
        badge = tally.setdefault(
            key,
            {"category": item.category, "fruit_type": item.fruit_type, "count": 0, "hazard": False},
        )
        badge["count"] += 1
        if item.hazard:
            badge["hazard"] = True

    badges = sorted(tally.values(), key=lambda b: (-b["count"], b["fruit_type"].lower()))

    return ProfileOut(
        user=UserOut.model_validate(user),
        member_since=user.created_at,
        plant_count=len(trees),
        area_count=len(areas),
        badges=[ProfileBadge(**badge) for badge in badges],
    )
