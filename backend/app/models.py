from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
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
    fruit_type: Mapped[str] = mapped_column(String(80), index=True)
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
