import type { PackageDiagnostic, PackageManifest } from '@open-pencil/package-artifacts-tools'

export const FUNDING_URL = 'https://ko-fi.com/dannote'

/** Published packages that must not ask for funding, because the work in them is someone else's. */
export const UNFUNDED_PACKAGES: Readonly<Record<string, string>> = {
  '@open-pencil/canvaskit': 'a build of Skia’s CanvasKit',
  '@open-pencil/html-engine': 'a thin wrapper around Blitz and Stylo',
  '@open-pencil/taffy': 'a build of the Taffy layout engine'
}

export function validateFunding(manifest: PackageManifest): PackageDiagnostic[] {
  const reason = UNFUNDED_PACKAGES[manifest.name]
  const report = (message: string) => [{ field: 'funding', message, packageName: manifest.name }]
  if (reason) {
    return manifest.funding === undefined ? [] : report(`must be omitted: ${reason}`)
  }
  return manifest.funding === FUNDING_URL ? [] : report(`must be ${FUNDING_URL}`)
}
