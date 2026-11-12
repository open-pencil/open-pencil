import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { pngHeader } from '#cloud-tests/helpers/pictures'
import {
  createUserPictures,
  providerPictures,
  type UserPictureService
} from '#cloud/server/pictures'
import { betterAuth } from 'better-auth'
import { UnsecuredJWT } from 'jose'

const PUBLIC_URL = 'https://cloud.example.com'
const GOOGLE_PICTURE = 'https://lh3.googleusercontent.com/a/picture=s96-c'

/** Better Auth with only the pictures plugin, writing through its own adapter so its hooks run. */
async function pictureAuth() {
  const runtime = await createCloudTestDatabase()
  const requested: string[] = []
  const pictures = createUserPictures(runtime.database, {
    publicURL: PUBLIC_URL,
    fetch: async (url) => {
      requested.push(url)
      return new Response(pngHeader(96, 96))
    }
  })
  const auth = betterAuth({
    baseURL: PUBLIC_URL,
    secret: 'a test secret that is long enough for better auth',
    database: { db: runtime.database, type: 'postgres', casing: 'camel' },
    advanced: { database: { generateId: 'uuid' } },
    plugins: [providerPictures(pictures)]
  })
  const adapter = (await auth.$context).internalAdapter
  const image = async (userId: string) =>
    (
      await runtime.database
        .selectFrom('user')
        .select('image')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow()
    ).image
  return { runtime, adapter, requested, image }
}

describe('provider pictures', () => {
  test('drops an image any write through Better Auth names', async () => {
    const { runtime, adapter, image } = await pictureAuth()
    try {
      const user = await adapter.createUser(
        { email: 'image@example.com', name: 'Image', image: 'https://pictures.example.com/me.png' },
        { method: 'email-password' }
      )
      expect(await image(user.id)).toBeNull()
      await adapter.updateUser(user.id, { image: GOOGLE_PICTURE, name: 'Renamed' })
      expect(await image(user.id)).toBeNull()
    } finally {
      await runtime.close()
    }
  })

  test("keeps the picture a linked Google account's token names, and an upload over it", async () => {
    const { runtime, adapter, requested, image } = await pictureAuth()
    try {
      const user = await adapter.createUser(
        { email: 'google@example.com', name: 'Google' },
        { method: 'email-password' }
      )
      const idToken = new UnsecuredJWT({ picture: GOOGLE_PICTURE }).encode()
      const account = await adapter.linkAccount({
        userId: user.id,
        providerId: 'google',
        accountId: 'google-subject',
        idToken
      })
      expect(requested).toEqual([GOOGLE_PICTURE])
      expect(await image(user.id)).toStartWith(`${PUBLIC_URL}/api/pictures/${user.id}/`)

      // Signing in again rewrites the account's token; the picture the account shows stays.
      await adapter.updateAccount(account.id, { idToken })
      expect(requested).toHaveLength(1)
      const kept = await image(user.id)
      await adapter.updateUser(user.id, { image: GOOGLE_PICTURE, name: 'Renamed' })
      expect(await image(user.id)).toBe(kept)
    } finally {
      await runtime.close()
    }
  })
})

/**
 * A copy of the Google picture held mid-fetch: `during` runs once the fetch has begun, past the
 * check before it, and the picture then arrives. Returns what the account shows afterwards.
 */
async function copyWhile<Result>(
  image: string | null,
  during: (pictures: UserPictureService, userId: string) => Promise<Result>
) {
  const runtime = await createCloudTestDatabase()
  try {
    const userId = crypto.randomUUID()
    await runtime.database
      .insertInto('user')
      .values({ id: userId, name: 'Racer', email: 'racer@example.com', emailVerified: true, image })
      .execute()
    let answer: (response: Response) => void = () => undefined
    let fetching: () => void = () => undefined
    const fetchStarted = new Promise<void>((resolve) => {
      fetching = resolve
    })
    const pictures = createUserPictures(runtime.database, {
      publicURL: PUBLIC_URL,
      fetch: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
          fetching()
        })
    })
    const copying = pictures.copyFromProvider(userId, GOOGLE_PICTURE)
    await fetchStarted
    const result = await during(pictures, userId)
    answer(new Response(pngHeader(96, 96)))
    await copying
    const { image: shown } = await runtime.database
      .selectFrom('user')
      .select('image')
      .where('id', '=', userId)
      .executeTakeFirstOrThrow()
    return { result, shown }
  } finally {
    await runtime.close()
  }
}

describe('a provider picture fetched meanwhile', () => {
  test('does not replace an upload', async () => {
    const { result, shown } = await copyWhile(null, (pictures, userId) =>
      pictures.upload(userId, pngHeader(256, 256))
    )
    expect(shown).toBe(result)
  })

  test('does not undo a removal', async () => {
    // An account from before the server kept pictures shows Google's address until it signs in.
    const { shown } = await copyWhile(GOOGLE_PICTURE, (pictures, userId) => pictures.remove(userId))
    expect(shown).toBeNull()
  })

  test('does not undo an upload removed again', async () => {
    const { shown } = await copyWhile(null, async (pictures, userId) => {
      await pictures.upload(userId, pngHeader(256, 256))
      await pictures.remove(userId)
    })
    expect(shown).toBeNull()
  })
})
