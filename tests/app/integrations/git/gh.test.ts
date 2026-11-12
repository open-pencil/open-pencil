import { expect, test } from 'bun:test'

import { createPullRequestViaGH, pullRequestArguments } from '@/app/integrations/git/gh'

const input = {
  repo: 'D:/site',
  base: 'main',
  head: 'dessn/pricing',
  title: 'Design changes from dessn/pricing',
  body: 'Opened from OpenPencil.'
}

test('the arguments name both branches and carry the text as one argument each', () => {
  expect(pullRequestArguments(input)).toEqual([
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    'dessn/pricing',
    '--title',
    'Design changes from dessn/pricing',
    '--body',
    'Opened from OpenPencil.'
  ])
})

test('the address gh prints is the address of the opened request', async () => {
  const transport = async (command: string, args?: Record<string, unknown>) => {
    expect(command).toBe('run_program')
    expect(args?.program).toBe('gh')
    expect(args?.cwd).toBe('D:/site')
    return { code: 0, stdout: 'https://github.com/acme/site/pull/12\n', stderr: '' }
  }
  expect(await createPullRequestViaGH(input, transport)).toBe(
    'https://github.com/acme/site/pull/12'
  )
})

test('a gh that refuses, is missing, or answers nonsense gives nothing to open', async () => {
  expect(
    await createPullRequestViaGH(input, async () => ({
      code: 1,
      stdout: '',
      stderr: 'not signed in'
    }))
  ).toBeNull()
  expect(
    await createPullRequestViaGH(input, async () => {
      throw new Error('the program is not installed')
    })
  ).toBeNull()
  expect(await createPullRequestViaGH(input, async () => 'not a report')).toBeNull()
  expect(
    await createPullRequestViaGH(input, async () => ({ code: 0, stdout: 'no link', stderr: '' }))
  ).toBeNull()
})
