"""Lightweight startup migrations for schema changes that create_all can't apply."""

import re

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

_MONTH_PATTERN = re.compile(
    r"\b(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\b", re.IGNORECASE
)


def parse_season_text(season: str | None) -> tuple[int | None, int | None]:
    """Extract (season_start, season_end) months from legacy free-text like 'June–July'."""
    if not season:
        return None, None
    found = [MONTHS[match.lower()] for match in _MONTH_PATTERN.findall(season)]
    if not found:
        return None, None
    return found[0], found[-1]


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    if "trees" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("trees")}
    # Backfill from the legacy free-text `season` column only when the structured
    # columns are first added; the old column is kept in place so this stays reversible.
    backfill = "season" in columns and "season_start" not in columns

    with engine.begin() as conn:
        if "category" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE trees ADD COLUMN category VARCHAR(20) "
                    "NOT NULL DEFAULT 'fruit_tree'"
                )
            )
        if "hazard" not in columns:
            conn.execute(text("ALTER TABLE trees ADD COLUMN hazard BOOLEAN NOT NULL DEFAULT 0"))
        if "season_start" not in columns:
            conn.execute(text("ALTER TABLE trees ADD COLUMN season_start INTEGER"))
        if "season_end" not in columns:
            conn.execute(text("ALTER TABLE trees ADD COLUMN season_end INTEGER"))
        if backfill:
            rows = conn.execute(
                text("SELECT id, season FROM trees WHERE season IS NOT NULL")
            ).all()
            for tree_id, season in rows:
                start, end = parse_season_text(season)
                if start is not None:
                    conn.execute(
                        text(
                            "UPDATE trees SET season_start = :start, season_end = :end "
                            "WHERE id = :id"
                        ),
                        {"start": start, "end": end, "id": tree_id},
                    )
