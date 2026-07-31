import { describe, expect, test } from 'bun:test'

import {
  decodeBase64,
  decodeBase64Text,
  encodeBase64,
  encodeBase64Text
} from '@open-pencil/core/bytes'

describe('Base64 byte helpers', () => {
  test('encode and decode empty and binary data', () => {
    expect(encodeBase64(new Uint8Array())).toBe('')

    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255])
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
  })

  test('encode and decode Unicode text as UTF-8', () => {
    const text = 'OpenPencil — Привет 🎨'
    expect(decodeBase64Text(encodeBase64Text(text))).toBe(text)
  })

  test('support URL-safe Base64', () => {
    const bytes = new Uint8Array([251, 255, 254])
    expect(encodeBase64(bytes, 'base64url')).toBe('-__-')
    expect(decodeBase64('-__-')).toEqual(bytes)
  })

  test('handle data larger than browser argument limits', () => {
    const bytes = Uint8Array.from({ length: 256 * 1024 }, (_, index) => index % 251)
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
  })

  test('reject malformed Base64', () => {
    expect(() => decodeBase64('not%base64')).toThrow('Invalid Base64 string')
    expect(() => decodeBase64Text('%%%')).toThrow('Invalid Base64 string')
  })
})
