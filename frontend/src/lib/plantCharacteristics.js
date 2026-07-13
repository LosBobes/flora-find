// A small offline "cache" of what we know about each plant TYPE, so the add-plant
// form can pre-fill the tedious fields the moment a user picks a type. It mirrors
// the knowledge in the backend's `app/species_map.py` (which maps a Latin
// species/genus to a FloraFind category/type/season/hazard), but is keyed on the
// English type name the type picker already uses — e.g. "Apple", "Oak", "Pine".
//
// Keep the keys in sync with the type vocabulary (backend `plant_type_seed.py`)
// and with `species_map.py`. An unknown type simply returns null, so the form
// falls back to asking the user — no guessing.
//
// Each entry may carry:
//   category      canonical FloraFind category (also derivable from the type
//                 record, but kept here so a prefill is self-contained)
//   season_start  first month of fruit/bloom season (1-12), or omitted
//   season_end    last month (wraps the new year, e.g. 11 -> 3), or omitted
//   hazard        true for toxic / dangerous plants
//   species       a representative Latin binomial to pre-fill the optional field

const RAW = {
  // --- fruit trees ---
  apple: { category: 'fruit_tree', season_start: 9, season_end: 10, species: 'Malus domestica' },
  pear: { category: 'fruit_tree', season_start: 9, season_end: 10, species: 'Pyrus communis' },
  quince: { category: 'fruit_tree', season_start: 10, season_end: 11, species: 'Cydonia oblonga' },
  plum: { category: 'fruit_tree', season_start: 8, season_end: 9, species: 'Prunus domestica' },
  fig: { category: 'fruit_tree', season_start: 8, season_end: 9, species: 'Ficus carica' },
  mulberry: { category: 'fruit_tree', season_start: 6, season_end: 7, species: 'Morus alba' },
  walnut: { category: 'fruit_tree', season_start: 9, season_end: 10, species: 'Juglans regia' },
  chestnut: { category: 'fruit_tree', season_start: 9, season_end: 10, species: 'Castanea sativa' },
  hazelnut: { category: 'fruit_tree', season_start: 8, season_end: 9, species: 'Corylus avellana' },
  pomegranate: { category: 'fruit_tree', season_start: 9, season_end: 10, species: 'Punica granatum' },
  olive: { category: 'fruit_tree', season_start: 10, season_end: 11, species: 'Olea europaea' },
  orange: { category: 'fruit_tree', season_start: 11, season_end: 2, species: 'Citrus sinensis' },
  lemon: { category: 'fruit_tree', season_start: 11, season_end: 3, species: 'Citrus limon' },
  cherry: { category: 'fruit_tree', season_start: 5, season_end: 6, species: 'Prunus avium' },
  'sour cherry': { category: 'fruit_tree', season_start: 6, season_end: 7, species: 'Prunus cerasus' },
  peach: { category: 'fruit_tree', season_start: 7, season_end: 8, species: 'Prunus persica' },
  apricot: { category: 'fruit_tree', season_start: 6, season_end: 7, species: 'Prunus armeniaca' },
  almond: { category: 'fruit_tree', season_start: 8, season_end: 9, species: 'Prunus dulcis' },

  // --- ornamental / shade trees ---
  'horse chestnut': { category: 'tree', season_start: 5, season_end: 5, species: 'Aesculus hippocastanum' },
  oak: { category: 'tree', species: 'Quercus robur' },
  maple: { category: 'tree', species: 'Acer' },
  birch: { category: 'tree', species: 'Betula' },
  linden: { category: 'tree', season_start: 6, season_end: 6, species: 'Tilia' },
  willow: { category: 'tree', species: 'Salix' },
  plane: { category: 'tree', species: 'Platanus' },
  poplar: { category: 'tree', species: 'Populus' },
  beech: { category: 'tree', species: 'Fagus sylvatica' },
  magnolia: { category: 'tree', season_start: 3, season_end: 4, species: 'Magnolia' },
  'bird cherry': { category: 'tree', species: 'Prunus padus' },

  // --- evergreen trees / conifers ---
  pine: { category: 'evergreen', species: 'Pinus' },
  spruce: { category: 'evergreen', species: 'Picea' },
  fir: { category: 'evergreen', species: 'Abies' },
  cedar: { category: 'evergreen', species: 'Cedrus' },
  cypress: { category: 'evergreen', species: 'Cupressus' },
  yew: { category: 'evergreen', hazard: true, species: 'Taxus baccata' },
  arborvitae: { category: 'evergreen', species: 'Thuja' },

  // --- shrubs ---
  lilac: { category: 'shrub', season_start: 4, season_end: 5, species: 'Syringa vulgaris' },
  rose: { category: 'shrub', season_start: 5, season_end: 9, species: 'Rosa' },
  boxwood: { category: 'shrub', species: 'Buxus sempervirens' },
  hydrangea: { category: 'shrub', season_start: 6, season_end: 8, species: 'Hydrangea' },
  juniper: { category: 'shrub', species: 'Juniperus' },
  forsythia: { category: 'shrub', season_start: 3, season_end: 4, species: 'Forsythia' },
  hawthorn: { category: 'shrub', season_start: 9, season_end: 10, species: 'Crataegus' },
  blackberry: { category: 'shrub', season_start: 7, season_end: 8, species: 'Rubus fruticosus' },
  raspberry: { category: 'shrub', season_start: 6, season_end: 8, species: 'Rubus idaeus' },
  elderberry: { category: 'shrub', season_start: 8, season_end: 9, species: 'Sambucus nigra' },
  blackthorn: { category: 'shrub', season_start: 9, season_end: 11, species: 'Prunus spinosa' },
  'cherry laurel': { category: 'shrub', hazard: true, species: 'Prunus laurocerasus' },
  oleander: { category: 'shrub', season_start: 6, season_end: 9, hazard: true, species: 'Nerium oleander' },

  // --- flowerbeds ---
  lavender: { category: 'flowerbed', season_start: 6, season_end: 8, species: 'Lavandula' },

  // --- vines ---
  grape: { category: 'vine', season_start: 9, season_end: 10, species: 'Vitis vinifera' },
  wisteria: { category: 'vine', season_start: 4, season_end: 5, species: 'Wisteria' },
  ivy: { category: 'vine', species: 'Hedera helix' },
  'virginia creeper': { category: 'vine', species: 'Parthenocissus quinquefolia' },

  // --- hazards / other ---
  'giant hogweed': { category: 'other', season_start: 6, season_end: 7, hazard: true, species: 'Heracleum mantegazzianum' },
  ragweed: { category: 'other', season_start: 8, season_end: 9, hazard: true, species: 'Ambrosia artemisiifolia' },
  'deadly nightshade': { category: 'other', season_start: 8, season_end: 9, hazard: true, species: 'Atropa belladonna' },
  'poison ivy': { category: 'other', hazard: true, species: 'Toxicodendron radicans' },
  'poison hemlock': { category: 'other', hazard: true, species: 'Conium maculatum' },
  'stinging nettle': { category: 'other', hazard: true, species: 'Urtica dioica' },
}

// Look up cached characteristics for an English type name (case/space tolerant).
// Returns null for types we don't recognise so callers can leave the form blank.
export function characteristicsForType(typeName) {
  if (!typeName) return null
  return RAW[typeName.trim().toLowerCase()] ?? null
}

// Whether we have anything cached for a type — handy for a subtle "auto-filled"
// affordance in the UI.
export function hasCharacteristics(typeName) {
  return characteristicsForType(typeName) !== null
}
