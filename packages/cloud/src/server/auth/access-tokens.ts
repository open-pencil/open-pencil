import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import {
  CLOUD_ACCESS_TOKEN_PREFIX,
  type CloudAccessToken,
  type CloudAccessTokenAccess,
  type CloudAccessTokenCreate,
  type CloudTokenScope
} from '#cloud/contract'
import type { TermsService } from '#cloud/server/account/terms'
import type { CloudActor } from '#cloud/server/auth/session'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

/** The personal access token in `Authorization: Bearer`, when the header carries one of Cloud's. */
export function bearerAccessToken(headers: Headers): string | null {
  const key = headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  return key?.startsWith(CLOUD_ACCESS_TOKEN_PREFIX) ? key : null
}

/**
 * The account a verified token belongs to, held to what a session would be: not banned, approved,
 * and with the current terms accepted.
 */
export async function accessTokenAccount(
  {
    database,
    config,
    enrollment,
    terms
  }: {
    database: Kysely<CloudDatabase>
    config: CloudServerConfig
    enrollment: EnrollmentService
    terms: TermsService
  },
  userId: string
) {
  const user = await database
    .selectFrom('user')
    .select(['id', 'email', 'name', 'image', 'role', 'banned', 'banExpires'])
    .where('id', '=', userId)
    .executeTakeFirst()
  if (!user) return null
  const banExpires = user.banExpires ? new Date(user.banExpires).getTime() : null
  if (user.banned && (banExpires === null || banExpires > Date.now())) return null
  if (config.enrollmentMode === 'approval' && !(await enrollment.isApproved(user.email))) {
    return null
  }
  if (!(await terms.hasAccepted(user.id))) return null
  return user
}

const DAY_SECONDS = 24 * 60 * 60

type KeyPermissions = Record<string, string[]> | null | undefined

/**
 * What a token may do, kept as the API-key plugin's permissions on the document resource. A token
 * made before tokens had scopes has none recorded and could always write, so it still may.
 */
export const ACCESS_TOKEN_PERMISSIONS: Record<CloudAccessTokenAccess, Record<string, string[]>> = {
  read: { documents: ['read'] },
  write: { documents: ['read', 'write'] }
}

export function accessTokenAccess(permissions: KeyPermissions): CloudAccessTokenAccess {
  if (!permissions) return 'write'
  return permissions.documents?.includes('write') ? 'write' : 'read'
}

export const accessTokenScopes = (access: CloudAccessTokenAccess): CloudTokenScope[] =>
  access === 'write' ? ['documents:read', 'documents:write'] : ['documents:read']

/** Administrators are granted only through the `admin` command or by another administrator. */
export const deploymentRole = (user: { id: string; role?: string | null }) =>
  user.role === 'admin' ? ('admin' as const) : ('user' as const)

/**
 * The actor a token stands for, once its account is held to what a session would be; `extra`
 * says what the token may do.
 */
export async function tokenActor(
  context: Parameters<typeof accessTokenAccount>[0],
  userId: string,
  credential: 'token' | 'app',
  extra: Pick<CloudActor, 'scopes' | 'grant'>
): Promise<CloudActor | null> {
  const user = await accessTokenAccount(context, userId)
  if (!user) return null
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    deploymentRole: deploymentRole(user),
    credential,
    ...extra
  }
}

/** A stored token as the account's token list shows it, without the secret. */
export const toAccessToken = (key: {
  id: string
  name: string | null
  start: string | null
  createdAt: Date
  expiresAt: Date | null
  lastRequest: Date | null
  permissions?: KeyPermissions
}): CloudAccessToken => ({
  id: key.id,
  name: key.name ?? '',
  start: key.start,
  createdAt: new Date(key.createdAt).toISOString(),
  expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
  lastUsedAt: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
  access: accessTokenAccess(key.permissions)
})

type StoredKey = Parameters<typeof toAccessToken>[0]

/** The API-key plugin's endpoints, and the sessions, the account's token routes go through. */
type AccessTokenStore = {
  list: (headers: Headers) => Promise<{ apiKeys: StoredKey[] }>
  create: (body: {
    name: string
    expiresIn: number
    userId: string
    permissions: Record<string, string[]>
  }) => Promise<StoredKey & { key: string }>
  remove: (headers: Headers, keyId: string) => Promise<unknown>
  /** The session when it signed in recently, or a `SESSION_NOT_FRESH` error. */
  fresh: (headers: Headers) => Promise<{ user: { id: string } }>
  current: (headers: Headers) => Promise<unknown>
}

/**
 * Listing, making, and revoking the signed-in account's tokens. A token outlives the session that
 * makes it, so making one needs a recent sign-in.
 */
export function accessTokenMethods(store: AccessTokenStore) {
  return {
    async listAccessTokens(headers: Headers): Promise<CloudAccessToken[] | null> {
      if (!(await store.current(headers))) return null
      return (await store.list(headers)).apiKeys.map(toAccessToken)
    },
    async createAccessToken(headers: Headers, input: CloudAccessTokenCreate) {
      const created = await store.create({
        name: input.name,
        expiresIn: input.expiresInDays * DAY_SECONDS,
        userId: (await store.fresh(headers)).user.id,
        permissions: ACCESS_TOKEN_PERMISSIONS[input.access]
      })
      return { token: created.key, accessToken: toAccessToken(created) }
    },
    async revokeAccessToken(headers: Headers, id: string): Promise<void> {
      await store.remove(headers, id)
    }
  }
}
