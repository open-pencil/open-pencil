import { expect, test } from 'bun:test'

import {
  detectProject,
  directoryIn,
  type ProjectDetection,
  type ProjectDetectorIo,
  type RepositoryRootAnswer
} from '@/app/projects/detect'
import type { Project } from '@/app/projects/schema'

type Files = Record<string, string>

function detector(files: Files, answer: RepositoryRootAnswer): ProjectDetectorIo {
  return {
    repositoryRoot: async () => answer,
    readText: async (path) => {
      const found = files[path]
      return found === undefined ? null : found
    }
  }
}

/** The project a detection found; a test that expected one fails with what it got instead. */
function projectOf(detection: ProjectDetection): Project {
  if (detection.kind !== 'detected') throw new Error(`expected a project, got ${detection.kind}`)
  return detection.project
}

test('a subfolder of a repository still yields the repository root', async () => {
  const asked: string[] = []
  const io: ProjectDetectorIo = {
    repositoryRoot: async (folder) => {
      asked.push(folder)
      return { kind: 'repository', root: 'D:\\Karbid2' }
    },
    readText: async (path) =>
      path === 'D:/Karbid2/package.json' ? JSON.stringify({ scripts: { dev: 'nuxt dev' } }) : null
  }

  const project = projectOf(await detectProject(io, 'D:/Karbid2/code/packages/showcase'))

  expect(asked).toEqual(['D:/Karbid2/code/packages/showcase'])
  expect(project.repository).toBe('D:/Karbid2')
  expect(project.name).toBe('Karbid2')
})

test('a folder outside any repository makes no project', async () => {
  const detection = await detectProject(detector({}, { kind: 'not-repository' }), 'C:/Downloads')

  expect(detection.kind).toBe('not-repository')
})

test('a git that cannot be asked is reported apart from a folder outside a repository', async () => {
  const detection = await detectProject(detector({}, { kind: 'unavailable' }), 'D:/app')

  expect(detection.kind).toBe('unavailable')
})

test('the dev script wins over start, and its port becomes the start URL', async () => {
  const io = detector(
    {
      'D:/app/package.json': JSON.stringify({
        name: 'my-app',
        scripts: { start: 'node index.js', dev: 'vite --port 5173' }
      })
    },
    { kind: 'repository', root: 'D:/app' }
  )

  const project = projectOf(await detectProject(io, 'D:/app'))

  expect(project.startCommand).toBe('vite --port 5173')
  expect(project.startUrl).toBe('http://127.0.0.1:5173')
  expect(project.name).toBe('my-app')
})

test('the port a command names is read in the forms dev servers take it', async () => {
  const cases = [
    ['vite --port 5173', 'http://127.0.0.1:5173'],
    ['vite --port=4000', 'http://127.0.0.1:4000'],
    ['next dev -p 3001', 'http://127.0.0.1:3001'],
    ['PORT=8080 node server.js', 'http://127.0.0.1:8080'],
    ['vite', '']
  ] as const

  for (const [command, url] of cases) {
    const io = detector(
      { 'D:/app/package.json': JSON.stringify({ name: 'my-app', scripts: { dev: command } }) },
      { kind: 'repository', root: 'D:/app' }
    )
    expect(projectOf(await detectProject(io, 'D:/app')).startUrl).toBe(url)
  }
})

test('a repository without a manifest is still a project, just without a start command', async () => {
  const project = projectOf(
    await detectProject(detector({}, { kind: 'repository', root: 'D:/designs' }), 'D:/designs')
  )

  expect(project.startCommand).toBe('')
  expect(project.startUrl).toBe('')
  expect(project.name).toBe('designs')
})

test('a manifest that cannot be parsed leaves the start command empty', async () => {
  const io = detector(
    { 'D:/app/package.json': '{ not json' },
    { kind: 'repository', root: 'D:/app' }
  )

  expect(projectOf(await detectProject(io, 'D:/app')).startCommand).toBe('')
})

test('a manifest without scripts leaves the start command empty', async () => {
  const io = detector(
    { 'D:/app/package.json': JSON.stringify({ name: 'x' }) },
    { kind: 'repository', root: 'D:/app' }
  )

  const project = projectOf(await detectProject(io, 'D:/app'))

  expect(project.startCommand).toBe('')
  expect(project.name).toBe('x')
})

test('an application in the picked folder starts when the repository root holds none', async () => {
  const io = detector(
    {
      'D:/Karbid2/code/package.json': JSON.stringify({
        scripts: { dev: 'pnpm --filter @karbid/showcase dev' }
      })
    },
    { kind: 'repository', root: 'D:/Karbid2' }
  )

  const project = projectOf(await detectProject(io, 'D:/Karbid2/code'))

  expect(project.repository).toBe('D:/Karbid2')
  expect(project.appDirectory).toBe('code')
  expect(project.startCommand).toBe('pnpm --filter @karbid/showcase dev')
})

test("the picked folder's port becomes the start URL", async () => {
  const io = detector(
    { 'D:/app/web/package.json': JSON.stringify({ scripts: { dev: 'vite --port 5175' } }) },
    { kind: 'repository', root: 'D:/app' }
  )

  const project = projectOf(await detectProject(io, 'D:/app/web'))

  expect(project.appDirectory).toBe('web')
  expect(project.startUrl).toBe('http://127.0.0.1:5175')
})

test("the root's application wins over the picked folder's", async () => {
  const io = detector(
    {
      'D:/app/package.json': JSON.stringify({ scripts: { dev: 'node server.js' } }),
      'D:/app/web/package.json': JSON.stringify({ scripts: { dev: 'vite' } })
    },
    { kind: 'repository', root: 'D:/app' }
  )

  const project = projectOf(await detectProject(io, 'D:/app/web'))

  expect(project.appDirectory).toBe('')
  expect(project.startCommand).toBe('node server.js')
})

test('a picked folder is placed by its path, in the spelling it was picked in', () => {
  expect(directoryIn('D:/Karbid2', 'D:/Karbid2/code/web', true)).toBe('code/web')
  // git answers the root in its own case, which is not the one the folder was picked in.
  expect(directoryIn('D:/Karbid2', 'd:/karbid2/code', true)).toBe('code')
  expect(directoryIn('D:/Karbid2', 'd:/karbid2/code', false)).toBeNull()
})

test('a folder that only starts with the root name is not inside it', () => {
  expect(directoryIn('D:/Karbid2', 'D:/Karbid22/code', true)).toBeNull()
  expect(directoryIn('D:/Karbid2', 'D:/Karbid2', true)).toBeNull()
  expect(directoryIn('D:/Karbid2', 'D:/Karbid2/', true)).toBeNull()
  expect(directoryIn('D:/Karbid2', 'C:/Karbid2/code', true)).toBeNull()
})
