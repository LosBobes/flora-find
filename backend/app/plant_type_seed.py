"""Serbian names for the built-in plant types, and a helper to populate the
``plant_types`` table from whatever ``fruit_type`` values already exist.

Kept in sync with the frontend fallback dictionary. New types added by admins at
runtime come with their own translations and don't need an entry here.
"""

from sqlalchemy.orm import Session

from .models import DEFAULT_LANGUAGE, PlantType, Tree

# English (canonical) -> Serbian.
NAMES_SR = {
    "apple": "Jabuka",
    "pear": "Kruška",
    "cherry": "Trešnja",
    "sour cherry": "Višnja",
    "plum": "Šljiva",
    "peach": "Breskva",
    "apricot": "Kajsija",
    "fig": "Smokva",
    "grape": "Grožđe",
    "mulberry": "Dud",
    "walnut": "Orah",
    "chestnut": "Kesten",
    "horse chestnut": "Divlji kesten",
    "hazelnut": "Lešnik",
    "quince": "Dunja",
    "pomegranate": "Nar",
    "orange": "Pomorandža",
    "lemon": "Limun",
    "olive": "Maslina",
    "elderberry": "Zova",
    "rose hip": "Šipurak",
    "blackthorn": "Trnjina",
    "cherry laurel": "Lovorvišnja",
    "bird cherry": "Sremza",
    "blackberry": "Kupina",
    "raspberry": "Malina",
    "strawberry": "Jagoda",
    "almond": "Badem",
    "oak": "Hrast",
    "maple": "Javor",
    "birch": "Breza",
    "linden": "Lipa",
    "willow": "Vrba",
    "plane": "Platan",
    "pine": "Bor",
    "spruce": "Smrča",
    "fir": "Jela",
    "poplar": "Topola",
    "beech": "Bukva",
    "cedar": "Kedar",
    "magnolia": "Magnolija",
    "lilac": "Jorgovan",
    "rose": "Ruža",
    "roses": "Ruže",
    "climbing rose": "Puzajuća ruža",
    "boxwood": "Šimšir",
    "hydrangea": "Hortenzija",
    "juniper": "Kleka",
    "forsythia": "Forzicija",
    "hawthorn": "Glog",
    "lavender": "Lavanda",
    "tulip": "Lala",
    "tulips": "Lale",
    "sunflower": "Suncokret",
    "sunflowers": "Suncokreti",
    "daffodil": "Narcis",
    "daffodils": "Narcisi",
    "peony": "Božur",
    "peonies": "Božuri",
    "wildflowers": "Poljsko cveće",
    "ivy": "Bršljan",
    "wisteria": "Glicinija",
    "virginia creeper": "Divlja loza",
    "poison ivy": "Otrovni bršljan",
    "poison oak": "Otrovni hrast",
    "giant hogweed": "Džinovska šapa",
    "stinging nettle": "Kopriva",
    "deadly nightshade": "Velebilje",
    "oleander": "Oleandar",
    "poison hemlock": "Kukuta",
    "ragweed": "Ambrozija",
}


def names_for(english: str) -> dict:
    """Build the per-language names dict for a canonical English type name."""
    return {"en": english, "sr": NAMES_SR.get(english.strip().lower(), english)}


def backfill_plant_types(db: Session) -> int:
    """Create a PlantType for every fruit_type used by a tree that isn't
    registered yet. Safe to call on every startup; only fills gaps."""
    known = {
        (pt.canonical or "").strip().lower()
        for pt in db.query(PlantType).all()
    }
    rows = db.query(Tree.category, Tree.fruit_type).distinct().all()
    added = 0
    for category, fruit_type in rows:
        if not fruit_type or fruit_type.strip().lower() in known:
            continue
        db.add(PlantType(category=category, names=names_for(fruit_type)))
        known.add(fruit_type.strip().lower())
        added += 1
    if added:
        db.commit()
    return added
