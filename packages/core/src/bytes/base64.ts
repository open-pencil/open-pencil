import {
  decode as decodeText,
  encode as encodeText,
  fromUint8Array,
  isValid,
  toUint8Array
} from 'js-base64'

export type Base64Alphabet = 'base64' | 'base64url'

function assertValidBase64(value: string): void {
  if (!isValid(value)) throw new TypeError('Invalid Base64 string')
}

/** Encode binary data without converting it through a JavaScript string. */
export function encodeBase64(bytes: Uint8Array, alphabet: Base64Alphabet = 'base64'): string {
  return fromUint8Array(bytes, alphabet === 'base64url')
}

/** Decode standard or URL-safe Base64 into binary data. */
export function decodeBase64(value: string): Uint8Array {
  assertValidBase64(value)
  return toUint8Array(value)
}

/** Encode a Unicode string as UTF-8 Base64. */
export function encodeBase64Text(value: string, alphabet: Base64Alphabet = 'base64'): string {
  return encodeText(value, alphabet === 'base64url')
}

/** Decode standard or URL-safe UTF-8 Base64 into a Unicode string. */
export function decodeBase64Text(value: string): string {
  assertValidBase64(value)
  return decodeText(value)
}
