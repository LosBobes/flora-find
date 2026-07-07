// Plant categories with a colour used for their map marker and list icon. Labels
// are resolved at render time via i18n (see `labelKey`); no emoji anywhere, the
// visual is a coloured SVG glyph (see icons.jsx).
export const HAZARD_COLOR = '#c62828'

export const PLANT_CATEGORIES = [
  { value: 'fruit_tree', labelKey: 'cat_fruit_tree', color: '#d1495b' },
  { value: 'tree', labelKey: 'cat_tree', color: '#2e7d32' },
  { value: 'shrub', labelKey: 'cat_shrub', color: '#6a994e' },
  { value: 'flowerbed', labelKey: 'cat_flowerbed', color: '#9b5de5' },
  { value: 'vine', labelKey: 'cat_vine', color: '#1b9e77' },
  { value: 'other', labelKey: 'cat_other', color: '#6b7a6b' },
]

export function categoryInfo(category) {
  return (
    PLANT_CATEGORIES.find((entry) => entry.value === category) ??
    PLANT_CATEGORIES[PLANT_CATEGORIES.length - 1]
  )
}

// Map a fruit name to one of a handful of icon shapes, so different fruits get
// visibly different markers. Anything unknown falls back to the apple shape.
const FRUIT_VARIANTS = {
  apple: 'apple',
  pear: 'pear',
  quince: 'pear',
  cherry: 'cherries',
  'sour cherry': 'cherries',
  grape: 'grapes',
  mulberry: 'berry',
  blackberry: 'berry',
  elderberry: 'berry',
  raspberry: 'berry',
  strawberry: 'berry',
  'rose hip': 'berry',
  olive: 'berry',
  walnut: 'nut',
  hazelnut: 'nut',
  chestnut: 'nut',
  'horse chestnut': 'nut',
  almond: 'nut',
  peach: 'stonefruit',
  plum: 'stonefruit',
  apricot: 'stonefruit',
  fig: 'fig',
  orange: 'citrus',
  lemon: 'citrus',
  pomegranate: 'citrus',
}

export function fruitVariant(fruitType) {
  return FRUIT_VARIANTS[(fruitType || '').trim().toLowerCase()] ?? 'apple'
}

// A fun, distinct colour per fruit shape so the map reads at a glance.
const FRUIT_COLORS = {
  apple: '#e4572e',
  pear: '#7cb518',
  cherries: '#c1121f',
  grapes: '#8e5ea2',
  berry: '#b5179e',
  nut: '#a1683a',
  stonefruit: '#f4845f',
  fig: '#7b4397',
  citrus: '#f4a259',
}

// Marker/list colour for a plant: hazards always stand out; fruit trees take a
// playful per-fruit colour; everything else uses its category colour.
export function plantColor(tree) {
  if (tree?.hazard) return HAZARD_COLOR
  if (tree?.category === 'fruit_tree') {
    return FRUIT_COLORS[fruitVariant(tree.fruit_type)] ?? categoryInfo('fruit_tree').color
  }
  return categoryInfo(tree?.category).color
}

export const COMMON_FRUITS = [
  'Apple',
  'Pear',
  'Cherry',
  'Sour cherry',
  'Plum',
  'Peach',
  'Apricot',
  'Fig',
  'Grape',
  'Mulberry',
  'Walnut',
  'Chestnut',
  'Hazelnut',
  'Quince',
  'Pomegranate',
  'Orange',
  'Lemon',
  'Olive',
  'Elderberry',
  'Rose hip',
]

export const TYPE_SUGGESTIONS = {
  fruit_tree: COMMON_FRUITS,
  tree: ['Oak', 'Maple', 'Birch', 'Linden', 'Willow', 'Plane', 'Pine', 'Spruce', 'Poplar', 'Beech', 'Magnolia'],
  shrub: ['Lilac', 'Rose', 'Boxwood', 'Hydrangea', 'Juniper', 'Forsythia', 'Hawthorn', 'Blackberry'],
  flowerbed: ['Tulips', 'Roses', 'Lavender', 'Sunflowers', 'Daffodils', 'Peonies', 'Wildflowers'],
  vine: ['Ivy', 'Wisteria', 'Grape', 'Climbing rose', 'Virginia creeper'],
  other: [],
}

export const HAZARD_SUGGESTIONS = [
  'Poison ivy',
  'Poison oak',
  'Giant hogweed',
  'Stinging nettle',
  'Deadly nightshade',
  'Oleander',
  'Poison hemlock',
]
