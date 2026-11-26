import { expect, test } from 'bun:test'

import {
  isNightlyVersion,
  isPrerelease,
  msiVersion,
  nightlyVersion,
  upcomingRelease
} from '#release/version'

test.each([
  ['0.16.0', false, undefined],
  ['0.16.0-beta.1', true, '0.16.0.1'],
  ['1.2.3-beta.42', true, '1.2.3.42']
])('release version %s', (version, prerelease, msi) => {
  expect(isPrerelease(version)).toBe(prerelease)
  expect(msiVersion(version)).toBe(msi)
})

test.each(['0.16.0-rc.1', '0.16.0-beta', '0.16.0-beta.0', '0.16.0-beta.01', '0.16.0-1', '0.16'])(
  'rejects unsupported release version %s',
  (version) => {
    expect(() => isPrerelease(version)).toThrow()
  }
)

test.each([
  ['0.17.0-beta.5', '0.17.0'],
  ['0.17.0', '0.18.0'],
  ['1.9.3', '1.10.0']
])('master at %s heads for %s', (master, upcoming) => {
  expect(upcomingRelease(master)).toBe(upcoming)
})

const NIGHT = new Date('2026-11-16T03:00:00Z')

test.each([
  [undefined, '0.17.0-nightly.20261116'],
  ['0.17.0-nightly.20261115', '0.17.0-nightly.20261116'],
  ['0.17.0-nightly.20261116', '0.17.0-nightly.20261116.2'],
  ['0.17.0-nightly.20261116.2', '0.17.0-nightly.20261116.3'],
  // A release in between moves master's version, and the day starts over.
  ['0.16.0-nightly.20261116.4', '0.17.0-nightly.20261116']
])('after %s, tonight is %s', (previous, version) => {
  expect(nightlyVersion('0.17.0-beta.5', NIGHT, previous)).toBe(version)
  expect(isNightlyVersion(version)).toBe(true)
})

test.each([
  '0.17.0-beta.5',
  '0.17.0',
  '0.17.0-nightly',
  '0.17.0-nightly.2026111',
  '0.17.0-nightly.20261116.0'
])('%s is no nightly', (version) => {
  expect(isNightlyVersion(version)).toBe(false)
})
