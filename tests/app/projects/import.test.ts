import { expect, test } from 'bun:test'

import type { ProjectDetection } from '@/app/projects/detect'
import { importProject, type ProjectImportIo } from '@/app/projects/import'
import { createProject } from '@/app/projects/schema'

const karbid = createProject({ repository: 'D:/Karbid2' })
if (karbid === null) throw new Error('the fixture repository must make a project')

function picker(picked: string | null, detection: ProjectDetection): ProjectImportIo {
  return { chooseFolder: async () => picked, detect: async () => detection }
}

test('a picked repository becomes the project', async () => {
  const outcome = await importProject(
    picker('D:/Karbid2', { kind: 'detected', project: karbid }),
    'Add project'
  )

  expect(outcome).toEqual({ kind: 'added', project: karbid })
})

test('the dialog is titled with the action the person chose', async () => {
  const titles: string[] = []
  const io: ProjectImportIo = {
    chooseFolder: async (title) => {
      titles.push(title)
      return null
    },
    detect: async () => ({ kind: 'not-repository' })
  }

  await importProject(io, 'Add project')

  expect(titles).toEqual(['Add project'])
})

test('cancelling the dialog adds nothing', async () => {
  const outcome = await importProject(picker(null, { kind: 'not-repository' }), 'Add project')

  expect(outcome).toEqual({ kind: 'cancelled' })
})

test('a folder outside a repository is reported as such', async () => {
  const outcome = await importProject(picker('C:/Downloads', { kind: 'not-repository' }), 'Add')

  expect(outcome).toEqual({ kind: 'notRepository' })
})

test('git that cannot be asked is reported apart from a folder outside a repository', async () => {
  const outcome = await importProject(picker('D:/app', { kind: 'unavailable' }), 'Add')

  expect(outcome).toEqual({ kind: 'unavailable' })
})

test('a picker that fails reports its own reason', async () => {
  const io: ProjectImportIo = {
    chooseFolder: async () => {
      throw new Error('the dialog is unavailable')
    },
    detect: async () => ({ kind: 'not-repository' })
  }

  expect(await importProject(io, 'Add project')).toEqual({
    kind: 'failed',
    reason: 'the dialog is unavailable'
  })
})
