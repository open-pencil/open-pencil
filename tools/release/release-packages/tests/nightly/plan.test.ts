import { describe, expect, test } from 'bun:test'

import { checkoutSources, planNightly, type NightlySources } from '#release/nightly/plan'

import { CommandError } from '@open-pencil/package-artifacts-tools'

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

describe('the published nightly', () => {
  const git = async () => MASTER
  const failing = (stderr: string) => async (args: string[]) => {
    throw new CommandError('gh failed', { command: 'gh', args, cwd: '/repo' }, 1, '', stderr, false)
  }

  test('is the commit the release manifest names, which publishing uploads last', async () => {
    const github = async () => JSON.stringify({ sourceCommit: 'c'.repeat(40), tag: 'nightly' })
    expect(await checkoutSources(git, github, 'open-pencil/open-pencil').lastNightly()).toBe(
      'c'.repeat(40)
    )
  })

  test.each(['release not found', 'no assets match the file pattern'])(
    'is none when GitHub answers %s',
    async (stderr) => {
      expect(
        await checkoutSources(git, failing(stderr), 'open-pencil/open-pencil').lastNightly()
      ).toBeUndefined()
    }
  )

  test('fails on any other answer rather than building again blindly', async () => {
    await expect(
      checkoutSources(git, failing('HTTP 502'), 'open-pencil/open-pencil').lastNightly()
    ).rejects.toThrow()
  })
})
