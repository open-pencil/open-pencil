import { expect, test } from 'bun:test'

import formatWithAnnotations, { commitAnnotations } from '#ci/commit-annotations'

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

test("adds the annotations to commitlint's report only in GitHub Actions", () => {
  const report = { results: [{ input: 'bad title', errors: [problem('type may not be empty')] }] }
  const saved = { actions: process.env.GITHUB_ACTIONS, title: process.env.COMMITLINT_PR_TITLE }
  try {
    process.env.COMMITLINT_PR_TITLE = '1'
    process.env.GITHUB_ACTIONS = 'true'
    const annotated = formatWithAnnotations(report, { color: false })
    expect(annotated).toContain('type may not be empty')
    expect(annotated).toContain('::error title=PR title::bad title: type may not be empty.')
    process.env.GITHUB_ACTIONS = 'false'
    expect(formatWithAnnotations(report, { color: false })).not.toContain('::error')
  } finally {
    if (saved.actions === undefined) delete process.env.GITHUB_ACTIONS
    else process.env.GITHUB_ACTIONS = saved.actions
    if (saved.title === undefined) delete process.env.COMMITLINT_PR_TITLE
    else process.env.COMMITLINT_PR_TITLE = saved.title
  }
})
