import { sha256 } from '@noble/hashes/sha2.js'
import { fromUint8Array } from 'js-base64'

/** The SHA-256 of `bytes`, in Base64, as Cloud checks an upload against it. */
export async function cloudChecksum(bytes: Uint8Array): Promise<string> {
  return fromUint8Array(sha256(bytes))
}
