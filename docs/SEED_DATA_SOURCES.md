# Seed data sources for FloraFind

How to get a lot more seed data into FloraFind, where it lives, what it costs
(licensing), and how each source maps onto our schema.

## What we need to fill

Every seeded plant is a `Tree` row (see `backend/app/models.py`). The fields a
source has to give us, in priority order:

| Field | Required | Notes |
| --- | --- | --- |
| `lat`, `lng` | yes | Point coordinates. Everything below has these. |
| `category` | yes | One of `PLANT_CATEGORIES`: `fruit_tree`, `tree`, `evergreen`, `shrub`, `flowerbed`, `vine`, `other`. We derive this from species/genus. |
| `fruit_type` | yes | Generic English type label ("Cherry", "Oak", "Mulberry"). Derived from species. |
| `species` | no but wanted | Latin binomial. Most tree inventories and biodiversity sources give this. |
| `name` | yes | Human title. Usually synthesized ("Mulberry near <street>") since raw datasets have no title. |
| `season_start` / `season_end` | no | Month integers, wraps the new year. Not in any source; we fill from a species-to-season lookup table we maintain. |
| `hazard` | no | Derived from a small hardcoded list of dangerous species (giant hogweed, ragweed, deadly nightshade, poison ivy). |
| `description` | no | Optional. Can be synthesized from species + location. |

Key takeaway: **no external source gives us season, hazard, category, or a nice
title directly.** Those we compute from the species/genus with our own lookup
tables. So the job of a source is really: give us **(lat, lng, species)** in
bulk, ideally for our regions of interest.

---

## Source 1: OpenStreetMap via Overpass API (best fit, start here)

OSM tags individual urban trees as `natural=tree`, with optional `species`,
`genus`, and `taxon` tags. It is one of the ten most common tags in OSM (18M+
objects) and mappers add them densely in cities. It also covers our home turf:
Serbia and Belgrade are well mapped.

- **Coverage:** global, self-hosted foraging spots and street trees. Serbia
  included.
- **What you get:** point geometry + `species`/`genus` (Latin) when present,
  plus `leaf_type`, `denotation` (e.g. `natural_monument`, `avenue`). Also
  `natural=shrub`, `landuse=vineyard` (maps to our `vine`), `natural=wood`.
- **License:** ODbL 1.0. Free to use, **share-alike + attribution required**
  ("(C) OpenStreetMap contributors"). This is the one legal string we must carry
  in the app if we ship OSM-derived data.
- **How to pull it:** Overpass API query for a bounding box. Example for Belgrade
  (get everything tagged as an individual tree):

  ```
  [out:json][timeout:120];
  area["name"="Београд"]->.bg;
  (
    node["natural"="tree"](area.bg);
    node["natural"="tree"]["species"](area.bg);
  );
  out body;
  ```

  Endpoint: `https://overpass-api.de/api/interpreter` (POST the query). For a
  whole-country pull use the Geofabrik Serbia extract instead of hammering
  Overpass: <https://download.geofabrik.de/europe/serbia.html> (daily `.osm.pbf`,
  filter with `osmium tags-filter serbia.osm.pbf n/natural=tree`).
- **Why it is first:** free, no key, structured Latin species, and it already
  covers the exact cities we seed (Belgrade, Novi Sad, Niš). A Belgrade Overpass
  pull alone should yield hundreds to thousands of points.

Docs:
- Tag definition: <https://wiki.openstreetmap.org/wiki/Tag:natural%3Dtree>
- Species key: <https://wiki.openstreetmap.org/wiki/Key:species>
- Species value list: <https://wiki.openstreetmap.org/wiki/Tag:natural=tree/List_of_Species>

---

## Source 2: Falling Fruit (best thematic fit for foraging)

Falling Fruit is the closest project to FloraFind in spirit: a global,
open-source map of **edible** urban plants. It aggregates 1.6M+ locations and
2,300+ edible types, itself compiled largely from municipal tree inventories
mined for food-producing species. It is built on PostgreSQL + PostGIS.

