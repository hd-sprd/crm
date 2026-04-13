/**
 * Compute the start date (ISO yyyy-mm-dd) for a quick-filter preset.
 * @param {'30d'|'3m'|'1y'} preset
 */
export function getQuickFilterDate(preset) {
  const d = new Date()
  if (preset === '30d') d.setDate(d.getDate() - 30)
  else if (preset === '3m') d.setMonth(d.getMonth() - 3)
  else if (preset === '1y') d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}
