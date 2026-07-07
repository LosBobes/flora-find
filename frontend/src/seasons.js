// Season helpers. Month names are passed in from i18n so they follow the
// selected language (see useI18n().months / .monthsShort).

export function formatSeason(tree, monthsShort) {
  if (!tree.season_start || !tree.season_end) return null
  const start = monthsShort[tree.season_start - 1]
  if (tree.season_start === tree.season_end) return start
  return `${start}–${monthsShort[tree.season_end - 1]}`
}

// Set of month numbers (1-12) a plant is in season, handling the new-year
// wrap (e.g. Nov->Feb). Returns null when no season is recorded.
export function seasonMonths(tree) {
  if (!tree.season_start || !tree.season_end) return null
  const months = new Set()
  let month = tree.season_start
  for (let i = 0; i < 12; i++) {
    months.add(month)
    if (month === tree.season_end) break
    month = month === 12 ? 1 : month + 1
  }
  return months
}
