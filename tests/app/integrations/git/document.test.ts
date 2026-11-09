import { expect, test } from 'bun:test'

import type { GitTransport } from '@/app/integrations/git'
import { useDocumentGit, type VersionedDocument } from '@/app/integrations/git/document'

const ROOT = 'D:/Karbid2'
const FILE = 'D:/Karbid2/design/catalog.fig'
const INSIDE = 'design/catalog.fig'

const STATUS = [
  '# branch.oid 6b6a9a1',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +1 -0',
  `1 .M N... 100644 100644 100644 6b6a9a1 6b6a9a1 ${INSIDE}`,
  '1 .M N... 100644 100644 100644 6b6a9a1 6b6a9a1 src/other.ts',
  ''
].join('\0')

const BRANCHES = '* main\n  feat/git-sync\n'

const COMMIT = ['e'.repeat(40), 'Ada', '2026-01-02T03:04:05+03:00', 'feat: catalog'].join('\u001f')

type Call = { command: string; repo?: string; subcommand?: string; args?: string[] }

type Answers = {
  /** What `git_repository_root` answers; null means the file is outside every repository. */
  root?: string | null
  /** The porcelain v2 status of the whole repository. */
  status?: string
  /** The porcelain v1 status of the file alone. */
  fileState?: string
  branches?: string
  log?: string
  commitCode?: number
  commitStderr?: string
}

/** A gateway that records what the tab asked and answers from one set of values. */
function gateway(answers: Answers = {}): { transport: GitTransport; calls: Call[] } {
  const calls: Call[] = []
  const transport: GitTransport = async (command, args) => {
    if (command === 'git_repository_root') {
      calls.push({ command })
      return answers.root === undefined ? ROOT : answers.root
    }
    const payload = args as { repo: string; subcommand: string; args?: string[] }
    calls.push({ command, repo: payload.repo, subcommand: payload.subcommand, args: payload.args })
    if (payload.subcommand === 'status') {
      const alone = payload.args?.includes('--porcelain=v1') ?? false
      return {
        code: 0,
        stdout: alone ? (answers.fileState ?? '') : (answers.status ?? ''),
        stderr: ''
      }
    }
    if (payload.subcommand === 'branch') {
      return { code: 0, stdout: answers.branches ?? BRANCHES, stderr: '' }
    }
    if (payload.subcommand === 'log') {
      return { code: 0, stdout: answers.log ?? '', stderr: '' }
    }
    if (payload.subcommand === 'commit') {
      return { code: answers.commitCode ?? 0, stdout: '', stderr: answers.commitStderr ?? '' }
    }
    return { code: 0, stdout: '', stderr: '' }
  }
  return { transport, calls }
}

type DocumentOptions = {
  /** What the document saves to; undefined keeps the usual file. */
  path?: string | null
  unsaved?: boolean
  /** Whether saving the document writes its file. */
  saves?: boolean
}

/** A document that reports its file and records what git asked of it. */
function versionedDocument(options: DocumentOptions = {}) {
  const events: string[] = []
  const document: VersionedDocument = {
    getDocumentFilePath: () => (options.path === undefined ? FILE : options.path),
    hasUnsavedChanges: () => options.unsaved ?? false,
    saveFigFile: async () => {
      events.push('save')
      return options.saves ?? true
    },
    reloadDocumentFromDisk: () => {
      events.push('reload')
    }
  }
  return { document, events }
}

test('a document that was never saved has no file for git to version', async () => {
  const { document } = versionedDocument({ path: null })
  const { transport, calls } = gateway()
  const git = useDocumentGit(document, transport)

  await git.refresh()

  expect(git.versioned.value).toBe(false)
  expect(git.canCommit.value).toBe(false)
  expect(calls).toEqual([])
})

test('a file outside every repository is not versioned either', async () => {
  const { document } = versionedDocument()
  const { transport } = gateway({ root: null })
  const git = useDocumentGit(document, transport)

  await git.refresh()

  expect(git.versioned.value).toBe(false)
  expect(git.branch.value).toBeNull()
})

