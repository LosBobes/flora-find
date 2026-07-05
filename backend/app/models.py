from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
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


class Tree(Base):
    __tablename__ = "trees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    fruit_type: Mapped[str] = mapped_column(String(80), index=True)
    species: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    season: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lat: Mapped[float] = mapped_column(Float, index=True)
    lng: Mapped[float] = mapped_column(Float, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    owner: Mapped[User] = relationship(back_populates="trees")
