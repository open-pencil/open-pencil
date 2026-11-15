import { maxBy, partition } from 'es-toolkit/array'

export const PLATFORMS = ['mac', 'windows', 'linux'] as const
export type Platform = (typeof PLATFORMS)[number]
export type Arch = 'arm64' | 'x64'
/** Installer formats, in the order a platform's list shows them. */
export const FILE_FORMATS = ['dmg', 'exe', 'msi', 'appimage', 'deb', 'rpm'] as const
export type FileFormat = (typeof FILE_FORMATS)[number]

/** A file someone downloads to install the app; updater payloads and signatures are left out. */
export interface ReleaseFile {
  platform: Platform
  arch: Arch
  format: FileFormat
  name: string
  url: string
  /** Bytes. */
  size: number
}

export interface Release {
  version: string
  /** ISO date the release was published. */
  date: string
  url: string
  files: ReleaseFile[]
  /** `SHA256SUMS`, when the release has it. */
  checksums: string | null
  /** The release notes, the changelog section of the version, as HTML; empty when not shown. */
  notes: string
}

export interface Releases {
  stable: Release | null
  /** The newest pre-release, when it is newer than the stable release. */
  beta: Release | null
}

/**
 * How the release workflow names each installer (`tools/release/release-packages`): the format
 * by its extension, and the architecture by the target in the name.
 */
const FILE_PATTERNS: { pattern: RegExp; platform: Platform; arch: Arch; format: FileFormat }[] = [
  { pattern: /_aarch64\.dmg$/, platform: 'mac', arch: 'arm64', format: 'dmg' },
  { pattern: /_x64\.dmg$/, platform: 'mac', arch: 'x64', format: 'dmg' },
  { pattern: /_x64-setup\.exe$/, platform: 'windows', arch: 'x64', format: 'exe' },
  { pattern: /_arm64-setup\.exe$/, platform: 'windows', arch: 'arm64', format: 'exe' },
  { pattern: /_x64_[\w-]+\.msi$/, platform: 'windows', arch: 'x64', format: 'msi' },
  { pattern: /_arm64_[\w-]+\.msi$/, platform: 'windows', arch: 'arm64', format: 'msi' },
  { pattern: /_amd64\.AppImage$/, platform: 'linux', arch: 'x64', format: 'appimage' },
  { pattern: /_aarch64\.AppImage$/, platform: 'linux', arch: 'arm64', format: 'appimage' },
  { pattern: /_amd64\.deb$/, platform: 'linux', arch: 'x64', format: 'deb' },
  { pattern: /_arm64\.deb$/, platform: 'linux', arch: 'arm64', format: 'deb' },
  { pattern: /\.x86_64\.rpm$/, platform: 'linux', arch: 'x64', format: 'rpm' },
  { pattern: /\.aarch64\.rpm$/, platform: 'linux', arch: 'arm64', format: 'rpm' }
]

/** The installer a release asset is, or null for signatures, updater payloads, and manifests. */
export function classifyAsset(asset: {
  name: string
  url: string
  size: number
}): ReleaseFile | null {
  // OpenPencil Chromium (`OpenPencil-Chromium_…`) shares the release but is not offered here.
  if (asset.name.startsWith('OpenPencil-Chromium_')) return null
  const match = FILE_PATTERNS.find(({ pattern }) => pattern.test(asset.name))
  if (!match) return null
  const { platform, arch, format } = match
  return { platform, arch, format, ...asset }
}

/** Files of one platform, Apple Silicon and ARM first on the Mac, x64 first elsewhere. */
export function filesFor(release: Release, platform: Platform): ReleaseFile[] {
  const archFirst: Arch = platform === 'mac' ? 'arm64' : 'x64'
  return release.files
    .filter((file) => file.platform === platform)
    .toSorted(
      (a, b) =>
        Number(b.arch === archFirst) - Number(a.arch === archFirst) ||
        FILE_FORMATS.indexOf(a.format) - FILE_FORMATS.indexOf(b.format)
    )
}

/**
 * The newest stable release, and the newest pre-release when it came out after it. Releases are
 * drafted before they are published, so they are compared by when they were published.
 */
export function latestReleases<T extends { prerelease: boolean; published_at: string }>(
  published: readonly T[]
): { stable: T | null; beta: T | null } {
  const [betas, stables] = partition(published, (release) => release.prerelease)
  const stable = maxBy(stables, (release) => Date.parse(release.published_at)) ?? null
  const beta = maxBy(betas, (release) => Date.parse(release.published_at)) ?? null
  const newer = beta && (!stable || Date.parse(beta.published_at) > Date.parse(stable.published_at))
  return { stable, beta: newer ? beta : null }
}