- **Coverage:** global, concentrated in North America and Western Europe. Serbia
  coverage is thin, so this is more useful when we expand beyond Belgrade.
- **What you get:** location, type (their own taxonomy, mappable to our
  `fruit_type`), sometimes description and season notes.
- **License:** **CC BY-NC-SA** unless otherwise noted. Non-commercial +
  attribution + share-alike. If FloraFind is ever monetized this source becomes a
  problem; contact falling.fruit@gmail.com for commercial terms. For a
  non-commercial community map we are fine with attribution.
- **How to pull it:** full dump is `locations.csv.bz2` (~40MB) + `types.csv.bz2`
  from <https://fallingfruit.org/data>. For a region, use the download tool built
  into the map. There is also a REST API (see their GitHub org).

Docs / data:
- Data page: <https://fallingfruit.org/data>
- Datasets browser: <https://fallingfruit.org/datasets?locale=en>
- GitHub (API + importers): <https://github.com/falling-fruit>

---

## Source 3: Municipal street-tree inventories (highest quality, city by city)

Cities publish authoritative tree censuses with exact coordinates, Latin species,
common name, diameter, health, and often planting date. Quality and field naming
are excellent; the catch is every city is a separate dataset with its own schema,
and most are North American. Great for seeding demo cities with realistic density.

Examples with direct downloads (CSV / GeoJSON / Shapefile):

- **New York City** 2015 Street Tree Census, ~666k trees, species + health:
  <https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh>
- **San Francisco** Street Tree List (species, planting date, location):
  <https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq>
- **Philadelphia** ~112k street trees (CSV / Shapefile / GeoJSON / API):
  <https://opendataphilly.org/datasets/philadelphia-tree-inventory/>
- **San Jose** Street Tree (CSV / GeoJSON / KML / Shapefile):
  <https://data.sanjoseca.gov/dataset/street-tree>
- **Washington DC** Urban Forestry Street Trees:
  <https://opendata.dc.gov/datasets/urban-forestry-street-trees>
- **49 California cities** raw inventory, ~930k trees (research bundle):
  <https://data.nal.usda.gov/dataset/raw-urban-street-tree-inventory-data-49-california-cities>
- **Guelph, CA** GeoJSON tree inventory:
  <http://data.open.guelph.ca/dataset/tree-inventory/resource/aed678ee-1cc0-43df-a1df-edbae2872ae1>

- **License:** varies per city, but municipal open-data portals are almost always
  public-domain-ish (often explicitly public domain, CC0, or a permissive city
  license). Check each dataset's page; record the license per city when we import.
- **Overview / methodology:** "Mapping the diversity of street tree inventories
  across eight cities" is a good survey of how these datasets differ:
  <https://www.sciencedirect.com/science/article/pii/S1618866721001242>

---

## Source 4: GBIF / iNaturalist (biodiversity, great for shrubs, vines, hazards)

GBIF aggregates georeferenced species occurrences from iNaturalist, eBird, museum
collections, and citizen science. iNaturalist "research-grade" observations flow
into GBIF weekly. This is the best source for the categories tree inventories
miss: wild shrubs (blackberry, elderberry), vines, and specifically **hazard
plants** (giant hogweed, ragweed, deadly nightshade) which people photograph and
report on iNaturalist.

- **Coverage:** global, including Serbia. Density is where people observe, so
  good near cities and trails.
- **What you get:** Latin species (authoritative, this is the whole point of
  GBIF), lat/lng, date, sometimes coordinate uncertainty. Filter to plants
  (kingdom Plantae) and to a bounding box.
- **License:** per-record, one of **CC0, CC BY, or CC BY-NC**. Filter the download
  to CC0 + CC BY if we want to avoid the non-commercial constraint. Each GBIF
  download also gets a **DOI you must cite**.
- **Caveats:** observation points are where a person stood, not a permanent
  planting, and some are obscured/randomized for sensitive taxa. Good for "this
  species grows around here" seed density, less so for "this exact tree."
