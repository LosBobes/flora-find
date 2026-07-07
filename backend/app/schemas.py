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


PlantCategory = Literal["fruit_tree", "tree", "shrub", "flowerbed", "vine", "other"]


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
    distance_km: float | None = None
