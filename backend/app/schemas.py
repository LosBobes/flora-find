from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .models import SUPPORTED_LANGUAGES


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    is_admin: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


PlantCategory = Literal[
    "fruit_tree", "tree", "evergreen", "shrub", "flowerbed", "vine", "fungi", "other"
]


class PlantTypeCreate(BaseModel):
    category: PlantCategory
    # A display name for every supported language, e.g. {"en": "Cherry", "sr": "Trešnja"}.
    names: dict[str, str]

    @field_validator("names")
    @classmethod
    def all_languages_present(cls, value: dict[str, str]) -> dict[str, str]:
        cleaned = {lang: (value.get(lang) or "").strip() for lang in SUPPORTED_LANGUAGES}
        missing = [lang for lang, name in cleaned.items() if not name]
        if missing:
            raise ValueError(f"A name is required for every language: missing {', '.join(missing)}")
        return cleaned


class PlantTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: PlantCategory
    names: dict[str, str]


class ProfileBadge(BaseModel):
    """One entry in a user's contribution catalog: how many plants (points and
    areas together) of a given category/type they have added. Carries ``hazard``
    so the frontend can render the same marker artwork the plant gets on the map."""

    category: PlantCategory
    fruit_type: str
    count: int
    hazard: bool = False


class ProfileOut(BaseModel):
    user: UserOut
    member_since: datetime
    plant_count: int
    area_count: int
    # The catalog: one "badge" per distinct plant type the user has contributed,
    # ordered most-added first.
    badges: list[ProfileBadge] = []


class TreeBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: PlantCategory = "fruit_tree"
    fruit_type: str = Field(
        min_length=1,
        max_length=80,
        description="Type label: the fruit for fruit trees, otherwise what the plant is "
        "(e.g. Oak, Tulips, Poison ivy)",
    )
    hazard: bool = Field(default=False, description="Poisonous or dangerous to touch/eat")
    species: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    season_start: int | None = Field(default=None, ge=1, le=12, description="First month in season (1-12)")
    season_end: int | None = Field(default=None, ge=1, le=12, description="Last month in season (1-12)")
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def fill_single_month_season(self):
        # A single month means the season starts and ends in that month.
        if self.season_start is None and self.season_end is not None:
            self.season_start = self.season_end
        elif self.season_end is None and self.season_start is not None:
            self.season_end = self.season_start
        return self


class TreeCreate(TreeBase):
    pass


class TreeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: PlantCategory | None = None
    fruit_type: str | None = Field(default=None, min_length=1, max_length=80)
    hazard: bool | None = None
    species: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    season_start: int | None = Field(default=None, ge=1, le=12)
    season_end: int | None = Field(default=None, ge=1, le=12)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


# The outer ring of an area: a list of [lng, lat] pairs (GeoJSON order). Kept
# unclosed (the first vertex is not repeated) and capped so a stray draw can't
# post a huge payload.
MAX_POLYGON_POINTS = 500


def _validate_polygon(points: list[list[float]]) -> list[list[float]]:
    if len(points) < 3:
        raise ValueError("An area needs at least 3 points")
    if len(points) > MAX_POLYGON_POINTS:
        raise ValueError(f"An area can have at most {MAX_POLYGON_POINTS} points")
    cleaned: list[list[float]] = []
    for point in points:
        if len(point) != 2:
            raise ValueError("Each point must be a [lng, lat] pair")
        lng, lat = float(point[0]), float(point[1])
        if not (-180 <= lng <= 180) or not (-90 <= lat <= 90):
            raise ValueError("Point out of range")
        cleaned.append([lng, lat])
    return cleaned


class AreaBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: PlantCategory = "fruit_tree"
    fruit_type: str = Field(min_length=1, max_length=80)
    hazard: bool = Field(default=False, description="Poisonous or dangerous to touch/eat")
    species: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    season_start: int | None = Field(default=None, ge=1, le=12)
    season_end: int | None = Field(default=None, ge=1, le=12)

    @model_validator(mode="after")
    def fill_single_month_season(self):
        if self.season_start is None and self.season_end is not None:
            self.season_start = self.season_end
        elif self.season_end is None and self.season_start is not None:
            self.season_end = self.season_start
        return self


class AreaCreate(AreaBase):
    polygon: list[list[float]]

    @field_validator("polygon")
    @classmethod
    def check_polygon(cls, value: list[list[float]]) -> list[list[float]]:
        return _validate_polygon(value)


class AreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: PlantCategory | None = None
    fruit_type: str | None = Field(default=None, min_length=1, max_length=80)
    hazard: bool | None = None
    species: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    season_start: int | None = Field(default=None, ge=1, le=12)
    season_end: int | None = Field(default=None, ge=1, le=12)
    polygon: list[list[float]] | None = None

    @field_validator("polygon")
    @classmethod
    def check_polygon(cls, value):
        return None if value is None else _validate_polygon(value)


class AreaOut(AreaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    polygon: list[list[float]]
    center_lat: float
    center_lng: float
    created_at: datetime
    owner: UserOut
    in_season: bool = False


class AdminStats(BaseModel):
    """Top-line counts for the admin dashboard."""

    users: int
    admins: int
    trees: int
    areas: int
    confirmations: int
    photos: int
    plant_types: int
    flagged_trees: int


class AdminUserOut(BaseModel):
    """A user row for the admin table, with a tally of what they've contributed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    is_admin: bool
    created_at: datetime
    tree_count: int = 0
    area_count: int = 0


class AdminUserUpdate(BaseModel):
    is_admin: bool


class AdminTreeRow(BaseModel):
    """A lean plant row for the admin entries table (no photos payload)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    fruit_type: str
    hazard: bool
    lat: float
    lng: float
    created_at: datetime
    owner: UserOut
    gone_reports: int = 0
    flagged_gone: bool = False


class AdminAreaRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    fruit_type: str
    hazard: bool
    center_lat: float
    center_lng: float
    created_at: datetime
    owner: UserOut


class AdminSqlQuery(BaseModel):
    sql: str = Field(min_length=1, max_length=5000)


class AdminSqlResult(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = False


class IdentifyConfig(BaseModel):
    """Tells the frontend whether the photo-identification affordance should show."""

    enabled: bool


class IdentifySuggestion(BaseModel):
    """One candidate returned by photo identification, pre-mapped to FloraFind
    fields where the species is in our vocabulary so the form can auto-fill."""

    scientific_name: str
    common_name: str | None = None
    score: float
    category: PlantCategory | None = None
    fruit_type: str | None = None
    season_start: int | None = None
    season_end: int | None = None
    hazard: bool = False
    # Whether ``fruit_type`` is a known type the create endpoint will accept.
    known_type: bool = False


class IdentifyResponse(BaseModel):
    suggestions: list[IdentifySuggestion] = []


class ConfirmationCreate(BaseModel):
    status: Literal["present", "gone"]


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    content_type: str
    attribution: str | None = None
    source_url: str | None = None


class TreeOut(TreeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    owner: UserOut
    photos: list[PhotoOut] = []
    in_season: bool = False
    last_confirmed_at: datetime | None = None
    gone_reports: int = 0
    flagged_gone: bool = False
    # Ephemeral finds (fungi) age out of "fresh" on their own; persistent plants
    # don't. ``fresh_until`` is null and ``stale`` false for non-ephemeral plants.
    ephemeral: bool = False
    fresh_until: datetime | None = None
    stale: bool = False
    distance_km: float | None = None
