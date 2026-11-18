import { CLOUD_SOCIAL_PROVIDERS, type CloudSocialProvider } from '#cloud/contract/account'
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

type ProviderOptions = NonNullable<BetterAuthOptions['socialProviders']>

/**
 * How each provider is set up from the deployment's config, or `undefined` where it is not: the
 * one place a new provider's server side goes, beside its config fields.
 */
const PROVIDERS: {
  [Provider in CloudSocialProvider]: (config: CloudServerConfig) => ProviderOptions[Provider]
} = {
  google: (config) =>
    config.googleClientId && config.googleClientSecret
      ? { clientId: config.googleClientId, clientSecret: config.googleClientSecret }
      : undefined,
  // Apple's client secret is a token the server signs, so it is made when Better Auth asks.
  apple: (config) =>
    config.appleClientId
      ? async () => ({
          clientId: config.appleClientId ?? '',
          clientSecret: await generateAppleClientSecret(config),
          ...(config.appleAppBundleIdentifier && {
            appBundleIdentifier: config.appleAppBundleIdentifier
          })
        })
      : undefined,
  github: (config) =>
    config.githubClientId && config.githubClientSecret
      ? { clientId: config.githubClientId, clientSecret: config.githubClientSecret }
      : undefined
}

/**
 * Providers whose verified email links a sign-in to the account with that email: each of these
 * reports whether it verified the address it gives.
 */
export const TRUSTED_SOCIAL_PROVIDERS: CloudSocialProvider[] = [...CLOUD_SOCIAL_PROVIDERS]

/** The providers the deployment configures, in the order the editor shows them. */
export function configuredSocialProviders(config: CloudServerConfig): CloudSocialProvider[] {
  return CLOUD_SOCIAL_PROVIDERS.filter((provider) => PROVIDERS[provider](config) !== undefined)
}

/** Better Auth's options for the providers the deployment configures. */
export function socialProviders(config: CloudServerConfig): BetterAuthOptions['socialProviders'] {
  return Object.fromEntries(
    configuredSocialProviders(config).map((provider) => [provider, PROVIDERS[provider](config)])
  )
}
