import { expect, test } from 'bun:test'

import {
  addProject,
  configureProject,
  parseProjects,
  removeProject,
  renameProject,
  storedProjects,
  unreadableProjects
} from '@/app/projects/list'
import { createProject } from '@/app/projects/schema'

const karbid = createProject({ repository: 'D:/Karbid2' })
const other = createProject({ repository: 'D:/Other' })

test('a broken record is dropped instead of taking the list down', () => {
  const parsed = parseProjects([
    {
      id: 'p1',
      name: 'Karbid',
      repository: 'D:/Karbid2',
      appDirectory: '',
      startCommand: '',
      startUrl: ''
    },
    { id: '', name: 'broken' },
    'not a project',
    null
  ])

  expect(parsed).toHaveLength(1)
  expect(parsed[0]?.name).toBe('Karbid')
})

test('storage holding something other than a list reads as no projects', () => {
  expect(parseProjects(undefined)).toEqual([])
  expect(parseProjects('[]')).toEqual([])
  expect(parseProjects({})).toEqual([])
})

test('adding the same repository twice keeps one project', () => {
  if (!karbid) throw new Error('expected a project')
  const once = addProject([], karbid)
  const twice = addProject(once, { ...karbid, name: 'Renamed later' })

  expect(twice).toHaveLength(1)
  expect(twice[0]?.name).toBe('Renamed later')
})

test('a second repository is appended', () => {
  if (!karbid || !other) throw new Error('expected projects')
  expect(addProject([karbid], other)).toEqual([karbid, other])
})

test('removing a project leaves the others', () => {
  if (!karbid || !other) throw new Error('expected projects')
  expect(removeProject([karbid, other], karbid.id)).toEqual([other])
})

test('an empty rename changes nothing', () => {
  if (!karbid) throw new Error('expected a project')
  expect(renameProject([karbid], karbid.id, '   ')).toEqual([karbid])
  expect(renameProject([karbid], karbid.id, '  Karbid DS ')[0]?.name).toBe('Karbid DS')
})

test('configuring a project keeps its id and replaces only what changed', () => {
  if (!karbid) throw new Error('expected a project')
  const configured = configureProject([karbid], karbid.id, {
    appDirectory: 'code/packages/showcase',
    startCommand: 'pnpm dev'
  })

  expect(configured[0]?.id).toBe(karbid.id)
  expect(configured[0]?.startCommand).toBe('pnpm dev')
  expect(configured[0]?.startUrl).toBe('')
})
test('a record this build cannot read is written back with the rest', () => {
  if (!karbid) throw new Error('expected a project')
  const unreadable = { id: 'p9', name: 'from a later build', repository: 'D:/Newer', extra: 1 }
  const stored = [karbid, { id: '', name: 'broken' }, unreadable]

  const written = storedProjects([{ ...karbid, name: 'Renamed' }], stored)

  expect(written).toHaveLength(3)
  expect(written[0]).toMatchObject({ name: 'Renamed' })
  expect(written).toContain(unreadable)
})

test('only the records that do not parse are kept', () => {
  if (!karbid) throw new Error('expected a project')
  const hand = { id: '', name: 'broken' }

  expect(unreadableProjects([karbid, hand])).toEqual([hand])
  expect(unreadableProjects('not a list')).toEqual([])
})
