import { describe, expect, test } from 'bun:test'

import { upsertUser } from '../../packages/api/src/routes/testing.js'
import { createTestApiDatabase } from '../helpers/api.js'

describe('upsertUser', () => {
  test('inserts a new user when email does not exist', async () => {
    const database = await createTestApiDatabase()

    const result = await upsertUser(database, {
      email: 'new@jfet.co.jp',
      name: 'New User',
      image: null
    })

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(result.email).toBe('new@jfet.co.jp')
    expect(result.name).toBe('New User')
    expect(result.image).toBeNull()
  })

  test('normalizes email casing and trims whitespace', async () => {
    const database = await createTestApiDatabase()

    const a = await upsertUser(database, {
      email: '  MixedCase@JFET.CO.JP  ',
      name: 'Mixed',
      image: null
    })
    const b = await upsertUser(database, {
      email: 'mixedcase@jfet.co.jp',
      name: 'Mixed Renamed',
      image: null
    })

    expect(b.id).toBe(a.id)
    expect(b.email).toBe('mixedcase@jfet.co.jp')
  })

  test('second call with the same email upserts onto the existing row (no UNIQUE violation)', async () => {
    const database = await createTestApiDatabase()

    const first = await upsertUser(database, {
      email: 'same@jfet.co.jp',
      name: 'First Name',
      image: 'https://example.com/first.png'
    })
    const second = await upsertUser(database, {
      email: 'same@jfet.co.jp',
      name: 'Second Name',
      image: null
    })

    // 同じ id を返す (caller の collaborator FK 整合のため)
    expect(second.id).toBe(first.id)
    // 最新の値で update されている
    expect(second.name).toBe('Second Name')
    expect(second.image).toBeNull()
  })

  test('parallel upserts with the same email do not throw and converge on a single user row', async () => {
    const database = await createTestApiDatabase()

    // 同一 email を 5 件並列に upsert (admin / dashboard 系 e2e の Promise.all
    // が再現する race window)。 onConflictDoUpdate なら全件成功して同 id に
    // 収束するはず、 旧実装 (SELECT → INSERT) では UNIQUE 違反で fail。
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        upsertUser(database, {
          email: 'parallel@jfet.co.jp',
          name: `Parallel ${i}`,
          image: null
        })
      )
    )

    const ids = new Set(results.map((u) => u.id))
    expect(ids.size).toBe(1)
  })

  test('preserves explicit id when provided and reuses it on subsequent upserts of the same email', async () => {
    const database = await createTestApiDatabase()

    const first = await upsertUser(database, {
      id: 'fixed-id-123',
      email: 'fixed@jfet.co.jp',
      name: 'Fixed',
      image: null
    })
    expect(first.id).toBe('fixed-id-123')

    // 次回は id を渡さなくても、 email で既存 row を見つけて同 id を返す。
    const second = await upsertUser(database, {
      email: 'fixed@jfet.co.jp',
      name: 'Fixed Renamed',
      image: null
    })
    expect(second.id).toBe('fixed-id-123')
  })
})
