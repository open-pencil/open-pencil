import { expect, test } from 'bun:test'

import { classifyAsset, filesFor } from '#docs-config/theme/landing/download/releases'
import { chromiumAssets, chromiumTargets } from '#release/chromium/catalog'
import { desktopAssets, desktopTargets } from '#release/native/catalog'

const VERSION = '0.15.0'

function asset(name: string) {
  return { name, url: `https://example.com/${name}`, size: 1 }
}

const published = desktopTargets.flatMap((target) => desktopAssets(target, VERSION))

test('the download page lists every installer a release publishes', () => {
  const installers = published.filter((file) => !file.name.endsWith('.app.tar.gz'))
  const files = installers.map((file) => classifyAsset(asset(file.name)))
  expect(files.map((file) => file && `${file.platform}/${file.arch}/${file.format}`)).toEqual([
    'mac/arm64/dmg',
    'mac/x64/dmg',
    'windows/x64/exe',
    'windows/x64/msi',
    'windows/arm64/exe',
    'windows/arm64/msi',
    'linux/x64/appimage',
    'linux/x64/deb',
    'linux/x64/rpm'
  ])
})

test('the download page leaves out updater payloads and signatures', () => {
  const updaters = published.filter((file) => file.name.endsWith('.app.tar.gz'))
  expect(updaters).not.toBeEmpty()
  for (const file of updaters) {
    expect(classifyAsset(asset(file.name))).toBeNull()
    expect(classifyAsset(asset(`${file.name}.sig`))).toBeNull()
  }
  expect(classifyAsset(asset('SHA256SUMS'))).toBeNull()
  expect(classifyAsset(asset('latest.json'))).toBeNull()
})

test('the download page leaves out OpenPencil Chromium', () => {
  const chromium = chromiumTargets.flatMap((target) => chromiumAssets(target, VERSION))
  for (const file of chromium) expect(classifyAsset(asset(file.name))).toBeNull()
  expect(classifyAsset(asset('latest-chromium.json'))).toBeNull()
})

test('a platform lists Apple Silicon or x64 first, then installers in format order', () => {
  const files = published.flatMap((file) => classifyAsset(asset(file.name)) ?? [])
  const release = { version: VERSION, date: '', url: '', files, checksums: null, notes: '' }
  expect(filesFor(release, 'mac').map((file) => file.arch)).toEqual(['arm64', 'x64'])
  expect(filesFor(release, 'windows').map((file) => `${file.arch} ${file.format}`)).toEqual([
    'x64 exe',
    'x64 msi',
    'arm64 exe',
    'arm64 msi'
  ])
  expect(filesFor(release, 'linux').map((file) => file.format)).toEqual(['appimage', 'deb', 'rpm'])
})
