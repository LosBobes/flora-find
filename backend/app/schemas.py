from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TreeBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    fruit_type: str = Field(min_length=1, max_length=80)
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
    fruit_type: str | None = Field(default=None, min_length=1, max_length=80)
    species: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    season_start: int | None = Field(default=None, ge=1, le=12)
    season_end: int | None = Field(default=None, ge=1, le=12)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    content_type: str


class TreeOut(TreeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    owner: UserOut
    photos: list[PhotoOut] = []
    in_season: bool = False
    distance_km: float | None = None
