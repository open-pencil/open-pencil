const TRUSTED_COMMENT = 'trusted comment: '

/**
 * The version a decoded minisign signature was made for. The Tauri CLI writes the trusted
 * comment as tab-separated `key:value` fields, e.g. `timestamp:…\tfile:…\tversion:1.2.3`.
 */
export function signedVersion(minisign: string): string | null {
  const comment = minisign
    .split(/\r?\n/)
    .find((line) => line.startsWith(TRUSTED_COMMENT))
    ?.slice(TRUSTED_COMMENT.length)
  if (comment === undefined) return null
  for (const field of comment.split('\t')) {
    if (field.startsWith('version:')) return field.slice('version:'.length)
  }
  return null
}

/** Updaters with `requireSignedVersion` reject a signature that does not name this version. */
export function assertSignedVersion(minisign: string, version: string, asset: string): void {
  const signed = signedVersion(minisign)
  if (signed === null) throw new Error(`Signature for ${asset} does not record a version`)
  if (signed !== version) {
    throw new Error(`Signature for ${asset} is for version ${signed}, not ${version}`)
  }
}
