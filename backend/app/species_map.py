"""Turn a raw Latin species/genus into FloraFind fields.

External data sources (OpenStreetMap, GBIF, municipal inventories) give us little
more than ``(lat, lng, species)``. None of them supply our ``category``,
``fruit_type``, ``season_start/end`` or ``hazard``. This module is the enrichment
layer that owns those mappings, keyed on the Latin genus (and, where the genus is
ambiguous, the full binomial). See ``docs/SEED_DATA_SOURCES.md``.

Keep the English ``fruit_type`` values in sync with the vocabulary in
``plant_type_seed.py`` and ``frontend/src/fruitIcons.js`` so imported plants land
on a known type with a marker and a Serbian name.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlantInfo:
    category: str
    fruit_type: str
    season_start: int | None = None
    season_end: int | None = None
    hazard: bool = False


# Full-binomial overrides. Checked before the genus table, for genera whose
# species map to different FloraFind types (mostly Prunus) or hazards.
SPECIES: dict[str, PlantInfo] = {
    "prunus avium": PlantInfo("fruit_tree", "Cherry", 5, 6),
    "prunus cerasus": PlantInfo("fruit_tree", "Sour cherry", 6, 7),
    "prunus domestica": PlantInfo("fruit_tree", "Plum", 8, 9),
    "prunus cerasifera": PlantInfo("fruit_tree", "Plum", 7, 8),
    "prunus insititia": PlantInfo("fruit_tree", "Plum", 8, 9),
    "prunus spinosa": PlantInfo("shrub", "Blackthorn", 9, 11),
    # Cherry laurel is a toxic ornamental hedge, NOT an edible plum. Without this
    # override the bare-"Prunus" fallback would mislabel it as fruit.
    "prunus laurocerasus": PlantInfo("shrub", "Cherry laurel"),
    "prunus padus": PlantInfo("tree", "Bird cherry"),
    "prunus persica": PlantInfo("fruit_tree", "Peach", 7, 8),
    "prunus armeniaca": PlantInfo("fruit_tree", "Apricot", 6, 7),
    "prunus dulcis": PlantInfo("fruit_tree", "Almond", 8, 9),
    "prunus amygdalus": PlantInfo("fruit_tree", "Almond", 8, 9),
    "rubus idaeus": PlantInfo("shrub", "Raspberry", 6, 8),
    "rubus fruticosus": PlantInfo("shrub", "Blackberry", 7, 8),
    "citrus limon": PlantInfo("fruit_tree", "Lemon", 11, 3),
    "citrus sinensis": PlantInfo("fruit_tree", "Orange", 11, 2),
    # Heracleum mantegazzianum is the dangerous invasive; common hogweed
    # (H. sphondylium) is not flagged, so only the binomial is a hazard here.
    "heracleum mantegazzianum": PlantInfo("other", "Giant hogweed", 6, 7, hazard=True),
}

# Genus-level defaults. First token of the Latin name.
GENUS: dict[str, PlantInfo] = {
    # --- fruit trees ---
    "malus": PlantInfo("fruit_tree", "Apple", 9, 10),
    "pyrus": PlantInfo("fruit_tree", "Pear", 9, 10),
    "cydonia": PlantInfo("fruit_tree", "Quince", 10, 11),
    "prunus": PlantInfo("fruit_tree", "Plum", 8, 9),  # fallback for bare "Prunus"
    "ficus": PlantInfo("fruit_tree", "Fig", 8, 9),
    "morus": PlantInfo("fruit_tree", "Mulberry", 6, 7),
    "juglans": PlantInfo("fruit_tree", "Walnut", 9, 10),
    "castanea": PlantInfo("fruit_tree", "Chestnut", 9, 10),
    "corylus": PlantInfo("fruit_tree", "Hazelnut", 8, 9),
    "punica": PlantInfo("fruit_tree", "Pomegranate", 9, 10),
    "olea": PlantInfo("fruit_tree", "Olive", 10, 11),
    "citrus": PlantInfo("fruit_tree", "Orange", 11, 2),
    # --- ornamental / shade trees ---
    "aesculus": PlantInfo("tree", "Horse chestnut", 5, 5),
    "quercus": PlantInfo("tree", "Oak"),
    "acer": PlantInfo("tree", "Maple"),
    "betula": PlantInfo("tree", "Birch"),
    "tilia": PlantInfo("tree", "Linden", 6, 6),
    "salix": PlantInfo("tree", "Willow"),
    "platanus": PlantInfo("tree", "Plane"),
    "populus": PlantInfo("tree", "Poplar"),
    "fagus": PlantInfo("tree", "Beech"),
    "magnolia": PlantInfo("tree", "Magnolia", 3, 4),
    # --- evergreen trees / conifers ---
    "pinus": PlantInfo("evergreen", "Pine"),
    "picea": PlantInfo("evergreen", "Spruce"),
    "abies": PlantInfo("evergreen", "Fir"),
    "cedrus": PlantInfo("evergreen", "Cedar"),
    "cupressus": PlantInfo("evergreen", "Cypress"),
    "taxus": PlantInfo("evergreen", "Yew"),
    "thuja": PlantInfo("evergreen", "Arborvitae"),
    # --- shrubs ---
    "syringa": PlantInfo("shrub", "Lilac", 4, 5),
    "rosa": PlantInfo("shrub", "Rose", 5, 9),
    "buxus": PlantInfo("shrub", "Boxwood"),
    "hydrangea": PlantInfo("shrub", "Hydrangea", 6, 8),
    "juniperus": PlantInfo("shrub", "Juniper"),
    "forsythia": PlantInfo("shrub", "Forsythia", 3, 4),
    "crataegus": PlantInfo("shrub", "Hawthorn", 9, 10),
    "rubus": PlantInfo("shrub", "Blackberry", 7, 8),
    "sambucus": PlantInfo("shrub", "Elderberry", 8, 9),
    "lavandula": PlantInfo("flowerbed", "Lavender", 6, 8),
    # --- vines ---
    "vitis": PlantInfo("vine", "Grape", 9, 10),
    "wisteria": PlantInfo("vine", "Wisteria", 4, 5),
    "hedera": PlantInfo("vine", "Ivy"),
    "parthenocissus": PlantInfo("vine", "Virginia creeper"),
    # --- hazards ---
    "ambrosia": PlantInfo("other", "Ragweed", 8, 9, hazard=True),
    "atropa": PlantInfo("other", "Deadly nightshade", 8, 9, hazard=True),
    "toxicodendron": PlantInfo("other", "Poison ivy", hazard=True),
    "conium": PlantInfo("other", "Poison hemlock", hazard=True),
    "nerium": PlantInfo("shrub", "Oleander", 6, 9, hazard=True),
    "urtica": PlantInfo("other", "Stinging nettle", hazard=True),
}


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def classify(species: str | None = None, genus: str | None = None) -> PlantInfo | None:
    """Map a Latin ``species`` and/or ``genus`` to FloraFind fields.

    Returns ``None`` when the plant isn't in our vocabulary, so callers can skip
    it rather than inventing a category. ``species`` may be a bare genus, a full
    binomial, or carry a cultivar suffix; only the first two tokens matter.
    """
    binomial = _norm(species)
    tokens = binomial.split()
    if tokens:
        first_two = " ".join(tokens[:2])
        if first_two in SPECIES:
            return SPECIES[first_two]
    genus_key = _norm(genus) or (tokens[0] if tokens else "")
    return GENUS.get(genus_key)
