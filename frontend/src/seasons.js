export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthName(month, short = false) {
  const name = MONTHS[month - 1]
  return short ? name.slice(0, 3) : name
}

export function formatSeason(tree) {
  if (!tree.season_start || !tree.season_end) return null
  if (tree.season_start === tree.season_end) return monthName(tree.season_start, true)
  return `${monthName(tree.season_start, true)}–${monthName(tree.season_end, true)}`
}
