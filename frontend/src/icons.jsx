import { fruitVariant, plantColor } from './fruitIcons'

// All glyphs are white shapes drawn in a 24x24 box, then scaled into the
// coloured marker disc. Shapes are kept bold and simple so they read at ~30px.

function HazardGlyph() {
  return (
    <>
      <path
        d="M12 4.2 L20.8 18.8 H3.2 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="11" y="9.4" width="2" height="4.4" rx="1" />
      <circle cx="12" cy="16.2" r="1.15" />
    </>
  )
}

function CategoryGlyph({ category }) {
  switch (category) {
    case 'tree':
      // Leafy deciduous canopy on a trunk.
      return (
        <>
          <rect x="11" y="12" width="2" height="8" rx="1" />
          <circle cx="12" cy="8" r="5" />
          <circle cx="7.8" cy="10.6" r="3.4" />
          <circle cx="16.2" cy="10.6" r="3.4" />
        </>
      )
    case 'shrub':
      // Low, wide multi-mound bush.
      return (
        <>
          <rect x="11.2" y="15" width="1.6" height="4" rx="0.8" />
          <circle cx="7.6" cy="13.6" r="4" />
          <circle cx="16.4" cy="13.6" r="4" />
          <circle cx="12" cy="11" r="5" />
        </>
      )
    case 'flowerbed':
      // A five-petal flower on a stem with a leaf.
      return (
        <>
          <rect x="11.4" y="11" width="1.2" height="8.5" rx="0.6" />
          <path d="M12.4 16.4 c 1.8 -1.4 3.6 -1 4.6 -0.2 -1 1.4 -3 1.6 -4.6 0.6 Z" />
          <circle cx="12" cy="5.2" r="2.4" />
          <circle cx="8" cy="7.6" r="2.4" />
          <circle cx="16" cy="7.6" r="2.4" />
          <circle cx="9.5" cy="11.4" r="2.4" />
          <circle cx="14.5" cy="11.4" r="2.4" />
        </>
      )
    case 'vine':
      // Two-lobed climbing (ivy) leaf.
      return (
        <>
          <path d="M12 5.5 C 8.8 5.5 6.2 8.1 6.2 11.6 C 6.2 15.3 8.9 18.3 12 18.3 C 12 14 12 9.6 12 5.5 Z" />
          <path d="M12 5.5 C 15.2 5.5 17.8 8.1 17.8 11.6 C 17.8 15.3 15.1 18.3 12 18.3 C 12 14 12 9.6 12 5.5 Z" />
        </>
      )
    case 'other':
    default:
      // A small seedling / sprout with two leaves.
      return (
        <>
          <rect x="11.2" y="11" width="1.6" height="9" rx="0.8" />
          <path d="M12 12 C 12 8 9 6.5 5.5 7 C 5.5 11 9 12.5 12 12 Z" />
          <path d="M12 12 C 12 8 15 6.5 18.5 7 C 18.5 11 15 12.5 12 12 Z" />
        </>
      )
  }
}

function FruitGlyph({ variant }) {
  switch (variant) {
    case 'pear':
      return (
        <>
          <rect x="11.5" y="3.8" width="1.1" height="2.6" rx="0.5" />
          <ellipse cx="14" cy="5" rx="1.7" ry="0.9" transform="rotate(-32 14 5)" />
          <path d="M12 7 C 10.6 7 10.1 8.4 10.3 9.7 C 10.5 11 8.9 11.8 8.3 13.5 C 7.1 16.8 9.4 20 12 20 C 14.6 20 16.9 16.8 15.7 13.5 C 15.1 11.8 13.5 11 13.7 9.7 C 13.9 8.4 13.4 7 12 7 Z" />
        </>
      )
    case 'cherries':
      return (
        <>
          <path
            d="M8.5 16 C 9 11 12 9 15.5 7.5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M15 16 C 14.5 12 13.5 9.5 15.5 7.5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path d="M15.5 7.5 c 1.6 -1.1 3.2 -0.7 4 0.3 -1.1 0.8 -2.7 0.6 -3.6 -0.3 Z" />
          <circle cx="8.5" cy="16.4" r="3.3" />
          <circle cx="15" cy="16.4" r="3.3" />
        </>
      )
    case 'grapes':
      return (
        <>
          <rect x="11.6" y="3.6" width="0.9" height="2.6" rx="0.4" />
          <path d="M12.5 6 c 1.5 -1 3 -0.6 3.7 0.3 -1 0.7 -2.5 0.5 -3.3 -0.4 Z" />
          <circle cx="9.2" cy="9" r="1.9" />
          <circle cx="12" cy="9" r="1.9" />
          <circle cx="14.8" cy="9" r="1.9" />
          <circle cx="10.6" cy="12.2" r="1.9" />
          <circle cx="13.4" cy="12.2" r="1.9" />
          <circle cx="12" cy="15.4" r="1.9" />
        </>
      )
    case 'berry':
      return (
        <>
          <path d="M11.8 8.4 c 0 -1.6 1.1 -2.6 2.6 -2.6 0 1.5 -1.1 2.6 -2.6 2.6 Z" />
          <circle cx="10" cy="10.4" r="1.7" />
          <circle cx="13.6" cy="10.4" r="1.7" />
          <circle cx="8.3" cy="13.3" r="1.7" />
          <circle cx="11.8" cy="13.3" r="1.7" />
          <circle cx="15.3" cy="13.3" r="1.7" />
          <circle cx="10" cy="16.2" r="1.7" />
          <circle cx="13.6" cy="16.2" r="1.7" />
        </>
      )
    case 'nut':
      // Acorn: cap + body.
      return (
        <>
          <rect x="11.5" y="3.4" width="1" height="2" rx="0.5" />
          <path d="M6.8 9 C 6.8 6.4 9.1 4.8 12 4.8 C 14.9 4.8 17.2 6.4 17.2 9 Z" />
          <path d="M7.2 9.5 C 7.2 14 9.4 19 12 19 C 14.6 19 16.8 14 16.8 9.5 Z" />
        </>
      )
    case 'stonefruit':
      // A single round fruit with a leaf (peach / plum / apricot).
      return (
        <>
          <path d="M12 7.2 c 1 -1.8 3 -2.3 4.5 -1.5 -0.8 1.7 -2.7 2.3 -4.1 1.6 Z" />
          <circle cx="11.9" cy="13.4" r="5.7" />
        </>
      )
    case 'fig':
      return (
        <>
          <rect x="11.5" y="4" width="1" height="2.2" rx="0.5" />
          <path d="M9 5.6 c 1.4 0.4 2.4 1.2 3 2.4 0.6 -1.2 1.6 -2 3 -2.4" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12 7 C 8.6 7 6.6 9.9 6.6 13.2 C 6.6 16.9 9 19.6 12 19.6 C 15 19.6 17.4 16.9 17.4 13.2 C 17.4 9.9 15.4 7 12 7 Z" />
        </>
      )
    case 'citrus':
      return (
        <>
          <rect x="11.4" y="4.4" width="1.2" height="2" rx="0.6" />
          <ellipse cx="14" cy="5.4" rx="1.6" ry="0.85" transform="rotate(-30 14 5.4)" />
          <circle cx="12" cy="13" r="6" />
        </>
      )
    case 'apple':
    default:
      // Two-lobed apple body with a stem and leaf.
      return (
        <>
          <rect x="11.5" y="4.4" width="1.1" height="3" rx="0.5" transform="rotate(-14 12 6)" />
          <ellipse cx="14.4" cy="5.6" rx="1.8" ry="1" transform="rotate(-34 14.4 5.6)" />
          <circle cx="9.7" cy="13" r="4.7" />
          <circle cx="14.3" cy="13" r="4.7" />
        </>
      )
  }
}

