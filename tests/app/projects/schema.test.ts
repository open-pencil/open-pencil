import { expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  createProject,
  folderName,
  normalizePath,
  projectSchema,
  projectIdFor
} from '@/app/projects/schema'

test('a Windows path keeps forward slashes and loses its trailing separator', () => {
  expect(normalizePath('D:\\Karbid2\\')).toBe('D:/Karbid2')
  expect(normalizePath('  D:/Karbid2//  ')).toBe('D:/Karbid2')
})

test('two spellings of one folder compare equal', () => {
  expect(normalizePath('D:\\Karbid2')).toBe(normalizePath('D:/Karbid2/'))
  expect(projectIdFor('D:\\Karbid2')).toBe(projectIdFor('d:/karbid2/'))
})

test('two repositories whose old digests met still get their own id', () => {
  // Both paths fold to 3701632494, which the 32-bit digest this id started with answered for
  // either of them: the second project would replace the first one in the list.
  expect(projectIdFor('D:/repos/gg59ka0pfs')).not.toBe(projectIdFor('D:/repos/q30ca6bmyk'))
})

test('a project takes the repository folder name until it is renamed', () => {
  expect(folderName('D:/Karbid2')).toBe('Karbid2')
  expect(createProject({ repository: 'D:/Karbid2' })?.name).toBe('Karbid2')
  expect(createProject({ repository: 'D:/Karbid2', name: '  ' })?.name).toBe('Karbid2')
  expect(createProject({ repository: 'D:/Karbid2', name: 'Karbid DS' })?.name).toBe('Karbid DS')
})

test('an application directory never escapes the repository', () => {
  expect(
    createProject({ repository: 'D:/Karbid2', appDirectory: '/code/packages/showcase' })
      ?.appDirectory
  ).toBe('code/packages/showcase')
  expect(createProject({ repository: 'D:/Karbid2' })?.appDirectory).toBe('')
})

test('a draft without a repository makes no project', () => {
  expect(createProject({ repository: '' })).toBeNull()
  expect(createProject({ repository: '   ' })).toBeNull()
  expect(createProject({ repository: '\\' })).toBeNull()
})

test('the created record satisfies the project schema', () => {
  const project = createProject({
    repository: 'D:/Karbid2',
    appDirectory: 'code/packages/showcase',
    startCommand: 'pnpm dev',
    startUrl: 'http://127.0.0.1:3000'
  })
  if (project === null) throw new Error('the fixture repository must make a project')

  expect(v.parse(projectSchema, project)).toEqual(project)
})

test('a record without an id fails the schema', () => {
  const result = v.safeParse(projectSchema, {
    id: '',
    name: 'Karbid',
    repository: 'D:/Karbid2',
    appDirectory: '',
    startCommand: '',
    startUrl: ''
  })

  expect(result.success).toBe(false)
})
