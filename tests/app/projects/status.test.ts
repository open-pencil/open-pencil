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
  let markStarted: () => void = () => undefined
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  let finish: (value: unknown) => void = () => undefined
  const answer = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  const transport: GitTransport = async (_command, args) => {
    const payload = args as { repo: string }
    if (payload.repo !== karbid.repository) {
      return new Promise<never>(() => {
        // The new list's read never answers, so only the dropped read could write.
      })
    }
    markStarted()
    return answer
  }

  const list = ref<Project[]>([karbid])
  const statuses = useProjectStatuses(list, transport)
  await started
  list.value = [pencil]
  finish({ code: 0, stdout: KARBID_STATUS, stderr: '' })
  await new Promise((resolve) => {
    setTimeout(resolve, 10)
  })

  expect(statuses.statuses.value).toEqual({})
})

test('a detached or unborn branch still reports its changes', () => {
  const status = {
    branch: { head: null, oid: null, upstream: null, detached: true, ahead: 0, behind: 0 },
    entries: [{ kind: 'changed' as const, index: '.', worktree: 'M', path: 'src/a.ts' }]
  }

  expect(summarizeGitStatus(status)).toEqual({ branch: null, changed: 1 })
})
