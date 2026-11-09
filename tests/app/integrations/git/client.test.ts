import { describe, expect, test } from 'bun:test'

import {
  commitFile,
  commitStaged,
  type GitRunReport,
  type GitTransport,
  listGitBranches,
  pullFastForward,
  readDefaultBranch,
  readFileDiff,
  readFileHistory,
  readFileState,
  readGitAvailability,
  readGitStatus,
  restoreFileFromCommit,
  runGit,
  stashChanges,
  switchBranch
} from '@/app/integrations/git'

type RecordedCall = { command: string; args: Record<string, unknown> | undefined }

/** A transport that records what it was asked and answers with one fixed value. */
function recorder(answer: unknown): { transport: GitTransport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const transport: GitTransport = async (command, args) => {
    calls.push({ command, args })
    return answer
  }
  return { transport, calls }
}

function report(overrides: Partial<GitRunReport> = {}): GitRunReport {
  return { code: 0, stdout: '', stderr: '', ...overrides }
}

describe('runGit', () => {
  test('sends the repository, the subcommand, and its arguments to the native gateway', async () => {
    const { transport, calls } = recorder(report())
    const outcome = await runGit('/repo', 'status', ['--porcelain=v2'], transport)

    expect(outcome.ok).toBe(true)
    expect(calls).toEqual([
      {
        command: 'git_run',
        args: { repo: '/repo', subcommand: 'status', args: ['--porcelain=v2'] }
      }
    ])
  })

  test('answers a failure with the first line of stderr when git exits non-zero', async () => {
    const { transport } = recorder(
      report({ code: 1, stderr: 'pre-commit: пересобери токены\nsecond line\n' })
    )
    const outcome = await runGit('/repo', 'commit', [], transport)

    expect(outcome).toEqual({
      ok: false,
      code: 1,
      stderr: 'pre-commit: пересобери токены\nsecond line\n',
      summary: 'pre-commit: пересобери токены'
    })
  })
})

describe('readGitAvailability', () => {
  test('reports a missing git instead of offering actions', async () => {
    const { transport } = recorder({ available: false, version: null, path: null })
    const outcome = await readGitAvailability(transport)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected a failure')
    expect(outcome.summary).toBe('git is not installed or not on PATH.')
  })
})

describe('readGitStatus', () => {
  test('asks for porcelain v2 with the branch header', async () => {
    const { transport, calls } = recorder(report({ stdout: '# branch.head main\0' }))
    await readGitStatus('/repo', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'status',
      args: ['--porcelain=v2', '--branch', '-z']
    })
  })
})

describe('listGitBranches', () => {
  test('marks the current branch and keeps the others', async () => {
    const { transport } = recorder(report({ stdout: '* main\n  feat/git-sync\n' }))
    const outcome = await listGitBranches('/repo', transport)

    expect(outcome).toEqual({
      ok: true,
      value: [
        { name: 'main', current: true },
        { name: 'feat/git-sync', current: false }
      ]
    })
  })
})

describe('commitStaged', () => {
  test('refuses an empty message without asking git', async () => {
    const { transport, calls } = recorder(report())
    const outcome = await commitStaged('/repo', '   ', transport)

    expect(outcome.ok).toBe(false)
    expect(calls).toEqual([])
  })

  test('passes the message as its own argument so it is never re-parsed', async () => {
    const { transport, calls } = recorder(report())
    await commitStaged('/repo', 'feat: panels', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'commit',
      args: ['-m', 'feat: panels']
    })
  })
})

describe('switchBranch', () => {
  test('creates the branch when asked', async () => {
    const { transport, calls } = recorder(report())
    await switchBranch('/repo', 'feat/git-sync', true, transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'switch',
      args: ['-c', 'feat/git-sync']
    })
  })

  test('switches to an existing branch without creating it', async () => {
    const { transport, calls } = recorder(report())
    await switchBranch('/repo', 'main', false, transport)

    expect(calls[0]?.args).toEqual({ repo: '/repo', subcommand: 'switch', args: ['main'] })
  })
})

describe('pullFastForward', () => {
  test('only takes what can fast-forward', async () => {
    const { transport, calls } = recorder(report())
    await pullFastForward('/repo', transport)

    expect(calls[0]?.args).toEqual({ repo: '/repo', subcommand: 'pull', args: ['--ff-only'] })
  })
})

describe('stashChanges', () => {
  test('parks tracked and untracked changes', async () => {
    const { transport, calls } = recorder(report())
    await stashChanges('/repo', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'stash',
      args: ['push', '--include-untracked']
    })
  })
})

