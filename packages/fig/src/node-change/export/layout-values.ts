/** Figma has no space-evenly distribution; space-between is the nearest it reads. */
export function normalizeStackJustify(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

export function normalizeStackCounterAlign(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

export function normalizeStackCounterAlignItems(value: string | undefined): string | undefined {
  const normalized = normalizeStackCounterAlign(value)
  // Figma models cross-axis stretch on each child, not on counterAxisAlignItems.
  return normalized === 'STRETCH' ? 'MIN' : normalized
}
