"""Admin-only endpoints backing the frontend admin panel: dashboard stats, user
management, a moderation view over every plant/area (delete anything, regardless
of owner), and a deliberately narrow read-only SQL console for ad-hoc lookups.

Everything here is guarded by ``get_current_admin`` (403 for non-admins). The
routes intentionally bypass the per-owner checks the public routers enforce — an
admin can delete or inspect any record."""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..database import get_db
from ..models import (
    Area,
    PlantType,
    Tree,
    TreeConfirmation,
    TreePhoto,
    User,
)
from ..schemas import (
    AdminAreaRow,
    AdminSqlQuery,
    AdminSqlResult,
    AdminStats,
    AdminTreeRow,
    AdminUserOut,
    AdminUserUpdate,
)
from ..storage import UPLOAD_DIR

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

# Cap how much a single admin list / SQL call can return so a huge table can't
# blow up the browser.
MAX_ROWS = 500


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db)):
    trees = db.query(Tree).all()
    flagged = sum(1 for t in trees if t.flagged_gone)
    return AdminStats(
        users=db.query(User).count(),
        admins=db.query(User).filter(User.is_admin.is_(True)).count(),
        trees=len(trees),
        areas=db.query(Area).count(),
        confirmations=db.query(TreeConfirmation).count(),
        photos=db.query(TreePhoto).count(),
        plant_types=db.query(PlantType).count(),
        flagged_trees=flagged,
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    q: str | None = Query(default=None, description="Filter by username or email"),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((User.username.ilike(like)) | (User.email.ilike(like)))
    users = query.order_by(User.created_at.desc()).limit(MAX_ROWS).all()

    # One grouped count each for trees and areas, so the table can show how much
    # every user has contributed without an N+1 of per-user queries.
    tree_counts = dict(
        db.query(Tree.owner_id, func.count(Tree.id)).group_by(Tree.owner_id).all()
    )
    area_counts = dict(
        db.query(Area.owner_id, func.count(Area.id)).group_by(Area.owner_id).all()
    )
    return [
        AdminUserOut(
            id=u.id,
            email=u.email,
            username=u.username,
            is_admin=u.is_admin,
            created_at=u.created_at,
            tree_count=tree_counts.get(u.id, 0),
            area_count=area_counts.get(u.id, 0),
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Guard against an admin accidentally locking themselves out of admin.
    if user.id == current_admin.id and not payload.is_admin:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access")
    user.is_admin = payload.is_admin
    db.commit()
    db.refresh(user)
    return AdminUserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        is_admin=user.is_admin,
        created_at=user.created_at,
        tree_count=db.query(Tree).filter(Tree.owner_id == user.id).count(),
        area_count=db.query(Area).filter(Area.owner_id == user.id).count(),
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a user and everything they own (plants, areas, photos on disk,
    confirmations). Irreversible; blocked for the calling admin's own account."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    trees = db.query(Tree).filter(Tree.owner_id == user_id).all()
    filenames = [photo.filename for tree in trees for photo in tree.photos]
    # Confirmations this user cast on *other* people's trees (their own trees'
    # confirmations cascade with the tree).
    db.query(TreeConfirmation).filter(TreeConfirmation.user_id == user_id).delete(
        synchronize_session=False
    )
    for tree in trees:
        db.delete(tree)  # cascades photos + confirmations
    for area in db.query(Area).filter(Area.owner_id == user_id).all():
        db.delete(area)
    db.delete(user)
    db.commit()
    for filename in filenames:
        (UPLOAD_DIR / filename).unlink(missing_ok=True)


@router.get("/trees", response_model=list[AdminTreeRow])
def list_trees(
    q: str | None = Query(default=None),
    flagged: bool = Query(default=False, description="Only trees flagged as gone"),
    db: Session = Depends(get_db),
):
    query = db.query(Tree)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (Tree.name.ilike(like))
            | (Tree.fruit_type.ilike(like))
            | (Tree.species.ilike(like))
        )
    trees = query.order_by(Tree.created_at.desc()).limit(MAX_ROWS).all()
    if flagged:
        trees = [t for t in trees if t.flagged_gone]
    return trees


@router.delete("/trees/{tree_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tree(tree_id: int, db: Session = Depends(get_db)):
    """Delete any plant, regardless of owner (moderation override)."""
    tree = db.get(Tree, tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    filenames = [photo.filename for photo in tree.photos]
    db.delete(tree)
    db.commit()
    for filename in filenames:
        (UPLOAD_DIR / filename).unlink(missing_ok=True)


@router.get("/areas", response_model=list[AdminAreaRow])
def list_areas(q: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Area)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((Area.name.ilike(like)) | (Area.fruit_type.ilike(like)))
    return query.order_by(Area.created_at.desc()).limit(MAX_ROWS).all()


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(area_id: int, db: Session = Depends(get_db)):
    area = db.get(Area, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    db.delete(area)
    db.commit()


# --- read-only SQL console -------------------------------------------------
# A deliberately narrow "crude DB access" affordance: run one read-only SELECT
# and see the rows. We reject anything that isn't a single SELECT/WITH statement
# and blacklist write/DDL keywords so this can't mutate the database even if the
# driver would otherwise allow it. This is a convenience for an admin who already
# has full delete power through the UI, not a security boundary against them.
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|"
    r"pragma|vacuum|reindex|grant|revoke|commit|rollback|savepoint|copy)\b",
    re.IGNORECASE,
)


@router.post("/sql", response_model=AdminSqlResult)
def run_sql(payload: AdminSqlQuery, db: Session = Depends(get_db)):
    raw = payload.sql.strip().rstrip(";").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty query")
    # Single statement only — no chaining a write after a SELECT.
    if ";" in raw:
        raise HTTPException(status_code=400, detail="Only a single statement is allowed")
    lowered = raw.lstrip("(").lower()
    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed")
    if _FORBIDDEN.search(raw):
        raise HTTPException(status_code=400, detail="Query contains a disallowed keyword")

    try:
        result = db.execute(text(raw))
        columns = list(result.keys())
        fetched = result.fetchmany(MAX_ROWS + 1)
    except Exception as exc:  # noqa: BLE001 — surface the DB error text to the admin
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Query error: {exc}") from exc
    finally:
        # Never let a console query leave a transaction open.
        db.rollback()

    truncated = len(fetched) > MAX_ROWS
    rows = [[_jsonable(v) for v in row] for row in fetched[:MAX_ROWS]]
    return AdminSqlResult(
        columns=columns, rows=rows, row_count=len(rows), truncated=truncated
    )


def _jsonable(value):
    """Coerce DB values into something JSON-serialisable for the grid."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
