from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    trees: Mapped[list["Tree"]] = relationship(back_populates="owner")


# Trees reported gone by at least this many users get flagged in the UI.
GONE_FLAG_THRESHOLD = 3

# What kind of planting an entry is. "fruit_tree" keeps the original FloraFind
# behaviour; the rest let the map hold ornamental trees, shrubs, flowerbeds,
# vines and anything else growing in the neighbourhood.
PLANT_CATEGORIES = ("fruit_tree", "tree", "shrub", "flowerbed", "vine", "other")


def month_in_season(month: int, start: int | None, end: int | None) -> bool:
    if start is None or end is None:
        return False
    if start <= end:
        return start <= month <= end
    # Season wraps around the new year, e.g. November-February.
    return month >= start or month <= end


class Tree(Base):
    __tablename__ = "trees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(
        String(20), default="fruit_tree", server_default="fruit_tree", index=True
    )
    # Generic type label: the fruit for fruit trees ("Cherry"), otherwise what
    # the plant is ("Oak", "Tulips", "Poison ivy").
    fruit_type: Mapped[str] = mapped_column(String(80), index=True)
    # Poisonous or otherwise dangerous to touch/eat (poison ivy, giant hogweed…).
    hazard: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", index=True)
    species: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    season_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    season_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lat: Mapped[float] = mapped_column(Float, index=True)
    lng: Mapped[float] = mapped_column(Float, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    @property
    def in_season(self) -> bool:
        return month_in_season(utcnow().month, self.season_start, self.season_end)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    owner: Mapped[User] = relationship(back_populates="trees")

    photos: Mapped[list["TreePhoto"]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
    confirmations: Mapped[list["TreeConfirmation"]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )

    @property
    def last_confirmed_at(self) -> datetime | None:
        dates = [c.created_at for c in self.confirmations if c.status == "present"]
        return max(dates) if dates else None

    @property
    def gone_reports(self) -> int:
        return sum(1 for c in self.confirmations if c.status == "gone")

    @property
    def flagged_gone(self) -> bool:
        return self.gone_reports >= GONE_FLAG_THRESHOLD


class TreeConfirmation(Base):
    __tablename__ = "tree_confirmations"
    __table_args__ = (UniqueConstraint("tree_id", "user_id", name="uq_confirmation_tree_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(10))  # "present" | "gone"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    tree_id: Mapped[int] = mapped_column(ForeignKey("trees.id"), index=True)
    tree: Mapped[Tree] = relationship(back_populates="confirmations")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    user: Mapped[User] = relationship()


class TreePhoto(Base):
    __tablename__ = "tree_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    tree_id: Mapped[int] = mapped_column(ForeignKey("trees.id"), index=True)
    tree: Mapped[Tree] = relationship(back_populates="photos")

    @property
    def url(self) -> str:
        return f"/uploads/{self.filename}"
