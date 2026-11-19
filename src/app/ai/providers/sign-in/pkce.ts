import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { fromUint8Array } from 'js-base64'

/** An OAuth PKCE pair and the state that ties a redirect to the attempt that started it. */
export interface PKCE {
  verifier: string
  challenge: string
  state: string
}

function randomToken(bytes: number): string {
  return fromUint8Array(crypto.getRandomValues(new Uint8Array(bytes)), true)
}

/** The S256 challenge for a verifier: the base64url SHA-256 digest, without padding. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return fromUint8Array(sha256(utf8ToBytes(verifier)), true)
}

/** The secrets of a PKCE pair, drawn at once; only the challenge needs to wait for hashing. */
export function pkceSecrets(): Pick<PKCE, 'verifier' | 'state'> {
  return { verifier: randomToken(48), state: randomToken(16) }
}