function Glyph({ category, hazard, fruitType }) {
  if (hazard) return <HazardGlyph />
  if (category === 'fruit_tree') return <FruitGlyph variant={fruitVariant(fruitType)} />
  return <CategoryGlyph category={category} />
}

// A coloured disc with a white plant glyph. Used for map markers and list rows.
export function PlantIcon({ tree, size = 24, className, title }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="11.2" fill={plantColor(tree)} stroke="#fff" strokeWidth="1.6" />
      <g fill="#fff" transform="translate(4.5 4.5) scale(0.625)">
        <Glyph category={tree?.category} hazard={tree?.hazard} fruitType={tree?.fruit_type} />
      </g>
    </svg>
  )
}

// Status badges shown on list rows and in the detail card. Small self-contained
// discs with a white glyph, meant to read at ~16-18px. Pass `title` for a
// native tooltip and screen-reader label.
export function HazardBadge({ size = 18, className, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="11" fill="#dc2626" />
      <path d="M12 5.6 L19.4 18.4 H4.6 Z" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="11" y="9.6" width="2" height="4.3" rx="1" fill="#fff" />
      <circle cx="12" cy="16.2" r="1.15" fill="#fff" />
    </svg>
  )
}

export function SeasonBadge({ size = 18, className, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="11" fill="#2e9e4f" />
      <path d="M16.8 6.6 C 9.9 6.6 6.6 10.3 6.6 16.8 C 13.5 16.8 16.8 13.1 16.8 6.6 Z" fill="#fff" />
      <path d="M8.8 15.4 C 11 12.2 13.6 9.4 15.8 7.8" stroke="#2e9e4f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function GoneBadge({ size = 18, className, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="11" fill="#f97316" />
      <path d="M9 9.4 a3 3 0 1 1 4.4 2.9 c-1 0.6 -1.4 1.1 -1.4 2.1" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.9" cy="16.7" r="1.2" fill="#fff" />
    </svg>
  )
}

// Leaf mark for the app's wordmark and favicon. A solid WHITE leaf with green
// veins so it reads with strong contrast on the green brand tile in every map
// theme (light, dark, and the warm "Stardew" wood skin where a pale leaf
// previously washed out). Kept detailed enough — midrib plus three side veins —
// to still look like a leaf at ~22px.
export function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 4 C 8.8 4 3.8 9.6 3.8 19.4 C 3.8 20 4.3 20.4 4.9 20.1 C 14.4 20.2 20 15.2 20.2 4.6 C 20.3 4.2 20 4 20 4 Z"
        fill="#ffffff"
      />
      <path
        d="M6 18.4 C 10 13.8 14 9.4 18 5.6"
        stroke="#2e7d32"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M8.4 12 Q8.13 14.11 9.6 14.3 Q9.93 15.76 12 15.3" stroke="#2e7d32" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.6 9.1 Q11.23 11.06 12.6 11.1 Q12.73 12.46 14.6 11.9" stroke="#2e7d32" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6 6.7 Q14.13 8.41 15.4 8.2 Q15.28 9.51 16.9 8.9" stroke="#2e7d32" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