describe('readFileDiff', () => {
  test('asks for one file against the last commit, with the path kept apart', async () => {
    const { transport, calls } = recorder(report({ stdout: 'diff --git a/a.ts b/a.ts' }))
    const outcome = await readFileDiff('/repo', 'src/a.ts', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'diff',
      args: ['HEAD', '--no-color', '--', 'src/a.ts']
    })
    expect(outcome).toEqual({ ok: true, value: 'diff --git a/a.ts b/a.ts' })
  })

  test('reports a diff git refused with its own message', async () => {
    const { transport } = recorder(report({ code: 128, stderr: 'fatal: bad revision HEAD' }))
    const outcome = await readFileDiff('/repo', 'src/a.ts', transport)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected a failure')
    expect(outcome.summary).toBe('fatal: bad revision HEAD')
  })
})

describe('readFileState', () => {
  test('asks about one path alone and reads the letters git answers', async () => {
    const { transport, calls } = recorder(report({ stdout: ' M design/catalog.fig\0' }))
    const outcome = await readFileState('/repo', 'design/catalog.fig', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'status',
      args: ['--porcelain=v1', '-z', '--', 'design/catalog.fig']
    })
    expect(outcome).toEqual({ ok: true, value: 'modified' })
  })
})

describe('readFileHistory', () => {
  const commit = ['d'.repeat(40), 'Ada', '2026-01-02T03:04:05+03:00', 'feat: catalog'].join(
    '\u001f'
  )

  test('asks for the commits that touched the file, newest first', async () => {
    const { transport, calls } = recorder(report({ stdout: `${commit}\n` }))
    const outcome = await readFileHistory('/repo', 'design/catalog.fig', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'log',
      args: ['--format=%H%x1f%an%x1f%aI%x1f%s', '--max-count=30', '--', 'design/catalog.fig']
    })
    expect(outcome).toEqual({
      ok: true,
      value: [
        {
          hash: 'd'.repeat(40),
          author: 'Ada',
          date: '2026-01-02T03:04:05+03:00',
          subject: 'feat: catalog'
        }
      ]
    })
  })

  test('a repository with no commits yet has no history rather than a failure', async () => {
    const { transport } = recorder(
      report({
        code: 128,
        stderr: "fatal: your current branch 'main' does not have any commits yet"
      })
    )

    expect(await readFileHistory('/repo', 'design/catalog.fig', transport)).toEqual({
      ok: true,
      value: []
    })
  })
})

describe('commitFile', () => {
  test('stages the path and commits only it, so other staged work stays where it is', async () => {
    const { transport, calls } = recorder(report())
    await commitFile('/repo', 'design/catalog.fig', 'feat: catalog', transport)

    expect(calls.map((call) => (call.args as { args: string[] }).args)).toEqual([
      ['--', 'design/catalog.fig'],
      ['-m', 'feat: catalog', '--', 'design/catalog.fig']
    ])
  })

  test('refuses an empty message without asking git', async () => {
    const { transport, calls } = recorder(report())
    const outcome = await commitFile('/repo', 'design/catalog.fig', '   ', transport)

    expect(outcome.ok).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('restoreFileFromCommit', () => {
  test('puts the file back as that commit had it, in the worktree', async () => {
    const { transport, calls } = recorder(report())
    await restoreFileFromCommit('/repo', 'design/catalog.fig', 'a1b2c3d', transport)

    expect(calls[0]?.args).toEqual({
      repo: '/repo',
      subcommand: 'checkout',
      args: ['a1b2c3d', '--', 'design/catalog.fig']
    })
  })

  test('refuses a name that is not a hash', async () => {
    const { transport, calls } = recorder(report())
    const outcome = await restoreFileFromCommit('/repo', 'design/catalog.fig', 'main', transport)

    expect(outcome.ok).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('readDefaultBranch', () => {
  test('reads the branch the remote checks out by default', async () => {
    const { transport, calls } = recorder(report({ stdout: 'origin/master\n' }))
    const outcome = await readDefaultBranch('/repo', 'origin', transport)

    expect(outcome).toEqual({ ok: true, value: 'master' })
    expect(calls).toEqual([
      {
        command: 'git_run',
        args: { repo: '/repo', subcommand: 'rev-parse', args: ['--abbrev-ref', 'origin/HEAD'] }
      }
    ])
  })

  test('a remote without a recorded HEAD answers null rather than its own name', async () => {
    const recorded = recorder(report({ stdout: 'origin/HEAD\n' }))
    const absent = recorder(report({ code: 128, stderr: 'fatal: ambiguous argument' }))

    expect(await readDefaultBranch('/repo', 'origin', recorded.transport)).toEqual({
      ok: true,
      value: null
    })
    expect(await readDefaultBranch('/repo', 'origin', absent.transport)).toEqual({
      ok: true,
      value: null
    })
  })
})
