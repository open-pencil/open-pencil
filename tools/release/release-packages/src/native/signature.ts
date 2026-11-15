/**
 * The version a verified trusted comment names: the one `verifyMinisign` returns, never a line read
 * from the signature file, whose other comment is unsigned. The Tauri CLI writes it as
 * tab-separated `key:value` fields, e.g. `timestamp:…\tfile:…\tversion:1.2.3`.
 */
export function signedVersion(trustedComment: string): string | null {
  for (const field of trustedComment.split('\t')) {
    if (field.startsWith('version:')) return field.slice('version:'.length)
  }
  return null
}

/** Updaters with `requireSignedVersion` reject a signature that does not name this version. */
export function assertSignedVersion(trustedComment: string, version: string, asset: string): void {
  const signed = signedVersion(trustedComment)
  if (signed === null) throw new Error(`Signature for ${asset} does not record a version`)
  if (signed !== version) {
    throw new Error(`Signature for ${asset} is for version ${signed}, not ${version}`)
  }
}
