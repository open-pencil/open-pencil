import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

const KEY_ID_BYTES = 8
const SIGNATURE_BYTES = 64
const PUBLIC_KEY_BYTES = 32
const TRUSTED_COMMENT = 'trusted comment: '

type PublicKey = { keyId: Buffer; key: KeyObject }

/** The second line of a minisign file, decoded: its algorithm, key ID, and the rest. */
function payload(text: string, kind: string, restBytes: number) {
  const line = text.split(/\r?\n/)[1]
  if (line === undefined || !isValid(line)) throw new Error(`Malformed minisign ${kind}`)
  const bytes = Buffer.from(toUint8Array(line))
  if (bytes.length !== 2 + KEY_ID_BYTES + restBytes) {
    throw new Error(`Malformed minisign ${kind}`)
  }
  return {
    algorithm: bytes.subarray(0, 2).toString('latin1'),
    keyId: bytes.subarray(2, 2 + KEY_ID_BYTES),
    rest: bytes.subarray(2 + KEY_ID_BYTES)
  }
}

/** Reads a minisign public key file, such as Tauri's decoded `plugins.updater.pubkey`. */
export function minisignPublicKey(text: string): PublicKey {
  const { algorithm, keyId, rest } = payload(text, 'public key', PUBLIC_KEY_BYTES)
  if (algorithm !== 'Ed') throw new Error(`Unsupported minisign key algorithm ${algorithm}`)
  const key = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: fromUint8Array(rest, true) },
    format: 'jwk'
  })
  return { keyId, key }
}

async function blake2b(path: string): Promise<Buffer> {
  const hash = createHash('blake2b512')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest()
}

/**
 * Verifies a minisign signature of a file as `minisign -V` does: the key ID, the signature of the
 * file (or of its BLAKE2b-512 hash), and the global signature over the trusted comment. Returns
 * that comment, the only one the signature vouches for; read the signed version from it.
 */
export async function verifyMinisign(
  path: string,
  publicKey: PublicKey,
  signature: string
): Promise<string> {
  const lines = signature.split(/\r?\n/)
  const { algorithm, keyId, rest } = payload(signature, 'signature', SIGNATURE_BYTES)
  if (algorithm !== 'Ed' && algorithm !== 'ED') {
    throw new Error(`Unsupported minisign signature algorithm ${algorithm}`)
  }
  if (!keyId.equals(publicKey.keyId)) {
    throw new Error(`${path} is signed with another key`)
  }

  // `ED`, which the Tauri CLI writes, signs the file's BLAKE2b-512 hash; legacy `Ed` the file itself.
  const message = algorithm === 'ED' ? await blake2b(path) : await readFile(path)
  if (!verify(null, message, publicKey.key, rest)) {
    throw new Error(`Invalid signature for ${path}`)
  }

  const comment = lines[2]
  const global = lines[3]
  if (!comment?.startsWith(TRUSTED_COMMENT) || global === undefined || !isValid(global)) {
    throw new Error(`Malformed minisign signature for ${path}`)
  }
  const trusted = Buffer.from(comment.slice(TRUSTED_COMMENT.length), 'utf8')
  const globalSignature = toUint8Array(global)
  if (
    globalSignature.length !== SIGNATURE_BYTES ||
    !verify(null, Buffer.concat([rest, trusted]), publicKey.key, globalSignature)
  ) {
    throw new Error(`Invalid trusted comment signature for ${path}`)
  }
  return trusted.toString('utf8')
}
