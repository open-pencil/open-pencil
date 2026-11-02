import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { compactDecrypt, CompactEncrypt } from 'jose'

const CONTINUATION_SALT = utf8ToBytes('openpencil-cloud-invitation-continuation')
const CONTINUATION_HEADER = { alg: 'dir', enc: 'A256GCM' } as const

export function hashCapability(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)))
}

export function capabilityHashMatches(stored: string, value: string): boolean {
  let expected: Uint8Array
  try {
    expected = hexToBytes(stored)
  } catch {
    return false
  }
  const actual = sha256(utf8ToBytes(value))
  if (expected.length !== actual.length) return false
  let difference = 0
  for (const [index, expectedByte] of expected.entries()) {
    difference |= expectedByte ^ (actual[index] ?? 0)
  }
  return difference === 0
}

function continuationKey(secret: string): Uint8Array {
  return hkdf(sha256, utf8ToBytes(secret), CONTINUATION_SALT, new Uint8Array(), 32)
}

export async function encryptContinuationToken(secret: string, token: string): Promise<string> {
  return new CompactEncrypt(utf8ToBytes(token))
    .setProtectedHeader(CONTINUATION_HEADER)
    .encrypt(continuationKey(secret))
}

export async function decryptContinuationToken(secret: string, value: string): Promise<string> {
  const { plaintext, protectedHeader } = await compactDecrypt(value, continuationKey(secret))
  if (
    protectedHeader.alg !== CONTINUATION_HEADER.alg ||
    protectedHeader.enc !== CONTINUATION_HEADER.enc
  ) {
    throw new Error('Unsupported invitation continuation encryption')
  }
  return new TextDecoder().decode(plaintext)
}
