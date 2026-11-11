import { expect, test } from 'bun:test'

import { ref } from 'vue'

import type { GitTransport } from '@/app/integrations/git'
import { createProject, type Project } from '@/app/projects/schema'
import { summarizeGitStatus, useProjectStatuses } from '@/app/projects/status'

function project(repository: string): Project {
  const created = createProject({ repository })
  if (created === null) throw new Error(`the fixture ${repository} must make a project`)
  return created
}

const karbid = project('D:/Karbid2')
const pencil = project('D:/OpenPencilDev-src')

/** A gateway that answers a status per repository and refuses the ones it was not given. */
function gateway(answers: Record<string, string>): GitTransport {
  return async (_command, args) => {
    const payload = args as { repo: string }
    const stdout = answers[payload.repo]
    if (stdout === undefined) {
      return { code: 128, stdout: '', stderr: 'fatal: not a git repository' }
    }
    return { code: 0, stdout, stderr: '' }
  }
}

const KARBID_STATUS = '# branch.head main\0'
const PENCIL_STATUS = '# branch.head feat/git-sync\0? a.ts\0? b.ts\0'

test('reads a branch and a change count for every listed project', async () => {
  const statuses = useProjectStatuses(
    ref([karbid, pencil]),
    gateway({ [karbid.repository]: KARBID_STATUS, [pencil.repository]: PENCIL_STATUS })
  )

  await statuses.refresh()

  expect(statuses.statuses.value).toEqual({
    [karbid.id]: { branch: 'main', changed: 0 },
    [pencil.id]: { branch: 'feat/git-sync', changed: 2 }
  })
})

test('a repository git cannot read leaves the others in the list', async () => {
  const statuses = useProjectStatuses(
    ref([karbid, pencil]),
    gateway({ [karbid.repository]: KARBID_STATUS })
  )

  await statuses.refresh()

  expect(statuses.statuses.value).toEqual({ [karbid.id]: { branch: 'main', changed: 0 } })
})

test('a project added after the first read is read too', async () => {
  const list = ref<Project[]>([karbid])
  const statuses = useProjectStatuses(
    list,
    gateway({ [karbid.repository]: KARBID_STATUS, [pencil.repository]: PENCIL_STATUS })
  )
  await statuses.refresh()

  list.value = [karbid, pencil]
  await statuses.refresh()

  expect(Object.keys(statuses.statuses.value).sort()).toEqual([karbid.id, pencil.id].sort())
})

test('statuses read for a list that changed meanwhile are dropped', async () => {
  // The read for the repository the list starts with is held open, so the list can change while
  // that read is really in flight.
  let markFirst: () => void = () => undefined
  const firstStarted = new Promise<void>((resolve) => {
    markFirst = resolve
  })
  let finish: (value: unknown) => void = () => undefined
  const answer = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  // The read that follows starts at once and then waits, so the panel can be looked at between the
  // two reads: no timer is involved, and a slow machine cannot look before the answer arrived.
  let markSecond: () => void = () => undefined
  const secondStarted = new Promise<void>((resolve) => {
    markSecond = resolve
  })
  let releaseSecond: () => void = () => undefined
  const secondAnswer = new Promise<void>((resolve) => {
    releaseSecond = resolve
  })
  const transport: GitTransport = async (_command, args) => {
    const payload = args as { repo: string }
    if (payload.repo === karbid.repository) {
      markFirst()
      return answer
    }
    markSecond()
    await secondAnswer
    return { code: 0, stdout: PENCIL_STATUS, stderr: '' }
  }

  const list = ref<Project[]>([karbid])
  const statuses = useProjectStatuses(list, transport)
  await firstStarted
  list.value = [pencil]
  finish({ code: 0, stdout: KARBID_STATUS, stderr: '' })
  // Reads run one after another, so the next one starting means the dropped read has landed.
  await secondStarted

  expect(statuses.statuses.value).toEqual({})

  releaseSecond()
  await statuses.refresh()

  expect(statuses.statuses.value).toEqual({
    [pencil.id]: { branch: 'feat/git-sync', changed: 2 }
  })
})

test('a record that points at another repository keeps no status from the old one', async () => {
  let markFirst: () => void = () => undefined
  const firstStarted = new Promise<void>((resolve) => {
    markFirst = resolve
  })
  let finish: (value: unknown) => void = () => undefined
  const answer = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  let markSecond: () => void = () => undefined
  const secondStarted = new Promise<void>((resolve) => {
    markSecond = resolve
  })
  let releaseSecond: () => void = () => undefined
  const secondAnswer = new Promise<void>((resolve) => {
    releaseSecond = resolve
  })
  const transport: GitTransport = async (_command, args) => {
    const payload = args as { repo: string }
    if (payload.repo === karbid.repository) {
      markFirst()
      return answer
    }
    markSecond()
    await secondAnswer
    return { code: 0, stdout: PENCIL_STATUS, stderr: '' }
  }

  // The id is kept while the repository changes, which is what a record edited by hand looks like.
  const moved: Project = { ...karbid, repository: 'D:/Elsewhere' }
  const list = ref<Project[]>([karbid])
  const statuses = useProjectStatuses(list, transport)
  await firstStarted
  list.value = [moved]
  finish({ code: 0, stdout: KARBID_STATUS, stderr: '' })
  await secondStarted

  // The status read for `D:/Karbid2` belongs to a record that no longer points there.
  expect(statuses.statuses.value).toEqual({})

  releaseSecond()
  await statuses.refresh()

  expect(statuses.statuses.value).toEqual({
    [karbid.id]: { branch: 'feat/git-sync', changed: 2 }
  })
})

test('a detached or unborn branch still reports its changes', () => {
  const status = {
    branch: { head: null, oid: null, upstream: null, detached: true, ahead: 0, behind: 0 },
    entries: [{ kind: 'changed' as const, index: '.', worktree: 'M', path: 'src/a.ts' }]
  }

  expect(summarizeGitStatus(status)).toEqual({ branch: null, changed: 1 })
})
