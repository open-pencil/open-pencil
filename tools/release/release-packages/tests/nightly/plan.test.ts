import { expect, test } from 'bun:test'

import { planNightly, type NightlySources } from '#release/nightly/plan'

const MASTER = 'a'.repeat(40)
const NIGHT = new Date('2026-11-16T03:00:00Z')

function sources(overrides: Partial<NightlySources> = {}): NightlySources {
  return {
    master: async () => MASTER,
    lastNightly: async () => 'b'.repeat(40),
    lastVersion: async () => '0.17.0-nightly.20261115',
    masterVersion: async () => '0.17.0-beta.5',
    ...overrides
  }
}

test('builds master as the release it heads for, dated tonight', async () => {
  expect(await planNightly(sources(), NIGHT)).toEqual({
    source: MASTER,
    version: '0.17.0-nightly.20261116',
    skip: false
  })
})

test('builds the first nightly without a previous one', async () => {
  const first = sources({ lastNightly: async () => undefined, lastVersion: async () => undefined })
  expect(await planNightly(first, NIGHT)).toMatchObject({
    version: '0.17.0-nightly.20261116',
    skip: false
  })
})

test('skips a night when master is what the last nightly built', async () => {
  expect(await planNightly(sources({ lastNightly: async () => MASTER }), NIGHT)).toMatchObject({
    skip: true
  })
})

test('numbers a second build on the same day', async () => {
  const again = sources({ lastVersion: async () => '0.17.0-nightly.20261116' })
  expect((await planNightly(again, NIGHT)).version).toBe('0.17.0-nightly.20261116.2')
})

test('refuses a master that is not a commit', async () => {
  await expect(planNightly(sources({ master: async () => 'master' }), NIGHT)).rejects.toThrow()
})
