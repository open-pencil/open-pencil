import { expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import type { GitTransport } from '@/app/integrations/git'
import { useSourceControl } from '@/app/integrations/git/use'

type Call = { command: string; repo: string; subcommand: string }

const STATUS = [
  '# branch.oid 6b6a9a1',
  '# branch.head feat/git-sync',
  '# branch.upstream origin/feat/git-sync',
  '# branch.ab +2 -1',
  '1 .M N... 100644 100644 100644 6b6a9a1 6b6a9a1 src/app/a.ts',
  '? scratch/notes.md',
  ''
].join('\0')

const BRANCHES = '* feat/git-sync\n  main\n'

type Answers = {
  available?: boolean
  status?: string
  branches?: string
  diff?: string
  commitCode?: number
  commitStderr?: string
}

/** A gateway that records what the panel asked and answers from one set of values. */
function gateway(answers: Answers = {}): { transport: GitTransport; calls: Call[] } {
  const calls: Call[] = []
  const transport: GitTransport = async (command, args) => {
    if (command === 'git_version') {
      return {
        available: answers.available ?? true,
        version: 'git version 2.56.0',
        path: 'C:/Program Files/Git/bin/git.exe'
      }
    }
    const payload = args as { repo: string; subcommand: string }
    calls.push({ command, repo: payload.repo, subcommand: payload.subcommand })
    if (payload.subcommand === 'status') {
      return { code: 0, stdout: answers.status ?? '', stderr: '' }
    }
    if (payload.subcommand === 'branch') {
      return { code: 0, stdout: answers.branches ?? '', stderr: '' }
    }
    if (payload.subcommand === 'diff') {
      return { code: 0, stdout: answers.diff ?? '', stderr: '' }
    }
    if (payload.subcommand === 'commit') {
      return {
        code: answers.commitCode ?? 0,
        stdout: '',
        stderr: answers.commitStderr ?? ''
      }
    }
    return { code: 0, stdout: '', stderr: '' }
  }
  return { transport, calls }
}

test('reads the branch and changes of the repository its source names', async () => {
  const { transport, calls } = gateway({ status: STATUS, branches: BRANCHES })
  const control = useSourceControl(ref('D:/Karbid2'), transport)

  await control.refresh()

  expect(control.repository.value).toBe('D:/Karbid2')
  expect(control.status.value?.branch.head).toBe('feat/git-sync')
  expect(control.changedCount.value).toBe(2)
  expect(control.branches.value).toEqual([
    { name: 'feat/git-sync', current: true },
    { name: 'main', current: false }
  ])
  expect(calls.every((call) => call.repo === 'D:/Karbid2')).toBe(true)
})

test('follows a project switch instead of the repository it read first', async () => {
  const { transport, calls } = gateway({ status: STATUS })
  const repository = ref('D:/Karbid2')
  const control = useSourceControl(repository, transport)

  await control.refresh()
  repository.value = 'D:/OpenPencilDev-src'
  await control.refresh()

  expect(control.repository.value).toBe('D:/OpenPencilDev-src')
  expect(calls.at(-1)?.repo).toBe('D:/OpenPencilDev-src')
})

test('a read whose project changed meanwhile never lands in the panel', async () => {
  let markStarted: () => void = () => undefined
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  let finishStatus: (value: unknown) => void = () => undefined
  const statusAnswer = new Promise<unknown>((resolve) => {
    finishStatus = resolve
  })
  const transport: GitTransport = async (command, args) => {
    if (command === 'git_version')
      return { available: true, version: 'git version 2.56.0', path: 'git' }
    const payload = args as { subcommand: string }
    if (payload.subcommand !== 'status') return { code: 0, stdout: '', stderr: '' }
    markStarted()
    return statusAnswer
  }
  const repository = ref('D:/Karbid2')
  const control = useSourceControl(repository, transport)

  const reading = control.refresh()
  await started
  repository.value = 'D:/OpenPencilDev-src'
  finishStatus({ code: 0, stdout: STATUS, stderr: '' })
  await reading

  expect(control.status.value).toBeNull()
})

test('switching projects clears the status the previous one left', async () => {
  const { transport } = gateway({ status: STATUS, branches: BRANCHES })
  const repository = ref('D:/Karbid2')
  const control = useSourceControl(repository, transport)
  await control.refresh()
  expect(control.status.value).not.toBeNull()

  repository.value = 'D:/OpenPencilDev-src'
  await nextTick()

  expect(control.status.value).toBeNull()
  expect(control.branches.value).toEqual([])
})

test('a missing git leaves the panel without a status and with its reason', async () => {
  const { transport, calls } = gateway({ available: false })
  const control = useSourceControl(ref('D:/Karbid2'), transport)

  await control.refresh()

  expect(control.availability.value).toBeNull()
  expect(control.status.value).toBeNull()
  expect(control.failure.value?.summary).toBe('git is not installed or not on PATH.')
  expect(calls).toEqual([])
})

test('a repository nobody named asks git for nothing', async () => {
  const { transport, calls } = gateway()
  const control = useSourceControl(ref('   '), transport)

  await control.refresh()

  expect(calls).toEqual([])
  expect(control.status.value).toBeNull()
})

test('a commit stages everything, commits it, and reads the tree again', async () => {
  const { transport, calls } = gateway({ status: STATUS, branches: BRANCHES })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  control.commitMessage.value = 'feat: panels'

  expect(await control.commit()).toBe(true)

  expect(calls.map((call) => call.subcommand)).toEqual([
    'status',
    'branch',
    'remote',
    'add',
    'commit',
    'status',
    'branch',
    'remote'
  ])
  expect(control.commitMessage.value).toBe('')
})

test('a refused commit keeps the message and reports what the hook said', async () => {
  const { transport } = gateway({
    status: STATUS,
    commitCode: 1,
    commitStderr: 'pre-commit: rebuild the tokens\n'
  })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  control.commitMessage.value = 'chore: rebuild tokens'

  expect(await control.commit()).toBe(false)

  expect(control.failure.value?.summary).toBe('pre-commit: rebuild the tokens')
  expect(control.commitMessage.value).toBe('chore: rebuild tokens')
})

test('fetching asks the remote and reads the branch again', async () => {
  const { transport, calls } = gateway({ status: STATUS, branches: BRANCHES })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  calls.length = 0

  expect(await control.fetchBranches()).toBe(true)

  expect(calls.map((call) => call.subcommand)).toEqual(['fetch', 'status', 'branch', 'remote'])
})

test('pulling reads the tree again', async () => {
  const { transport, calls } = gateway({ status: STATUS, branches: BRANCHES })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  calls.length = 0

  expect(await control.pull()).toBe(true)

  expect(calls.map((call) => call.subcommand)).toEqual(['pull', 'status', 'branch', 'remote'])
})

test('stashing parks the changes and reads the clean tree', async () => {
  const { transport, calls } = gateway({ status: STATUS, branches: BRANCHES })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  calls.length = 0

  expect(await control.stash()).toBe(true)

  expect(calls.map((call) => call.subcommand)).toEqual(['stash', 'status', 'branch', 'remote'])
})

test('a pull git refuses is reported with its own words', async () => {
  const transport: GitTransport = async (command, args) => {
    if (command === 'git_version')
      return { available: true, version: 'git version 2.56.0', path: 'git' }
    const payload = args as { subcommand: string }
    if (payload.subcommand === 'pull') {
      return { code: 1, stdout: '', stderr: 'fatal: Not possible to fast-forward, aborting.' }
    }
    if (payload.subcommand === 'status') return { code: 0, stdout: STATUS, stderr: '' }
    return { code: 0, stdout: '', stderr: '' }
  }
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()

  expect(await control.pull()).toBe(false)

  expect(control.failure.value?.summary).toBe('fatal: Not possible to fast-forward, aborting.')
})

test('the panel reads the patch of the file it opens', async () => {
  const { transport } = gateway({ status: STATUS, diff: 'diff --git a/a.ts b/a.ts' })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()

  await control.showDiff({ kind: 'changed', index: '.', worktree: 'M', path: 'src/app/a.ts' })

  expect(control.diff.value).toEqual({
    path: 'src/app/a.ts',
    kind: 'changed',
    patch: 'diff --git a/a.ts b/a.ts',
    reading: false
  })
})

test('an untracked file has no patch to ask git for', async () => {
  const { transport, calls } = gateway({ status: STATUS })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  calls.length = 0

  await control.showDiff({
    kind: 'untracked',
    index: '.',
    worktree: '.',
    path: 'scratch/notes.md'
  })

  expect(calls).toEqual([])
  expect(control.diff.value).toEqual({
    path: 'scratch/notes.md',
    kind: 'untracked',
    patch: '',
    reading: false
  })
})

test('a patch that lands after the panel closed is dropped', async () => {
  let markStarted: () => void = () => undefined
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  let finish: (value: unknown) => void = () => undefined
  const answer = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  const transport: GitTransport = async (command, args) => {
    if (command === 'git_version')
      return { available: true, version: 'git version 2.56.0', path: 'git' }
    const payload = args as { subcommand: string }
    if (payload.subcommand === 'status') return { code: 0, stdout: STATUS, stderr: '' }
    if (payload.subcommand === 'diff') {
      markStarted()
      return answer
    }
    return { code: 0, stdout: '', stderr: '' }
  }
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()

  const reading = control.showDiff({ kind: 'changed', index: '.', worktree: 'M', path: 'a.ts' })
  await started
  control.closeDiff()
  finish({ code: 0, stdout: 'late patch', stderr: '' })
  await reading

  expect(control.diff.value).toBeNull()
})

test('a refresh closes the patch it was read from', async () => {
  const { transport } = gateway({ status: STATUS, branches: BRANCHES, diff: 'diff' })
  const control = useSourceControl(ref('D:/Karbid2'), transport)
  await control.refresh()
  await control.showDiff({ kind: 'changed', index: '.', worktree: 'M', path: 'a.ts' })

  await control.refresh()

  expect(control.diff.value).toBeNull()
})