test('reads the branch and how the file itself stands, apart from the rest of the tree', async () => {
  const { document } = versionedDocument()
  const { transport, calls } = gateway({ status: STATUS, fileState: ' M design/catalog.fig\0' })
  const git = useDocumentGit(document, transport)

  await git.refresh()

  expect(git.versioned.value).toBe(true)
  expect(git.branch.value?.head).toBe('main')
  expect(git.state.value).toBe('modified')
  expect(git.others.value).toBe(1)
  expect(git.branches.value).toEqual([
    { name: 'main', current: true },
    { name: 'feat/git-sync', current: false }
  ])
  expect(calls.every((call) => call.repo === undefined || call.repo === ROOT)).toBe(true)
})

test('a clean file cannot be committed even with a message typed', async () => {
  const { document } = versionedDocument()
  const { transport } = gateway({ status: STATUS, fileState: '' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  git.commitMessage.value = 'feat: catalog'

  expect(git.state.value).toBe('clean')
  expect(git.canCommit.value).toBe(false)
})

test('committing saves the document first, then commits only its file', async () => {
  const { document, events } = versionedDocument({ unsaved: true })
  const { transport, calls } = gateway({ status: STATUS, fileState: ' M design/catalog.fig\0' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  git.commitMessage.value = 'feat: catalog'
  await git.commit()

  expect(events).toEqual(['save'])
  expect(calls.filter((call) => call.subcommand === 'add').map((call) => call.args)).toEqual([
    ['--', INSIDE]
  ])
  expect(calls.filter((call) => call.subcommand === 'commit').map((call) => call.args)).toEqual([
    ['-m', 'feat: catalog', '--', INSIDE]
  ])
  expect(git.commitMessage.value).toBe('')
})

test('a document that could not be saved commits nothing', async () => {
  const { document } = versionedDocument({ unsaved: true, saves: false })
  const { transport, calls } = gateway({ status: STATUS, fileState: ' M design/catalog.fig\0' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  git.commitMessage.value = 'feat: catalog'
  await git.commit()

  expect(calls.filter((call) => call.subcommand === 'commit')).toEqual([])
  expect(git.commitMessage.value).toBe('feat: catalog')
})

test('a commit git refused keeps its message and reports what git said', async () => {
  const { document } = versionedDocument()
  const { transport } = gateway({
    status: STATUS,
    fileState: ' M design/catalog.fig\0',
    commitCode: 1,
    commitStderr: 'pre-commit: rebuild the tokens'
  })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  git.commitMessage.value = 'feat: catalog'
  await git.commit()

  expect(git.failure.value?.summary).toBe('pre-commit: rebuild the tokens')
  expect(git.commitMessage.value).toBe('feat: catalog')
})

test('syncing pulls the branch and shows the file as git left it', async () => {
  const { document, events } = versionedDocument()
  const { transport, calls } = gateway({ status: STATUS, fileState: ' M design/catalog.fig\0' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  await git.sync()

  expect(calls.some((call) => call.subcommand === 'pull')).toBe(true)
  expect(events).toContain('reload')
})

test('switching branch shows the document as that branch holds it', async () => {
  const { document, events } = versionedDocument()
  const { transport, calls } = gateway({ status: STATUS, fileState: '' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  await git.switchTo('feat/git-sync')

  expect(calls.find((call) => call.subcommand === 'switch')?.args).toEqual(['feat/git-sync'])
  expect(events).toContain('reload')
})

test('restoring a version replaces the file and reads the document again, edits or not', async () => {
  const { document, events } = versionedDocument({ unsaved: true })
  const { transport, calls } = gateway({ status: STATUS, fileState: ' M design/catalog.fig\0' })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  await git.restore('e'.repeat(40))

  expect(calls.find((call) => call.subcommand === 'checkout')?.args).toEqual([
    'e'.repeat(40),
    '--',
    INSIDE
  ])
  expect(events).toEqual(['reload'])
})

test('the history of the file is read on demand and kept', async () => {
  const { document } = versionedDocument()
  const { transport } = gateway({ status: STATUS, fileState: '', log: `${COMMIT}\n` })
  const git = useDocumentGit(document, transport)
  await git.refresh()

  expect(git.historyLoaded.value).toBe(false)
  await git.loadHistory()

  expect(git.historyLoaded.value).toBe(true)
  expect(git.history.value).toEqual([
    {
      hash: 'e'.repeat(40),
      author: 'Ada',
      date: '2026-01-02T03:04:05+03:00',
      subject: 'feat: catalog'
    }
  ])
})