- **How to pull it:** GBIF occurrence download API (async, returns a DOI'd
  archive) or the live search API for small pulls. Filter `hasCoordinate=true`,
  `taxonKey=<plant>`, `country=RS`, `license=CC0_1_0` or `CC_BY_4_0`.

Docs:
- Portal: <https://www.gbif.org/>
- API reference: <https://techdocs.gbif.org/en/openapi/>
- Download formats: <https://techdocs.gbif.org/en/data-use/download-formats>
- iNaturalist research-grade dataset on GBIF:
  <https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7>
- License handling explainer: <https://data-blog.gbif.org/post/gbif-occurrence-license-processing/>

---

## Source 5: Serbia / Belgrade national geodata (for our home region)

Our seed set is Belgrade-first, so it is worth checking national portals for an
official green-space or tree layer before falling back to OSM.

- **Geosrbija (NSDI open data):** national spatial data infrastructure, exports as
  CSV / XLS / JSON / SQLite / GeoPackage / GML. Address and spatial-unit registers
  are here; useful for reverse-geocoding synthesized names even if it has no tree
  layer. <https://geosrbija.rs/en/services-eng/open-data-of-nsdi-eng/>
- **data.gov.rs:** national open data portal, worth searching for "зеленило" /
  "drveće" / green cadastre datasets.
- **GIS Beoland (Belgrade land directorate):** Belgrade cadastral/urban-zone GIS.
  No confirmed public tree layer, but the likeliest home for a Belgrade green
  cadastre if one is published. <https://www.beoland.com/en/plans/gis-beoland/>
- **Geofabrik Serbia OSM extract:** the practical way to bulk-load Serbian trees
  (see Source 1). <https://download.geofabrik.de/europe/serbia.html>

As of this research, no confirmed public individual-tree inventory for Belgrade
was found on national portals, so **OSM/Overpass is the realistic bulk source for
Serbia** today.

---

## Recommended plan

1. **Belgrade + Serbia bulk:** pull `natural=tree` (plus `natural=shrub`,
   `landuse=vineyard`) from Overpass / the Geofabrik Serbia extract. This directly
   grows our existing Belgrade-centric seed set with real coordinates and species.
2. **Edible layer:** pull the Falling Fruit region export for any city we feature,
   to bias toward foraging-relevant species.
3. **Hazards + wild shrubs/vines:** GBIF query (country=RS, kingdom Plantae, CC0 /
   CC BY) for our hazard species and for blackberry/elderberry/etc.
4. **Demo cities abroad:** import one or two municipal inventories (NYC, SF) if we
   want a dense non-Serbian showcase.

### The enrichment layer we own (implemented)

Because no source supplies them, these lookups live in `backend/app/species_map.py`.
`classify(species, genus)` turns a raw Latin name into a `PlantInfo`
(category, fruit_type, season_start, season_end, hazard), or `None` when the plant
isn't in our vocabulary so the caller skips it. It is genus-keyed, with
full-binomial overrides for ambiguous genera (mostly `Prunus`) and hazards
(`Heracleum mantegazzianum` only). Extend the `GENUS` / `SPECIES` tables there,
keeping the English `fruit_type` values in sync with `plant_type_seed.py` and
`frontend/src/fruitIcons.js`. Tests: `backend/tests/test_species_map.py`.

Nicer names and photos are a separate post-import step, see "The enrichment
step" below.

### The OSM importer (implemented)

`backend/import_osm.py` is the Source 1 loader. It pulls `natural=tree` /
`natural=shrub` nodes for a bounding box from Overpass, runs each through
`classify()`, dedupes on ~11 m rounded coordinates (against both the DB and the
batch), and inserts `Tree` rows owned by the seed contributor.

```bash
python import_osm.py                       # central Belgrade default bbox
python import_osm.py --bbox 44.79,20.40,44.84,20.52
python import_osm.py --file overpass.json  # import a saved Overpass response (offline)
python import_osm.py --dry-run             # report counts, write nothing
python import_osm.py --include-unknown     # keep untagged nodes as generic trees
```

