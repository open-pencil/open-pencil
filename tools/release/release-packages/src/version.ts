import * as v from 'valibot'

/**
 * Official releases are stable `x.y.z` or a beta pre-release `x.y.z-beta.N`. One numbered
 * channel keeps the MSI version, whose only free field is a number, unambiguous.
 */
const RELEASE_VERSION = String.raw`(\d+)\.(\d+)\.(\d+)(?:-beta\.([1-9]\d{0,3}))?`

export const releaseVersionSchema = v.pipe(v.string(), v.regex(new RegExp(`^${RELEASE_VERSION}$`)))
export const releaseTagSchema = v.pipe(v.string(), v.regex(new RegExp(`^v${RELEASE_VERSION}$`)))

/** npm dist-tag for pre-releases; stable releases keep npm's default `latest`. */
export const PRERELEASE_DIST_TAG = 'next'

export function isPrerelease(version: string): boolean {
  return v.parse(releaseVersionSchema, version).includes('-')
}

/**
 * WiX accepts only numeric `major.minor.patch.build` versions, so `x.y.z-beta.N` installs as
 * `x.y.z.N`. Windows Installer ignores that fourth field, but Tauri gives every MSI a new
 * product code and a major upgrade that allows downgrades, so a later beta and the final
 * `x.y.z` still replace an installed beta.
 */
export function msiVersion(version: string): string | undefined {
  const [, major, minor, patch, beta] =
    new RegExp(`^${RELEASE_VERSION}$`).exec(v.parse(releaseVersionSchema, version)) ?? []
  return beta ? `${major}.${minor}.${patch}.${beta}` : undefined
}

/** The tag of the one rolling nightly release, moved to each nightly's commit. */
export const NIGHTLY_TAG = 'nightly'

/**
 * A nightly build of the release master heads for: `X.Y.Z-nightly.YYYYMMDD`, with `.N` for a
 * day's second build on. SemVer orders it after that release's betas and before the release, and
 * nightlies by date.
 */
const NIGHTLY_VERSION = /^(\d+)\.(\d+)\.(\d+)-nightly\.(\d{8})(?:\.([1-9]\d*))?$/

export const nightlyVersionSchema = v.pipe(v.string(), v.regex(NIGHTLY_VERSION))

export function isNightlyVersion(version: string): boolean {
  return NIGHTLY_VERSION.test(version)
}

/**
 * The release master's version heads for: a pre-release's own version, or after a stable release
 * the next minor, since master's version changes only in release commits.
 */
export function upcomingRelease(masterVersion: string): string {
  const [, major, minor, patch, beta] =
    new RegExp(`^${RELEASE_VERSION}$`).exec(v.parse(releaseVersionSchema, masterVersion)) ?? []
  return beta ? `${major}.${minor}.${patch}` : `${major}.${Number(minor) + 1}.0`
}

/** Tonight's nightly version, after `previous`, the version the nightly release has now. */
export function nightlyVersion(masterVersion: string, date: Date, previous?: string): string {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '')
  const base = `${upcomingRelease(masterVersion)}-nightly.${day}`
  if (previous !== base && !previous?.startsWith(`${base}.`)) return base
  const [, , , , , build] = NIGHTLY_VERSION.exec(previous) ?? []
  return `${base}.${Number(build ?? 1) + 1}`
}
