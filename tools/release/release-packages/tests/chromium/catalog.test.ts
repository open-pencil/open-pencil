import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromiumAssets, isChromiumAsset } from '#release/chromium/catalog'
import { resolveReportedAssets } from '#release/native/artifacts'
import { desktopAssets, desktopTargets } from '#release/native/catalog'

const VERSION = '0.17.0-beta.1'

test('carries the release version and names each architecture apart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chromium-artifacts-'))

  try {
    const reported = await Promise.all(
      [
        `OpenPencil Chromium_${VERSION}_x64.dmg`,
        'OpenPencil Chromium.app.tar.gz',
        'OpenPencil Chromium.app.tar.gz.sig'
      ].map(async (name) => {
        await writeFile(join(root, name), 'fixture')
        return join(root, name)
      })
    )
    const assets = await resolveReportedAssets(
      reported,
      chromiumAssets('x86_64-apple-darwin', VERSION),
      root
    )

    expect(assets.map((asset) => asset.name).sort()).toEqual([
      'OpenPencil-Chromium_0.17.0-beta.1_x64.dmg',
      'OpenPencil-Chromium_x64.app.tar.gz',
      'OpenPencil-Chromium_x64.app.tar.gz.sig'
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('feeds each architecture to its updater platform', () => {
  expect(
    chromiumAssets('aarch64-apple-darwin', VERSION).map((asset) => [asset.name, asset.updaterKeys])
  ).toEqual([
    ['OpenPencil-Chromium_0.17.0-beta.1_aarch64.dmg', []],
    ['OpenPencil-Chromium_aarch64.app.tar.gz', ['darwin-aarch64', 'darwin-aarch64-app']]
  ])
  expect(
    chromiumAssets('x86_64-apple-darwin', VERSION).flatMap((asset) => asset.updaterKeys)
  ).toEqual(['darwin-x86_64', 'darwin-x86_64-app'])
})

test('rejects versions that are not releases', () => {
  expect(() => chromiumAssets('aarch64-apple-darwin', '0.17.0-chromium.3')).toThrow()
})

test('tells its files apart from every stable release file', () => {
  const stable = desktopTargets.flatMap((target) => desktopAssets(target, VERSION))
  for (const asset of stable) expect(isChromiumAsset(asset.name)).toBeFalse()
  for (const name of ['latest.json', 'SHA256SUMS', 'release-manifest.json']) {
    expect(isChromiumAsset(name)).toBeFalse()
  }
  expect(isChromiumAsset('latest-chromium.json')).toBeTrue()
})