Note on yield: most OSM tree nodes in Belgrade carry **no** `species`/`genus`
tag, so a plain run matches only the tagged minority (roughly 3% in a 619-node
central sample: 18 maple, 2 birch, 1 horse chestnut, and not one fruit tree).
Two things soften that:

- **Ancillary-tag enrichment (task #1, done).** `describe()` in `import_osm.py`
  mines the tags ~27% of nodes *do* carry (`leaf_type`, `leaf_cycle`,
  `denotation`, `height`, `start_date`, `operator`) into a sentence such as
  "Broadleaved deciduous tree, part of a tree-lined avenue, ~14 m tall, planted
  2016." `denotation=natural_monument` becomes "a protected natural monument."
- **`--include-unknown`** then seeds the untagged nodes as richly-described
  generic `tree` entries when you want density over precision.

### The GBIF / iNaturalist importer (task #2, done)

`backend/import_gbif.py` is the Source 4 loader and the fix for OSM's fruit-tree
blind spot. It queries the GBIF occurrence search API for plant occurrences
(kingdom Plantae) in a bbox, filters by licence and coordinate quality, runs each
through `classify()`, and inserts the recognised ones.

```bash
python import_gbif.py                       # central Belgrade default bbox
python import_gbif.py --bbox 44.77,20.38,44.86,20.53 --max-pages 5
python import_gbif.py --file gbif.json      # import a saved GBIF response (offline)
python import_gbif.py --allow-nc --dry-run  # also include CC BY-NC (non-commercial)
```

Verified yield: from 678 real Belgrade occurrences it matched 91 plants, and
crucially the edibles OSM misses (Fig, Walnut, Pomegranate, Hazelnut, Sour
cherry, Olive, Elderberry, Quince). It defaults to **CC0 + CC BY** only
(`--allow-nc` adds CC BY-NC), drops records fuzzier than `--max-uncertainty`
metres, and each description carries provenance plus the caveat that an
occurrence "marks where the plant was seen, not a fixed planting."

Data-quality gotcha found while testing: GBIF gives full binomials, so the
bare-`Prunus` fallback mislabelled toxic **cherry laurel** (`Prunus
laurocerasus`) as an edible "Plum". `species_map.py` now has explicit overrides
for it, blackthorn and bird cherry. **When you add new edible fruit species,
double-check no toxic look-alike shares the genus fallback.**

### Shared plumbing

Both importers reuse `backend/app/plant_import.py` (`load_existing_keys`,
`add_plant`) for coordinate-rounded dedupe (~11 m, against both the DB and the
current batch) and insertion. A municipal-inventory importer would reuse the same
shape: fetch, drop no-coordinate rows, `classify()`, skip unknowns, `add_plant`.
Tests for all of it: `backend/tests/test_importers.py`.

## The enrichment step (tasks #3 + #4, done)

Importers give a plant its location, type and season. A separate pass,
`backend/enrich.py`, makes the imported points feel human. It runs *after* the
importers, over plants already in the DB (by default only those owned by the seed
contributor, so real user contributions are never rewritten). The network helpers
live in `backend/app/enrichment.py`; both are politely rate-limited and cached on
disk under `FLORA_CACHE_DIR` (default `./.florafind_cache`, git-ignored) so
re-runs are cheap.

```bash
python enrich.py                 # both passes over seeded plants
python enrich.py --names --limit 50
python enrich.py --photos --dry-run
python enrich.py --all-owners    # also enrich user-contributed plants
```

**#4 Reverse-geocoded names (Nominatim).** `reverse_geocode()` turns `(lat, lng)`
into an address and renames the plant "<Type> near <street>, <area>", e.g.
`Fig near Вука Бојовића, Београд (Стари град)`. Rate-limited to Nominatim's
1 request/second policy with a descriptive `User-Agent`; results cached by rounded
coordinate. Verified live against Belgrade points.

**#3 Species photos (Wikidata + Wikimedia Commons).** For a plant with a species
but no photo, `species_image()` resolves the Latin name to a representative image:
Wikidata entity search -> `P18` image claim -> Commons `imageinfo` (scaled to
800 px, with `extmetadata` for licence + author). The thumbnail is downloaded into
the uploads dir as a normal `TreePhoto`. Verified live: Fig, Walnut, Horse
chestnut etc. all resolved to real CC images.

Because these images are CC BY / BY-SA (attribution required) and are a
*representative* species photo rather than the exact tree, we store the credit:
`TreePhoto` gained nullable **`attribution`** and **`source_url`** columns (model
+ additive migration in `migrations.py` + `PhotoOut` schema), rendered as a small
credit line under the photos in `TreeDetails.jsx`. Example stored attribution:
"Representative photo of Ficus carica, Silverije, CC BY-SA 4.0, via Wikimedia
Commons". User-uploaded photos leave both columns null.

Tests (offline, network monkeypatched): `backend/tests/test_enrichment.py`.

### Suggested full pipeline

```bash
python seed.py                               # accounts + hand-curated Belgrade set
python import_osm.py --include-unknown        # OSM density + ancillary-tag descriptions
python import_gbif.py --max-pages 5           # foraging species OSM misses
python enrich.py                              # geocoded names + Commons photos
```

## Licensing summary (read before shipping)

| Source | License | Commercial OK? | Attribution required |
| --- | --- | --- | --- |
| OpenStreetMap / Overpass | ODbL 1.0 | yes | yes, share-alike |
| Falling Fruit | CC BY-NC-SA | no (contact them) | yes, share-alike |
| Municipal inventories | varies (often public domain / CC0) | usually yes | per city |
| GBIF / iNaturalist | per record: CC0 / CC BY / CC BY-NC | filter to CC0 + CC BY | yes + cite the DOI |
| Geosrbija / data.gov.rs | open (no restrictions stated) | yes | check dataset |
| Nominatim (geocoded names) | ODbL (data) | yes, within usage policy | "(C) OpenStreetMap contributors" |
| Wikimedia Commons (photos) | per image: mostly CC BY / CC BY-SA / PD / CC0 | yes | **yes** — stored per photo in `TreePhoto.attribution` |

If FloraFind stays a free community map, all of the above are usable with
attribution. If it is ever commercialized, drop Falling Fruit and any CC BY-NC
GBIF records, keep OSM's share-alike obligation in mind, and make sure the
per-photo Commons credit stays visible. Nominatim also forbids heavy bulk use, so
the enrichment step rate-limits to 1 request/second and caches results.

## Sources consulted

- Falling Fruit data & datasets: <https://fallingfruit.org/data>, <https://fallingfruit.org/datasets?locale=en>, <https://github.com/falling-fruit>
- OSM tree tagging: <https://wiki.openstreetmap.org/wiki/Tag:natural%3Dtree>, <https://wiki.openstreetmap.org/wiki/Key:species>
- Geofabrik Serbia extract: <https://download.geofabrik.de/europe/serbia.html>
- Municipal inventories: NYC <https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh>, SF <https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq>, Philadelphia <https://opendataphilly.org/datasets/philadelphia-tree-inventory/>, San Jose <https://data.sanjoseca.gov/dataset/street-tree>, DC <https://opendata.dc.gov/datasets/urban-forestry-street-trees>
- Street-tree inventory survey: <https://www.sciencedirect.com/science/article/pii/S1618866721001242>
- GBIF: <https://www.gbif.org/>, <https://techdocs.gbif.org/en/openapi/>, <https://data-blog.gbif.org/post/gbif-occurrence-license-processing/>
- Serbia geodata: <https://geosrbija.rs/en/services-eng/open-data-of-nsdi-eng/>, <https://www.beoland.com/en/plans/gis-beoland/>
</content>
</invoke>
