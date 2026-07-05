const TYPE_EMOJI = {
  // Fruits & nuts
  apple: '🍎',
  pear: '🍐',
  cherry: '🍒',
  'sour cherry': '🍒',
  plum: '🟣',
  peach: '🍑',
  apricot: '🍑',
  orange: '🍊',
  mandarin: '🍊',
  lemon: '🍋',
  lime: '🍋',
  fig: '🟤',
  grape: '🍇',
  mulberry: '🫐',
  blueberry: '🫐',
  blackberry: '🫐',
  raspberry: '🍓',
  strawberry: '🍓',
  walnut: '🌰',
  chestnut: '🌰',
  hazelnut: '🌰',
  almond: '🌰',
  olive: '🫒',
  banana: '🍌',
  mango: '🥭',
  avocado: '🥑',
  pomegranate: '🔴',
  quince: '🍈',
  melon: '🍈',
  kiwi: '🥝',
  coconut: '🥥',
  elderberry: '🌸',
  'rose hip': '🌹',
  // General trees
  oak: '🌳',
  maple: '🍁',
  birch: '🌳',
  linden: '🌳',
  willow: '🌳',
  beech: '🌳',
  poplar: '🌳',
  plane: '🌳',
  pine: '🌲',
  spruce: '🌲',
  fir: '🌲',
  cedar: '🌲',
  cypress: '🌲',
  palm: '🌴',
  magnolia: '🌸',
  // Shrubs & flowers
  rose: '🌹',
  roses: '🌹',
  lilac: '💜',
  lavender: '💜',
  hydrangea: '💠',
  tulip: '🌷',
  tulips: '🌷',
  sunflower: '🌻',
  sunflowers: '🌻',
  daffodil: '🌼',
  daffodils: '🌼',
  daisy: '🌼',
  peony: '🌺',
  peonies: '🌺',
  hibiscus: '🌺',
  wildflowers: '🌼',
  // Vines
  ivy: '🌿',
  wisteria: '💜',
}

export const PLANT_CATEGORIES = [
  { value: 'fruit_tree', label: 'Fruit tree', emoji: '🍒' },
  { value: 'tree', label: 'Tree', emoji: '🌳' },
  { value: 'shrub', label: 'Shrub / bush', emoji: '🌿' },
  { value: 'flowerbed', label: 'Flowerbed', emoji: '🌷' },
  { value: 'vine', label: 'Vine / climber', emoji: '🌱' },
  { value: 'other', label: 'Other plant', emoji: '🪴' },
]

export function categoryInfo(category) {
  return (
    PLANT_CATEGORIES.find((entry) => entry.value === category) ??
    PLANT_CATEGORIES[PLANT_CATEGORIES.length - 1]
  )
}

// Marker/list emoji for a plant: hazards always stand out, then the specific
// type if we know it, then the category fallback.
export function plantEmoji(tree) {
  if (tree?.hazard) return '☠️'
  const type = tree?.fruit_type?.trim().toLowerCase()
  if (type && TYPE_EMOJI[type]) return TYPE_EMOJI[type]
  return categoryInfo(tree?.category).emoji
}

// Emoji for a bare type label (filter dropdown), no category context.
export function fruitEmoji(fruitType) {
  if (!fruitType) return '🌳'
  return TYPE_EMOJI[fruitType.trim().toLowerCase()] ?? '🌳'
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
