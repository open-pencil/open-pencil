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
 * Each provider as the server sets it up: its Better Auth options from the deployment's config, or
 * `undefined` where it is not configured, and whether its email may link to an existing account
 * whatever it says of that address (`trusted`). The one place a new provider's server side goes,
 * beside its config fields.
 */
const PROVIDERS: {
  [Provider in CloudSocialProvider]: {
    options: (config: CloudServerConfig) => ProviderOptions[Provider]
    trusted: boolean
  }
} = {
  // Google only gives an address it has verified.
  google: {
    options: (config) =>
      config.googleClientId && config.googleClientSecret
        ? { clientId: config.googleClientId, clientSecret: config.googleClientSecret }
        : undefined,
    trusted: true
  },
  // Apple's addresses are verified, or relays it delivers itself. Its client secret is a token the
  // server signs, so it is made when Better Auth asks.
  apple: {
    options: (config) =>
      config.appleClientId
        ? async () => ({
            clientId: config.appleClientId ?? '',
            clientSecret: await generateAppleClientSecret(config),
            ...(config.appleAppBundleIdentifier && {
              appBundleIdentifier: config.appleAppBundleIdentifier
            })
          })
        : undefined,
    trusted: true
  },
  // GitHub can hand over an address it has not verified, such as an account's first listed email
  // when none is primary; untrusted, it links only when GitHub says the address is verified.
  github: {
    options: (config) =>
      config.githubClientId && config.githubClientSecret
        ? { clientId: config.githubClientId, clientSecret: config.githubClientSecret }
        : undefined,
    trusted: false
  }
}

/**
 * Providers whose sign-in links to the account with the same email even when it does not say the
 * address is verified. Better Auth links any other provider only when it does.
 */
export const TRUSTED_SOCIAL_PROVIDERS: CloudSocialProvider[] = CLOUD_SOCIAL_PROVIDERS.filter(
  (provider) => PROVIDERS[provider].trusted
)

/** The providers the deployment configures, in the order the editor shows them. */
export function configuredSocialProviders(config: CloudServerConfig): CloudSocialProvider[] {
  return CLOUD_SOCIAL_PROVIDERS.filter(
    (provider) => PROVIDERS[provider].options(config) !== undefined
  )
}

/** Better Auth's options for the providers the deployment configures. */
export function socialProviders(config: CloudServerConfig): BetterAuthOptions['socialProviders'] {
  return Object.fromEntries(
    configuredSocialProviders(config).map((provider) => [
      provider,
      PROVIDERS[provider].options(config)
    ])
  )
}
