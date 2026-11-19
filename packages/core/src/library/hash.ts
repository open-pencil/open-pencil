import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

function canonicalize(value: unknown): unknown {
  if (value instanceof Uint8Array) return { $bytes: [...value] }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => {
          if (left < right) return -1
          if (left > right) return 1
          return 0
        })
        .map(([key, entry]) => [key, canonicalize(entry)])
    )
  }
  return value
}

export function canonicalJSONString(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export async function contentHash(value: unknown): Promise<string> {
  if (typeof crypto === 'undefined') {
    throw new TypeError('Web Crypto is required to hash library content')
  }
  return bytesToHex(sha256(utf8ToBytes(canonicalJSONString(value))))
}
