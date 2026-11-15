import { CLOUD_BILLING_TOKEN_AUDIENCE, type BillingToken } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { SERVICES_SIGNING_ALGORITHM, type ServicesSigningKey } from '#cloud/server/services/keys'
import { SignJWT } from 'jose'

export type BillingTokenServiceOptions = {
  /** The Cloud public URL, which billing checks as the token's `iss`. */
  issuer: string
  /** The services' key, whose public half Cloud publishes for billing to verify with. */
  signingKey: ServicesSigningKey
  lifetimeSeconds: number
}

export function createBillingTokenService(options: BillingTokenServiceOptions) {
  const { privateKey, publicJWK } = options.signingKey
  return {
    /**
     * Signs a token that lets the signed-in person buy or manage their own account's plan and
     * credits with billing; nobody else's, since an account is the person.
     */
    async issue(actor: CloudActor): Promise<BillingToken> {
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + options.lifetimeSeconds
      const token = await new SignJWT({ email: actor.email })
        .setProtectedHeader({ alg: SERVICES_SIGNING_ALGORITHM, kid: publicJWK.kid, typ: 'JWT' })
        .setIssuer(options.issuer)
        .setAudience(CLOUD_BILLING_TOKEN_AUDIENCE)
        .setSubject(actor.userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(privateKey)
      return { token, expiresAt: new Date(expiresAt * 1000).toISOString() }
    }
  }
}

export type BillingTokenService = ReturnType<typeof createBillingTokenService>
