const LIBRARY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const ASSET_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/

export function isValidLibraryId(value: string): boolean {
  return LIBRARY_ID_PATTERN.test(value)
}

export function isValidLibraryAssetKey(value: string): boolean {
  return ASSET_KEY_PATTERN.test(value)
}

export function assertLibraryId(value: string): void {
  if (!isValidLibraryId(value)) throw new Error(`Invalid library ID: ${value}`)
}

export function assertLibraryAssetKey(value: string): void {
  if (!isValidLibraryAssetKey(value)) throw new Error(`Invalid library asset key: ${value}`)
}

export function libraryAssetIdentityKey(libraryId: string, assetKey: string): string {
  assertLibraryId(libraryId)
  assertLibraryAssetKey(assetKey)
  return `${libraryId}\u0000${assetKey}`
}
