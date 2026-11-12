import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { minisignPublicKey, verifyMinisign } from '#release/native/minisign'
import { decode, fromUint8Array, toUint8Array } from 'js-base64'

/** A minisign key pair as the Tauri CLI makes one, and the files it signs. */
function signer(keyId: Buffer) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw = toUint8Array(required(publicKey.export({ format: 'jwk' }).x))
  const publicKeyFile = [
    `untrusted comment: minisign public key ${keyId.toString('hex').toUpperCase()}`,
    fromUint8Array(Buffer.concat([Buffer.from('Ed'), keyId, raw]))
  ].join('\n')

  function signFile(contents: Buffer, comment: string, algorithm: 'ED' | 'Ed' = 'ED') {
    const message =
      algorithm === 'ED' ? createHash('blake2b512').update(contents).digest() : contents
    const signature = sign(null, message, privateKey)
    const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey)
    return [
      'untrusted comment: signature from tauri secret key',
      fromUint8Array(Buffer.concat([Buffer.from(algorithm), keyId, signature])),
      `trusted comment: ${comment}`,
      fromUint8Array(global)
    ].join('\n')
  }

  return { publicKeyFile, signFile }
}

function required(value: string | undefined): string {
  if (value === undefined) throw new Error('Missing key material')
  return value
}

const keyId = Buffer.from('01ede4780ebfc058', 'hex')
const contents = Buffer.from('OpenPencil.app.tar.gz bytes')
const comment = 'timestamp:1\tfile:OpenPencil.app.tar.gz\tversion:0.17.0'
let directory = ''
let artifact = ''

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'open-pencil-minisign-'))
  artifact = join(directory, 'OpenPencil.app.tar.gz')
  await writeFile(artifact, contents)
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('accepts the prehashed signatures the Tauri CLI writes, and legacy ones', async () => {
  const { publicKeyFile, signFile } = signer(keyId)
  const key = minisignPublicKey(publicKeyFile)

  await expect(verifyMinisign(artifact, key, signFile(contents, comment))).resolves.toBe(comment)
  await expect(verifyMinisign(artifact, key, signFile(contents, comment, 'Ed'))).resolves.toBe(
    comment
  )
})

test('rejects a signature of other bytes', async () => {
  const { publicKeyFile, signFile } = signer(keyId)

  await expect(
    verifyMinisign(artifact, minisignPublicKey(publicKeyFile), signFile(Buffer.from('x'), comment))
  ).rejects.toThrow('Invalid signature')
})

test('rejects a signature from another key', async () => {
  const trusted = signer(keyId)
  const other = signer(Buffer.from('0000000000000001', 'hex'))
  const impostor = signer(keyId)

  await expect(
    verifyMinisign(
      artifact,
      minisignPublicKey(trusted.publicKeyFile),
      other.signFile(contents, comment)
    )
  ).rejects.toThrow('signed with another key')
  await expect(
    verifyMinisign(
      artifact,
      minisignPublicKey(trusted.publicKeyFile),
      impostor.signFile(contents, comment)
    )
  ).rejects.toThrow('Invalid signature')
})

test('rejects a trusted comment changed after signing, such as its version', async () => {
  const { publicKeyFile, signFile } = signer(keyId)
  const forged = signFile(contents, comment).replace('version:0.17.0', 'version:0.18.0')

  await expect(verifyMinisign(artifact, minisignPublicKey(publicKeyFile), forged)).rejects.toThrow(
    'Invalid trusted comment signature'
  )
})

test('refuses a malformed key', () => {
  expect(() => minisignPublicKey('untrusted comment: key\nAAAA')).toThrow(
    'Malformed minisign public key'
  )
})

/** A file, its signature, and the public key, made with `tauri signer`, as a release signs. */
const tauriSigned = join(import.meta.dir, '../fixtures/tauri-signed')
const readTauriSigned = async (name: string) =>
  decode(await readFile(join(tauriSigned, name), 'utf8'))

test('accepts what the Tauri CLI signs, and returns the comment its signature covers', async () => {
  const key = minisignPublicKey(await readTauriSigned('key.pub'))
  const signature = await readTauriSigned('OpenPencil.app.tar.gz.sig')

  expect(await verifyMinisign(join(tauriSigned, 'OpenPencil.app.tar.gz'), key, signature)).toMatch(
    /\tfile:OpenPencil\.app\.tar\.gz\tversion:0\.17\.0$/
  )
  await expect(verifyMinisign(artifact, key, signature)).rejects.toThrow('Invalid signature')
})

test('returns the signed comment, not an unsigned line made to look like one', async () => {
  const key = minisignPublicKey(await readTauriSigned('key.pub'))
  const signature = await readTauriSigned('OpenPencil.app.tar.gz.sig')
  // The first line is unsigned; a forger can write anything there, such as another version.
  const forged = signature.replace(/^untrusted comment: .*$/m, 'trusted comment: version:9.9.9')

  expect(await verifyMinisign(join(tauriSigned, 'OpenPencil.app.tar.gz'), key, forged)).toEndWith(
    'version:0.17.0'
  )
})
