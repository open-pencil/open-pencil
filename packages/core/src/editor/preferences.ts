export interface SnappingPreferences {
  geometry: boolean
  objects: boolean
  pixelGrid: boolean
}

export const DEFAULT_SNAPPING_PREFERENCES: Readonly<SnappingPreferences> = {
  geometry: true,
  objects: true,
  pixelGrid: true
}
