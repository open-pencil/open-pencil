import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { importPKCS8, SignJWT } from 'jose'
import type { Kysely } from 'kysely'

const APPLE_AUDIENCE = 'https://appleid.apple.com'
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

function socialProviders(config: CloudServerConfig): BetterAuthOptions['socialProviders'] {
  return {
    ...(config.googleClientId && config.googleClientSecret
      ? {
          google: {
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret
          }
        }
      : {}),
    ...(config.appleClientId
      ? {
          apple: async () => ({
            clientId: config.appleClientId ?? '',
            clientSecret: await generateAppleClientSecret(config),
            ...(config.appleAppBundleIdentifier
              ? { appBundleIdentifier: config.appleAppBundleIdentifier }
              : {})
          })
        }
      : {})
  }
}

export function configuredSocialProviders(config: CloudServerConfig): Array<'apple' | 'google'> {
  return [
    ...(config.appleClientId ? (['apple'] as const) : []),
    ...(config.googleClientId ? (['google'] as const) : [])
  ]
}

export function createCloudAuth(config: CloudServerConfig, database: Kysely<CloudDatabase>) {
  return betterAuth({
    appName: 'OpenPencil Cloud',
    baseURL: config.publicURL,
    basePath: '/api/auth',
    secret: config.authSecret,
    database: {
      db: database,
      type: 'postgres',
      casing: 'camel',
      transaction: true
    },
    advanced: {
      database: {
        generateId: 'uuid'
      }
    },
    socialProviders: socialProviders(config),
    trustedOrigins: [
      config.publicURL,
      ...config.trustedOrigins,
      ...(config.appleClientId ? [APPLE_AUDIENCE] : [])
    ]
  })
}

export { createCloudSessionResolver, type CloudActor, type CloudSessionResolver } from './session'

export type CloudAuth = ReturnType<typeof createCloudAuth>
