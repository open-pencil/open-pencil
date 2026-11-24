import {
  CLOUD_AGENT_PAIRING_CODE_PREFIX,
  CLOUD_TOKEN_SCOPES,
  cloudMCPResource,
  isAgentPairingToken,
  type CloudAgentPairingDecision,
  type CloudAgentPairingRequest
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { hashCapability } from '#cloud/server/sharing/crypto'
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { compactDecrypt, CompactEncrypt } from 'jose'
import { fromUint8Array } from 'js-base64'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import { randomHex } from '@open-pencil/std/random'
import { MINUTE_MS } from '@open-pencil/std/timing'

import { OAuthRequestError } from './service'

/** How long the agent has to exchange its code, which it does as soon as the browser returns. */
const CODE_LIFETIME_MS = MINUTE_MS
const CODE_SALT = utf8ToBytes('openpencil-cloud-agent-pairing-code')
const CODE_HEADER = { alg: 'dir', enc: 'A256GCM' } as const

const codePayloadSchema = v.object({
  token: v.string(),
  clientId: v.string(),
  redirectURI: v.string(),
  challenge: v.string(),
  scope: v.string()
})
type CodePayload = v.InferOutput<typeof codePayloadSchema>

/** What the token endpoint answers, or the OAuth error it refuses with (RFC 6749 §5). */
export type PairingTokenAnswer =
  | { access_token: string; token_type: 'Bearer'; scope: string }
  | { error: 'invalid_request' | 'invalid_grant' | 'invalid_client' }

const codeKey = (code: string) => hkdf(sha256, utf8ToBytes(code), CODE_SALT, new Uint8Array(), 32)
const codeIdentifier = (code: string) => `agent-pairing:${hashCapability(code)}`

async function seal(code: string, payload: CodePayload): Promise<string> {
  return new CompactEncrypt(utf8ToBytes(JSON.stringify(payload)))
    .setProtectedHeader(CODE_HEADER)
    .encrypt(codeKey(code))
}

async function unseal(code: string, sealed: string): Promise<CodePayload | null> {
  const { plaintext } = await compactDecrypt(sealed, codeKey(code), {
    keyManagementAlgorithms: [CODE_HEADER.alg],
    contentEncryptionAlgorithms: [CODE_HEADER.enc]
  })
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), codePayloadSchema),
    new TextDecoder().decode(plaintext)
  )
  return parsed.success ? parsed.output : null
}

/**
 * The branch of connecting an app that needs no account: the person pairs the agent with the editor
 * in their browser instead. Better Auth's provider has already checked the app, its return address,
 * and PKCE by the time it signs the query this starts from, but issues codes to accounts alone, so
 * the code and its exchange are Cloud's. The browser makes the pairing token. The server keeps it
 * for the minute until the agent exchanges its code, encrypted with a key only the code gives,
 * and an exchange deletes it before anything else, so a code works once.
 */
export function createAgentPairingGrants(options: {
  database: Kysely<CloudDatabase>
  publicURL: string
  issuer: string
  secret: string
}) {
  const { database } = options

  /** The signed request and its app, which must be one without a secret to prove (RFC 8252). */
  async function read(query: string) {
    if (!(await verifyOAuthQueryParams(query, options.secret))) {
      throw new OAuthRequestError('invalid_request')
    }
    const params = new URLSearchParams(query)
    const app = await database
      .selectFrom('oauthClient')
      .select(['clientId', 'name', 'uri', 'icon', 'disabled', 'tokenEndpointAuthMethod'])
      .where('clientId', '=', params.get('client_id') ?? '')
      .executeTakeFirst()
    const redirectURI = params.get('redirect_uri')
    const challenge = params.get('code_challenge')
    const resources = params.getAll('resource')
    if (
      !app ||
      app.disabled ||
      app.tokenEndpointAuthMethod !== 'none' ||
      !redirectURI ||
      !challenge ||
      params.get('code_challenge_method') !== 'S256' ||
      // A pairing reaches the MCP endpoint alone, so a request for another resource has none.
      resources.some((resource) => resource !== cloudMCPResource(options.publicURL))
    ) {
      throw new OAuthRequestError('invalid_request')
    }
    return { app, params, redirectURI, challenge }
  }

  function returnTo(redirectURI: string, params: URLSearchParams, answer: Record<string, string>) {
    const url = new URL(redirectURI)
    const state = params.get('state')
    for (const [key, value] of Object.entries(answer)) url.searchParams.set(key, value)
    if (state !== null) url.searchParams.set('state', state)
    url.searchParams.set('iss', options.issuer)
    return url.href
  }

  return {
    /** What the pairing page shows: the app, and where the browser returns to. */
    async request(query: string): Promise<CloudAgentPairingRequest> {
      const { app, redirectURI } = await read(query)
      return {
        app: {
          clientId: app.clientId,
          name: app.name ?? app.clientId,
          uri: app.uri,
          icon: app.icon
        },
        returnsTo: new URL(redirectURI).host || new URL(redirectURI).protocol
      }
    },

    /** The person's answer, as where the browser goes next: back to the agent with a code or a refusal. */
    async decide(decision: CloudAgentPairingDecision): Promise<string> {
      const { app, params, redirectURI, challenge } = await read(decision.query)
      if (decision.decision === 'deny') {
        return returnTo(redirectURI, params, { error: 'access_denied' })
      }
      const code = `${CLOUD_AGENT_PAIRING_CODE_PREFIX}${randomHex(32)}`
      const requested = (params.get('scope') ?? '').split(' ')
      const now = new Date()
      await database
        .insertInto('verification')
        .values({
          id: crypto.randomUUID(),
          identifier: codeIdentifier(code),
          value: await seal(code, {
            token: decision.token,
            clientId: app.clientId,
            redirectURI,
            challenge,
            scope: CLOUD_TOKEN_SCOPES.filter((scope) => requested.includes(scope)).join(' ')
          }),
          expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
          createdAt: now,
          updatedAt: now
        })
        .execute()
      return returnTo(redirectURI, params, { code })
    },

    /** Exchanges a code for the pairing token, once, for the app and verifier it was issued to. */
    async exchange(form: URLSearchParams): Promise<PairingTokenAnswer> {
      const code = form.get('code') ?? ''
      const verifier = form.get('code_verifier')
      if (form.get('grant_type') !== 'authorization_code' || !verifier) {
        return { error: 'invalid_request' }
      }
      const row = await database
        .deleteFrom('verification')
        .where('identifier', '=', codeIdentifier(code))
        .returning(['value', 'expiresAt'])
        .executeTakeFirst()
      if (!row || new Date(row.expiresAt).getTime() <= Date.now()) return { error: 'invalid_grant' }
      const payload = await unseal(code, row.value)
      const challenge = fromUint8Array(sha256(utf8ToBytes(verifier)), true)
      if (
        !payload ||
        !isAgentPairingToken(payload.token) ||
        payload.clientId !== form.get('client_id') ||
        payload.redirectURI !== form.get('redirect_uri') ||
        payload.challenge !== challenge ||
        form.getAll('resource').some((each) => each !== cloudMCPResource(options.publicURL))
      ) {
        return { error: 'invalid_grant' }
      }
      return { access_token: payload.token, token_type: 'Bearer', scope: payload.scope }
    }
  }
}

export type AgentPairingGrants = ReturnType<typeof createAgentPairingGrants>
