import type { BetterAuthPlugin } from 'better-auth'
import { decodeJwt } from 'jose'
import * as v from 'valibot'

import type { UserPictureService } from './service'

/** The providers whose ID token names the person's picture. */
const PICTURE_PROVIDERS = new Set(['google'])
const pictureClaimSchema = v.object({ picture: v.pipe(v.string(), v.url()) })

/**
 * The picture a linked account's provider names in the ID token Better Auth keeps on its account
 * row, or null. The token came to Better Auth from the provider during its sign-in flow, which no
 * client can write to the row.
 */
export function providerPicture(account: { providerId: string; idToken?: string | null }) {
  if (!PICTURE_PROVIDERS.has(account.providerId) || !account.idToken) return null
  try {
    const claims = v.safeParse(pictureClaimSchema, decodeJwt(account.idToken))
    return claims.success ? claims.output.picture : null
  } catch {
    return null
  }
}

/**
 * Keeps the picture a Google account names, so pages show the server's copy and never load it
 * from Google. Better Auth writes the account's ID token when it is linked and at each sign-in
 * with it, so accounts made before the server kept pictures move over the next time they sign in
 * this way. Better Auth also takes an `image` on sign-up and user updates; none of those reach the
 * account, since the server writes the addresses of the pictures it keeps itself.
 */
export function providerPictures(pictures: UserPictureService): BetterAuthPlugin {
  const keep = async (account: { userId: string; providerId: string; idToken?: string | null }) => {
    const picture = providerPicture(account)
    if (picture) await pictures.copyFromProvider(account.userId, picture)
  }
  return {
    id: 'openpencil-provider-pictures',
    init: () => ({
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user) => ({ data: { ...user, image: null } })
            },
            update: {
              // Better Auth merges what a hook returns into the update, so `image` is unset.
              before: async (user) =>
                user.image === undefined ? true : { data: { image: undefined } }
            }
          },
          account: {
            create: { after: keep },
            update: { after: keep }
          }
        }
      }
    })
  }
}
