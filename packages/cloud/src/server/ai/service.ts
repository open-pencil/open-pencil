import { CLOUD_AI_TOKEN_AUDIENCE, type AIToken } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { workspaceRole } from '#cloud/server/documents/repository'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { SignJWT } from 'jose'
import type { Kysely } from 'kysely'

import { AINotEntitledError } from './errors'
import { AI_SIGNING_ALGORITHM, type AISigningKey } from './keys'

export type AITokenServiceOptions = {
  database: Kysely<CloudDatabase>
  policy: CloudPolicy
  deploymentMode: 'official' | 'self-hosted'
  /** The Cloud public URL, which services check as the token's `iss`. */
  issuer: string
  signingKey: AISigningKey
  lifetimeSeconds: number
}

export function createAITokenService(options: AITokenServiceOptions) {
  const { privateKey, publicJWK } = options.signingKey

  return {
    /**
     * Signs a token that lets a workspace member reach the AI service on the workspace's behalf.
     * Entitlements are read for every token, so a plan change reaches the service within one
     * token lifetime.
     */
    async issue(actor: CloudActor, workspaceId: string): Promise<AIToken> {
      if (!(await workspaceRole(options.database, actor.userId, workspaceId))) {
        throw new DocumentNotFoundError()
      }
      const context = {
        targetingKey: workspaceId,
        actorId: actor.userId,
        workspaceId,
        deploymentMode: options.deploymentMode
      }
      const [enabled, allowance] = await Promise.all([
        options.policy.boolean(CLOUD_FEATURE_KEYS.cloudAI, false, context),
        options.policy.number(CLOUD_FEATURE_KEYS.monthlyCreditAllowance, -1, context)
      ])
      if (!enabled) throw new AINotEntitledError()
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + options.lifetimeSeconds
      const token = await new SignJWT({
        workspaceId,
        monthlyCreditAllowance: allowance < 0 ? null : allowance
      })
        .setProtectedHeader({ alg: AI_SIGNING_ALGORITHM, kid: publicJWK.kid, typ: 'JWT' })
        .setIssuer(options.issuer)
        .setAudience(CLOUD_AI_TOKEN_AUDIENCE)
        .setSubject(actor.userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(privateKey)
      return { token, expiresAt: new Date(expiresAt * 1000).toISOString() }
    },

    jwks() {
      return { keys: [publicJWK] }
    }
  }
}

export type AITokenService = ReturnType<typeof createAITokenService>
