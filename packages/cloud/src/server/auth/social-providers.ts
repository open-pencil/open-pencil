import type { CloudServerConfig } from '#cloud/server/config'
import type { BetterAuthOptions } from 'better-auth'
import { importPKCS8, SignJWT } from 'jose'

/** The audience Apple's sign-in tokens carry, which the server also trusts as an origin. */
export const APPLE_AUDIENCE = 'https://appleid.apple.com'
const APPLE_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60
async function generateAppleClientSecret(config: CloudServerConfig): Promise<string> {
  if (
    !config.appleClientId ||
    !config.appleTeamId ||
    !config.appleKeyId ||
    !config.applePrivateKey
  ) {
    throw new Error('Apple authentication is not configured')
  }
  const privateKey = await importPKCS8(config.applePrivateKey.replaceAll('\\n', '\n'), 'ES256')
  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.appleKeyId })
    .setIssuer(config.appleTeamId)
    .setSubject(config.appleClientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + APPLE_SECRET_LIFETIME_SECONDS)
    .sign(privateKey)
}

/** The sign-in providers the deployment configures; Apple's secret is signed when it is needed. */
export function socialProviders(config: CloudServerConfig): BetterAuthOptions['socialProviders'] {
  const providers: BetterAuthOptions['socialProviders'] = {}
  if (config.googleClientId && config.googleClientSecret) {
    providers.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret
    }
  }
  if (config.appleClientId) {
    providers.apple = async () => {
      const provider: {
        clientId: string
        clientSecret: string
        appBundleIdentifier?: string
      } = {
        clientId: config.appleClientId ?? '',
        clientSecret: await generateAppleClientSecret(config)
      }
      if (config.appleAppBundleIdentifier) {
        provider.appBundleIdentifier = config.appleAppBundleIdentifier
      }
      return provider
    }
  }
  return providers
}
