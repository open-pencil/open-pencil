import {
  transactionalEmailContentSchema,
  type TransactionalEmailContent,
  type TransactionalEmailKind,
  type TransactionalEmailPayloadByKind
} from '#cloud/email'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { compactDecrypt, CompactEncrypt } from 'jose'
import * as v from 'valibot'

const EMAIL_PAYLOAD_SALT = utf8ToBytes('openpencil-cloud-transactional-email')
const EMAIL_PAYLOAD_HEADER = { alg: 'dir', enc: 'A256GCM' } as const
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function emailPayloadKey(secret: string, id: string, kind: TransactionalEmailKind): Uint8Array {
  return hkdf(
    sha256,
    utf8ToBytes(secret),
    EMAIL_PAYLOAD_SALT,
    encoder.encode(`openpencil-cloud-email:${kind}:${id}`),
    32
  )
}

export async function encryptTransactionalEmailPayload<Kind extends TransactionalEmailKind>(
  secret: string,
  id: string,
  kind: Kind,
  payload: TransactionalEmailPayloadByKind[Kind]
): Promise<string> {
  return new CompactEncrypt(encoder.encode(JSON.stringify(payload)))
    .setProtectedHeader(EMAIL_PAYLOAD_HEADER)
    .encrypt(emailPayloadKey(secret, id, kind))
}

export async function decryptTransactionalEmailPayload(
  secret: string,
  id: string,
  kind: TransactionalEmailKind,
  value: string
): Promise<TransactionalEmailContent> {
  const { plaintext, protectedHeader } = await compactDecrypt(
    value,
    emailPayloadKey(secret, id, kind)
  )
  if (
    protectedHeader.alg !== EMAIL_PAYLOAD_HEADER.alg ||
    protectedHeader.enc !== EMAIL_PAYLOAD_HEADER.enc
  ) {
    throw new Error('Unsupported transactional email payload encryption')
  }
  const payload = v.parse(v.pipe(v.string(), v.parseJson()), decoder.decode(plaintext))
  return v.parse(transactionalEmailContentSchema, { kind, payload })
}
