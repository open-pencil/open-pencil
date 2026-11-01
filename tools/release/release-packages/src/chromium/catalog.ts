import type { DesktopAsset } from '../native/catalog.ts'
import { releaseVersion } from '../native/context.ts'

/** OpenPencil Chromium's update feed, published on each release beside the stable `latest.json`. */
export const CHROMIUM_FEED = 'latest-chromium.json'

const CHROMIUM_PREFIX = 'OpenPencil-Chromium_'

/**
 * Whether a release asset belongs to OpenPencil Chromium, which the Chromium workflow adds to a
 * release after its stable build, so the stable tooling leaves it in place.
 */
export function isChromiumAsset(name: string): boolean {
  return name.startsWith(CHROMIUM_PREFIX) || name === CHROMIUM_FEED
}

export const chromiumBuilds = [
  { target: 'aarch64-apple-darwin', arch: 'aarch64', platform: 'darwin-aarch64' },
  { target: 'x86_64-apple-darwin', arch: 'x64', platform: 'darwin-x86_64' }
] as const

export const chromiumTargets = chromiumBuilds.map((build) => build.target)

export type ChromiumTarget = (typeof chromiumTargets)[number]

/**
 * Bundles the Tauri CLI writes for OpenPencil Chromium. They carry the release's version, named
 * apart from the stable bundles and per architecture.
 */
export function chromiumAssets(target: ChromiumTarget, version: string): DesktopAsset[] {
  releaseVersion(`v${version}`)
  const build = chromiumBuilds.find((entry) => entry.target === target)
  if (!build) throw new Error(`Not a Chromium target: ${target}`)

  return [
    {
      source: `OpenPencil Chromium_${version}_${build.arch}.dmg`,
      name: `${CHROMIUM_PREFIX}${version}_${build.arch}.dmg`,
      updaterKeys: [],
      signed: false
    },
    {
      source: 'OpenPencil Chromium.app.tar.gz',
      name: `${CHROMIUM_PREFIX}${build.arch}.app.tar.gz`,
      updaterKeys: [build.platform, `${build.platform}-app`],
      signed: true
    }
  ]
}
