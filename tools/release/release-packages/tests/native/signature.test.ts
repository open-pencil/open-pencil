import { expect, test } from 'bun:test'

import { assertSignedVersion, signedVersion } from '#release/native/signature'

function minisign(trustedComment: string): string {
  return [
    'untrusted comment: signature from tauri secret key',
    'RUQB7eR4Dr/AWAAAAA==',
    `trusted comment: ${trustedComment}`,
    'BBBB=='
  ].join('\n')
}

test('reads the version the Tauri CLI records in the trusted comment', () => {
  expect(signedVersion(minisign('timestamp:1\tfile:OpenPencil.app.tar.gz\tversion:0.16.0'))).toBe(
    '0.16.0'
  )
  expect(signedVersion(minisign('timestamp:1\tfile:OpenPencil.app.tar.gz'))).toBeNull()
})

test('accepts only a signature made for the released version', () => {
  const asset = 'OpenPencil.app.tar.gz'
  expect(() =>
    assertSignedVersion(minisign(`timestamp:1\tfile:${asset}\tversion:0.16.0`), '0.16.0', asset)
  ).not.toThrow()
  expect(() =>
    assertSignedVersion(minisign(`timestamp:1\tfile:${asset}\tversion:0.15.1`), '0.16.0', asset)
  ).toThrow('is for version 0.15.1')
  expect(() =>
    assertSignedVersion(minisign(`timestamp:1\tfile:${asset}`), '0.16.0', asset)
  ).toThrow('does not record a version')
})
