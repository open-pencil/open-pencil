/**
 * Bounds for export scale multipliers. A huge multiplier would allocate an
 * enormous canvas and crash the renderer, so clamp at every boundary the value
 * can enter from: the UI (edits) and the file format (imported/plugin .fig data).
 */
export const MIN_EXPORT_SCALE = 0.01
export const MAX_EXPORT_SCALE = 1024

export function clampExportScale(scale: number): number {
  return Math.min(MAX_EXPORT_SCALE, Math.max(MIN_EXPORT_SCALE, scale))
}

/** Accept a scale only if it is finite and within bounds (no silent clamping). */
export function isValidExportScale(scale: number): boolean {
  return Number.isFinite(scale) && scale >= MIN_EXPORT_SCALE && scale <= MAX_EXPORT_SCALE
}
