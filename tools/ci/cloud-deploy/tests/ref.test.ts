import { describe, expect, test } from 'bun:test'

import { isOnMaster, refusal } from '#cloud-deploy/ref'

describe('refusal', () => {
  test.each([
    ['staging', 'refs/heads/master'],
    ['staging', 'refs/tags/v0.17.0'],
    ['production', 'refs/tags/v0.17.0'],
    ['production', 'refs/tags/v1.0.0-beta.2']
  ])('lets %s deploy %s', (target, ref) => {
    expect(refusal(target, ref)).toBeUndefined()
  })

  test.each([
    ['staging', 'refs/heads/feat/cloud-trash'],
    ['staging', 'refs/pull/1935/merge'],
    ['production', 'refs/heads/master'],
    ['production', 'refs/tags/nightly'],
    ['production', 'refs/tags/v0.17'],
    ['production', 'refs/tags/v0.16.0-qashier.1'],
    ['preview', 'refs/heads/master']
  ])('stops %s deploying %s', (target, ref) => {
    expect(refusal(target, ref)).toBeString()
  })
})

describe('isOnMaster', () => {
  test('asks git whether master holds the checked-out commit', async () => {
    const asked: string[][] = []
    expect(
      await isOnMaster('/repo', async (request) => {
        asked.push([request.cwd, request.command, ...(request.args ?? [])])
        return { stdout: '', stderr: '' }
      })
    ).toBe(true)
    expect(asked).toEqual([
      ['/repo', 'git', 'merge-base', '--is-ancestor', 'HEAD', 'origin/master']
    ])
  })

  test('is false when git says it is not', async () => {
    expect(
      await isOnMaster('/repo', async () => {
        throw new Error('exit 1')
      })
    ).toBe(false)
  })
})
