import { expect, test } from 'bun:test'

import type { ProjectDetection } from '@/app/projects/detect'
import type { ProjectImportIo } from '@/app/projects/import'
import { createProject } from '@/app/projects/schema'
import { useProjectImport } from '@/app/projects/use'

const karbid = createProject({ repository: 'D:/Karbid2' })
if (karbid === null) throw new Error('the fixture repository must make a project')

function picker(
  chooseFolder: () => Promise<string | null>,
  detect: () => Promise<ProjectDetection>
): ProjectImportIo {
  return { chooseFolder, detect }
}

test('an added project joins the list', async () => {
  const importation = useProjectImport(
    picker(
      async () => 'D:/Karbid2',
      async () => ({ kind: 'detected', project: karbid })
    )
  )

  await importation.add('Add project')

  expect(importation.projects.value.map((project) => project.repository)).toEqual(['D:/Karbid2'])
  expect(importation.failure.value).toBeNull()
})

test('the same repository added twice is one project', async () => {
  const importation = useProjectImport(
    picker(
      async () => 'D:/Karbid2',
      async () => ({ kind: 'detected', project: karbid })
    )
  )

  await importation.add('Add project')
  await importation.add('Add project')

  expect(importation.projects.value).toHaveLength(1)
})

test('a folder outside a repository leaves the list alone and says why', async () => {
  const importation = useProjectImport(
    picker(
      async () => 'C:/Downloads',
      async () => ({ kind: 'not-repository' })
    )
  )

  await importation.add('Add project')

  expect(importation.projects.value).toEqual([])
  expect(importation.failure.value).toEqual({ kind: 'notRepository' })
})

test('cancelling changes neither the list nor the last failure', async () => {
  const importation = useProjectImport(
    picker(
      async () => null,
      async () => ({ kind: 'not-repository' })
    )
  )

  await importation.add('Add project')

  expect(importation.projects.value).toEqual([])
  expect(importation.failure.value).toBeNull()
})

test('a second add while one is running is ignored', async () => {
  let finish: (folder: string | null) => void = () => undefined
  const folders = new Promise<string | null>((resolve) => {
    finish = resolve
  })
  const importation = useProjectImport(
    picker(
      () => folders,
      async () => ({ kind: 'not-repository' })
    )
  )

  const first = importation.add('Add project')
  expect(importation.busy.value).toBe(true)
  expect(await importation.add('Add project')).toBeNull()

  finish(null)
  await first
  expect(importation.busy.value).toBe(false)
})

test('removing a project leaves the rest of the list', async () => {
  const importation = useProjectImport(
    picker(
      async () => 'D:/Karbid2',
      async () => ({ kind: 'detected', project: karbid })
    )
  )

  await importation.add('Add project')
  importation.remove(karbid.id)

  expect(importation.projects.value).toEqual([])
})
