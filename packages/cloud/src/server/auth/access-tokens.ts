import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { CLOUD_ACCESS_TOKEN_PREFIX, type CloudAccessToken } from '#cloud/contract'
import type { TermsService } from '#cloud/server/account/terms'
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

/** A stored token as the account's token list shows it, without the secret. */
export const toAccessToken = (key: {
  id: string
  name: string | null
  start: string | null
  createdAt: Date
  expiresAt: Date | null
  lastRequest: Date | null
}): CloudAccessToken => ({
  id: key.id,
  name: key.name ?? '',
  start: key.start,
  createdAt: new Date(key.createdAt).toISOString(),
  expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
  lastUsedAt: key.lastRequest ? new Date(key.lastRequest).toISOString() : null
})
