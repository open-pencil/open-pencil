import { describe, expect, test } from 'bun:test'

import { parseGitStatus } from '@/app/integrations/git/status'

/** Build a `-z` stream: git terminates every record with NUL, including the last. */
function stream(records: string[]): string {
  return `${records.join('\0')}\0`
}

describe('parseGitStatus', () => {
  test('reads the branch header and its ahead/behind counts', () => {
    const status = parseGitStatus(
      stream([
        '# branch.oid 6b6a9a1',
        '# branch.head main',
        '# branch.upstream origin/main',
        '# branch.ab +2 -1'
      ])
    )

    expect(status.branch).toEqual({
      head: 'main',
      oid: '6b6a9a1',
      upstream: 'origin/main',
      detached: false,
      ahead: 2,
      behind: 1
    })
    expect(status.entries).toEqual([])
  })

  test('reports a detached head without a branch name', () => {
    const status = parseGitStatus(
      stream(['# branch.oid 6b6a9a1', '# branch.head (detached)', '# branch.ab +0 -0'])
    )

    expect(status.branch.detached).toBe(true)
    expect(status.branch.head).toBeNull()
    expect(status.branch.upstream).toBeNull()
  })

  test('reports an unborn branch without an oid', () => {
    const status = parseGitStatus(stream(['# branch.oid (initial)', '# branch.head main']))

    expect(status.branch.oid).toBeNull()
    expect(status.branch.head).toBe('main')
    expect(status.branch.ahead).toBe(0)
  })

  test('reads changed, untracked, and ignored records', () => {
    const status = parseGitStatus(
      stream([
        '1 .M N... 100644 100644 100644 aaaa bbbb src/App.vue',
        '1 M. N... 100644 100644 100644 cccc dddd src/main.ts',
        '? src/new-file.ts',
        '! dist'
      ])
    )

    expect(status.entries).toEqual([
      { kind: 'changed', index: '.', worktree: 'M', path: 'src/App.vue' },
      { kind: 'changed', index: 'M', worktree: '.', path: 'src/main.ts' },
      { kind: 'untracked', index: '.', worktree: '.', path: 'src/new-file.ts' },
      { kind: 'ignored', index: '.', worktree: '.', path: 'dist' }
    ])
  })

  test('keeps the original path of a rename and consumes its record', () => {
    const status = parseGitStatus(
      stream([
        '2 R. N... 100644 100644 100644 aaaa bbbb R100 src/renamed.ts',
        'src/original.ts',
        '? after-rename.ts'
      ])
    )

    expect(status.entries).toEqual([
      {
        kind: 'renamed',
        index: 'R',
        worktree: '.',
        path: 'src/renamed.ts',
        originalPath: 'src/original.ts'
      },
      { kind: 'untracked', index: '.', worktree: '.', path: 'after-rename.ts' }
    ])
  })

  test('keeps the spaces of a path', () => {
    const status = parseGitStatus(
      stream(['? my file.txt', '1 .M N... 100644 100644 100644 a b design/my screen.pen'])
    )

    expect(status.entries.map((entry) => entry.path)).toEqual([
      'my file.txt',
      'design/my screen.pen'
    ])
  })

  test('reads a conflicted record', () => {
    const status = parseGitStatus(
      stream(['u UU N... 100644 100644 100644 100644 aaa bbb ccc docs/conflict.md'])
    )

    expect(status.entries).toEqual([
      { kind: 'unmerged', index: 'U', worktree: 'U', path: 'docs/conflict.md' }
    ])
  })

  test('skips a record kind it does not know', () => {
    const status = parseGitStatus(stream(['x something new from git', '? kept.ts']))

    expect(status.entries).toEqual([
      { kind: 'untracked', index: '.', worktree: '.', path: 'kept.ts' }
    ])
  })
})
