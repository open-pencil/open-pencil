import { expect, test } from 'bun:test'

import { desktopAssets, desktopTargets } from '#release/native/catalog'

test('a release ships the NSIS installer and the MSI, the MSI answering the platform key', () => {
  expect(
    desktopAssets('x86_64-pc-windows-msvc', '0.17.0-beta.5').map(({ name, updaterKeys }) => ({
      name,
      updaterKeys
    }))
  ).toEqual([
    { name: 'OpenPencil_0.17.0-beta.5_x64-setup.exe', updaterKeys: ['windows-x86_64-nsis'] },
    {
      name: 'OpenPencil_0.17.0-beta.5_x64_en-US.msi',
      updaterKeys: ['windows-x86_64', 'windows-x86_64-msi']
    }
  ])
})

test('a nightly ships Windows through NSIS alone, which answers the platform key too', () => {
  expect(
    desktopAssets('aarch64-pc-windows-msvc', '0.17.0-nightly.20261116').map(
      ({ name, updaterKeys }) => ({ name, updaterKeys })
    )
  ).toEqual([
    {
      name: 'OpenPencil_nightly_arm64-setup.exe',
      updaterKeys: ['windows-aarch64', 'windows-aarch64-nsis']
    }
  ])
  // Other platforms ship what a release does.
  expect(desktopAssets('x86_64-unknown-linux-gnu', '0.17.0-nightly.20261116')).toHaveLength(3)
})

test('a nightly names its files without the version, so their links last from night to night', () => {
  const names = desktopTargets.flatMap((target) =>
    desktopAssets(target, '0.17.0-nightly.20261116').map(({ name }) => name)
  )
  expect(names).toEqual([
    'OpenPencil_nightly_aarch64.dmg',
    'OpenPencil_aarch64.app.tar.gz',
    'OpenPencil_nightly_x64.dmg',
    'OpenPencil_x64.app.tar.gz',
    'OpenPencil_nightly_x64-setup.exe',
    'OpenPencil_nightly_arm64-setup.exe',
    'OpenPencil_nightly_amd64.AppImage',
    'OpenPencil_nightly_amd64.deb',
    'OpenPencil-nightly-1.x86_64.rpm'
  ])
})

test.each(['0.17', 'nightly', '0.17.0-rc.1'])('refuses version %s', (version) => {
  expect(() => desktopAssets('aarch64-apple-darwin', version)).toThrow()
})
