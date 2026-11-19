import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { isPlainObject } from 'es-toolkit/predicate'
import { fromUint8Array } from 'js-base64'

/** Objects with their keys in code-point order, so key order never changes a fingerprint. */
function sortedKeys(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { bytes: fromUint8Array(value) }
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .toSorted()
      .map((key) => [key, value[key]])
  )
}

/** `sha256:<hex>` of a value's JSON, which already leaves absent fields out and URLs as text. */
export async function fingerprint(value: unknown): Promise<string> {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(JSON.stringify(value, sortedKeys))))}`
}
