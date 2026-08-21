import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { bearer, deviceAuthorization } from 'better-auth/plugins'
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

export function createCloudAuth(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>
): CloudAuth {
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
    plugins: [
      bearer({ requireSignature: true }),
      deviceAuthorization({
        verificationUri: `${config.appURL ?? config.publicURL}/cloud/device`,
        validateClient: (clientId) => clientId.startsWith('openpencil-desktop:')
      })
    ],
    socialProviders: socialProviders(config),
    trustedOrigins: [
      config.publicURL,
      ...config.trustedOrigins,
      ...(config.appleClientId ? [APPLE_AUDIENCE] : [])
    ]
  }) as CloudAuth
}

export { workspaceAccessControl, workspaceRoles, workspaceStatements } from './workspace-access'
// The concrete Better Auth plugin graph is intentionally kept internal; server consumers use this
// structural surface so declaration output does not leak Better Auth's Zod implementation types.
export interface CloudAuth {
  api: {
    getSession(input: { headers: Headers }): Promise<{
      session: { token: string; expiresAt: Date }
      user: { id: string; email: string; name: string }
    } | null>
  }
  handler(request: Request): Promise<Response>
  options: BetterAuthOptions
}

export { createCloudSessionResolver, type CloudActor, type CloudSessionResolver } from './session'
