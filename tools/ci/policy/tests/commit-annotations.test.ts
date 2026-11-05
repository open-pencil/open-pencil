import { expect, test } from 'bun:test'

import { commitAnnotations } from '#ci/commit-annotations'

const problem = (message: string) => ({ level: 2 as const, name: 'type-empty', message })

test('annotates each rejected message by its first line and its problems', () => {
  const report = {
    results: [
      { input: 'fix: fine', errors: [] },
      { input: 'bad title\n\nbody', errors: [problem('type may not be empty'), problem('x')] }
    ]
  }
  expect(commitAnnotations(report, false)).toEqual([
    '::error title=Commit messages::bad title: type may not be empty; x. See CONTRIBUTING.md#commit-messages.'
  ])
  expect(commitAnnotations(report, true)[0]).toStartWith('::error title=PR title::')
})

test('escapes what would end or corrupt the workflow command', () => {
  const report = { results: [{ input: '100% done', errors: [problem('a\nb')] }] }
  expect(commitAnnotations(report, false)[0]).toContain('100%25 done: a%0Ab.')
})
