"""Network enrichment helpers used by ``enrich.py``.

Two independent capabilities, both rate-limited and disk-cached so re-runs and
polite usage are cheap:

  * **Reverse geocoding (task #4)** turns a plant's ``(lat, lng)`` into a readable
    locality via OpenStreetMap's Nominatim, so an imported point can be named
    "Fig near Cara Dušana, Dorćol" instead of "Fig (Ficus carica)".
  * **Species photos (task #3)** resolve a Latin species to a representative,
    correctly-attributed Creative Commons image via Wikidata (P18) + Wikimedia
    Commons, so imported plants aren't photoless.

Both are best-effort: any network hiccup returns ``None`` rather than raising, so
enrichment never blocks an import. See ``docs/SEED_DATA_SOURCES.md``.
"""

import html
import json
import os
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

# Nominatim and the Wikimedia APIs both require a descriptive User-Agent that
# identifies the app; requests without one get blocked.
USER_AGENT = "FloraFind-enrich/1.0 (https://github.com/Vbatocanin/flora-find)"
CACHE_DIR = Path(os.environ.get("FLORA_CACHE_DIR", "./.florafind_cache"))

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


class JsonCache:
    """A tiny persistent dict backed by a JSON file. Failures degrade to no-op."""

    def __init__(self, name: str):
        self.path = CACHE_DIR / name
        self.data: dict = {}
        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text())
            except (OSError, ValueError):
                self.data = {}

    def get(self, key, default=None):
        return self.data.get(key, default)

    def set(self, key, value):
        self.data[key] = value
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self.data))
        except OSError:
            pass


_geocode_cache = JsonCache("geocode.json")
_species_cache = JsonCache("species_images.json")
# Last-call timestamps for per-service rate limiting.
_last = {"nominatim": 0.0, "wiki": 0.0}


def _rate_limit(service: str, min_interval: float) -> None:
    elapsed = time.monotonic() - _last[service]
    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)
    _last[service] = time.monotonic()


def _client(client, timeout=30.0):
    return client or httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT})


# --- Reverse geocoding (task #4) ----------------------------------------------

def reverse_geocode(lat: float, lng: float, *, client=None) -> dict | None:
    """Nominatim reverse lookup -> address-parts dict (cached, <=1 req/s)."""
    key = f"{round(lat, 5)},{round(lng, 5)}"
    cached = _geocode_cache.get(key)
    if cached is not None:
        return cached or None

    _rate_limit("nominatim", 1.1)  # Nominatim usage policy: max 1 request/second.
    params = {"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 18, "addressdetails": 1}
    c = _client(client)
    try:
        resp = c.get(NOMINATIM_URL, params=params)
        resp.raise_for_status()
        address = resp.json().get("address", {})
    except httpx.HTTPError:
        address = {}
    finally:
        if client is None:
            c.close()
    _geocode_cache.set(key, address)
    return address or None


def locality(address: dict | None) -> str | None:
    """Short "<road>, <area>" (or whichever is present) from an address dict."""
    if not address:
        return None
    road = address.get("road") or address.get("pedestrian") or address.get("footway")
    area = (
        address.get("neighbourhood") or address.get("suburb")
        or address.get("city_district") or address.get("quarter")
        or address.get("village") or address.get("town") or address.get("city")
    )
    if road and area:
        return f"{road}, {area}"
    return road or area or None


def geocoded_name(fruit_type: str, address: dict | None) -> str | None:
    loc = locality(address)
    return f"{fruit_type} near {loc}"[:120] if loc else None


# --- Species photos from Wikimedia Commons (task #3) --------------------------

@dataclass
class ImageRef:
    thumb_url: str
    mime: str
    license: str | None
    artist: str | None
    source_url: str | None


def _strip_html(value: str | None) -> str | None:
    if not value:
        return None
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip() or None


def _wikidata_qid(species: str, client) -> str | None:
    params = {"action": "wbsearchentities", "search": species, "language": "en",
              "type": "item", "format": "json", "limit": 1}
    resp = client.get(WIKIDATA_API, params=params)
    resp.raise_for_status()
    hits = resp.json().get("search", [])
    return hits[0]["id"] if hits else None


def _wikidata_image_filename(qid: str, client) -> str | None:
    params = {"action": "wbgetclaims", "entity": qid, "property": "P18", "format": "json"}
    resp = client.get(WIKIDATA_API, params=params)
    resp.raise_for_status()
    claims = resp.json().get("claims", {}).get("P18", [])
    if not claims:
        return None
    return claims[0]["mainsnak"]["datavalue"]["value"]


def _commons_imageinfo(filename: str, client, width: int = 800) -> dict | None:
    params = {"action": "query", "titles": f"File:{filename}", "prop": "imageinfo",
              "iiprop": "url|extmetadata|mime", "iiurlwidth": width, "format": "json"}
    resp = client.get(COMMONS_API, params=params)
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})
    for page in pages.values():
        info = (page.get("imageinfo") or [None])[0]
        if info:
            return info
    return None


def parse_imageinfo(info: dict | None) -> ImageRef | None:
    """Pull the scaled URL, licence and author out of a Commons imageinfo blob."""
    if not info or not (info.get("thumburl") or info.get("url")):
        return None
    meta = info.get("extmetadata", {})
    return ImageRef(
        thumb_url=info.get("thumburl") or info["url"],
        mime=info.get("thumbmime") or info.get("mime") or "image/jpeg",
        license=_strip_html((meta.get("LicenseShortName") or {}).get("value")),
        artist=_strip_html((meta.get("Artist") or {}).get("value")),
        source_url=info.get("descriptionurl"),
    )


def species_image(species: str, *, client=None) -> ImageRef | None:
    """Resolve a Latin species to a representative Commons image (cached)."""
    cached = _species_cache.get(species)
    if cached is not None:
        return ImageRef(**cached) if cached else None

    c = _client(client)
    ref = None
    try:
        _rate_limit("wiki", 0.5)
        qid = _wikidata_qid(species, c)
        if qid:
            filename = _wikidata_image_filename(qid, c)
            if filename:
                ref = parse_imageinfo(_commons_imageinfo(filename, c))
    except (httpx.HTTPError, KeyError, IndexError):
        ref = None
    finally:
        if client is None:
            c.close()
    _species_cache.set(species, asdict(ref) if ref else {})
    return ref


def attribution_text(species: str, ref: ImageRef) -> str:
    parts = [f"Representative photo of {species}"]
    if ref.artist:
        parts.append(ref.artist)
    if ref.license:
        parts.append(ref.license)
    parts.append("via Wikimedia Commons")
    return ", ".join(parts)[:500]


def download(url: str, *, client=None) -> bytes:
    c = _client(client, timeout=60.0)
    try:
        resp = c.get(url)
        resp.raise_for_status()
        return resp.content
    finally:
        if client is None:
            c.close()
