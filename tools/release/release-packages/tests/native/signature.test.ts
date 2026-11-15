import { expect, test } from 'bun:test'

import { assertSignedVersion, signedVersion } from '#release/native/signature'

const asset = 'OpenPencil.app.tar.gz'

test('reads the version the Tauri CLI records in the trusted comment', () => {
  expect(signedVersion(`timestamp:1\tfile:${asset}\tversion:0.16.0`)).toBe('0.16.0')
  expect(signedVersion(`timestamp:1\tfile:${asset}`)).toBeNull()
})

test('accepts only a signature made for the released version', () => {
  expect(() =>
    assertSignedVersion(`timestamp:1\tfile:${asset}\tversion:0.16.0`, '0.16.0', asset)
  ).not.toThrow()
  expect(() =>
    assertSignedVersion(`timestamp:1\tfile:${asset}\tversion:0.15.1`, '0.16.0', asset)
  ).toThrow('is for version 0.15.1')
  expect(() => assertSignedVersion(`timestamp:1\tfile:${asset}`, '0.16.0', asset)).toThrow(
    'does not record a version'
  )
})
