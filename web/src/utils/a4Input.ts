/**
 * M63: парсинг поля reference A4.
 * Принимает "442", "442.5", "442,5" и ведущие/концевые пробелы.
 * Возвращает число или null для мусора. Диапазон (420–460) здесь НЕ проверяется —
 * кламп делает setA4 / normalizeSettings.
 */
export function parseA4Input(raw: string): number | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(',', '.')
  // только цифры и максимум одна десятичная точка
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
