import { expect, test } from 'bun:test'

import {
  applicationAddress,
  applicationFolder,
  stopProjectRun,
  useProjectRunner,
  type ProjectRunnerEvents,
  type ProjectRunnerTransport
} from '@/app/projects/runner'
import { createProject, type Project } from '@/app/projects/schema'

function project(repository: string, appDirectory = '', startCommand = 'vite'): Project {
  const created = createProject({ repository, appDirectory, startCommand })
  if (created === null) throw new Error(`the fixture ${repository} must make a project`)
  return created
}

/** Events the test fires itself, standing in for the window's native listener. */
function events() {
  const outputs: ((event: { id: string; line: string }) => void)[] = []
  const exits: ((event: { id: string; code: number | null }) => void)[] = []
  const listeners: ProjectRunnerEvents = {
    listenOutput: async (listener) => {
      outputs.push(listener)
      return () => undefined
    },
    listenExit: async (listener) => {
      exits.push(listener)
      return () => undefined
    }
  }
  return {
    listeners,
    output: (id: string, line: string) => outputs.forEach((listener) => listener({ id, line })),
    exit: (id: string, code: number | null) => exits.forEach((listener) => listener({ id, code }))
  }
}

function recorder(): { transport: ProjectRunnerTransport; calls: [string, unknown][] } {
  const calls: [string, unknown][] = []
  const transport: ProjectRunnerTransport = async (command, args) => {
    // A screen that mounts asks what runs; a test starts from nothing running.
    if (command === 'project_run') return null
    calls.push([command, args])
    return 42
  }
  return { transport, calls }
}

/** Lets the fire-and-forget restore of a mounting screen settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

test('starts the command in the folder the application lives in', async () => {
  const karbid = project('D:/Karbid2', 'code', 'pnpm dev')
  const { transport, calls } = recorder()
  const runner = useProjectRunner(karbid, transport, events().listeners)

  expect(await runner.start()).toBe(true)

  expect(calls).toEqual([
    ['project_start', { id: karbid.id, directory: 'D:/Karbid2/code', command: 'pnpm dev' }]
  ])
  expect(runner.state.value).toBe('running')
  expect(runner.running.value).toBe(true)
})

test('a project without a start command starts nothing', async () => {
  const empty = project('D:/designs', '', '   ')
  const { transport, calls } = recorder()
  const runner = useProjectRunner(empty, transport, events().listeners)

  expect(await runner.start()).toBe(false)
  expect(calls).toEqual([])
})

test('keeps what the application prints and reads its address from it', async () => {
  const app = project('D:/app-prints')
  const fired = events()
  const { transport } = recorder()
  const runner = useProjectRunner(app, transport, fired.listeners)
  await runner.start()

  fired.output(app.id, '  VITE v8.1.4  ready in 1833 ms')
  fired.output(app.id, '  ➜  Local:   http://localhost:5173/')
  fired.output('another-project', 'http://localhost:9999/')

  expect(runner.output.value).toHaveLength(2)
  expect(runner.address.value).toBe('http://localhost:5173')
})

test('the address the command names wins over the printed one', () => {
  const fromManifest = createProject({
    repository: 'D:/app',
    startCommand: 'vite --port 4000',
    startUrl: 'http://127.0.0.1:4000'
  })
  if (fromManifest === null) throw new Error('the fixture must make a project')

  expect(applicationAddress(fromManifest, ['http://localhost:5173/'])).toBe('http://127.0.0.1:4000')
  expect(applicationAddress(project('D:/app', '', 'vite --port 4000'), [])).toBe('')
})

test('an address printed in colour is read without the colour', () => {
  const app = project('D:/app-colour')
  // A dev server colours the port it prints, and the escape would end the address before it.
  const line = '  ➜  Local:   http://localhost:\u001B[1m5173\u001B[22m/'

  expect(applicationAddress(app, [line])).toBe('http://localhost:5173')
})

test('a port is read whole or not at all', () => {
  const app = project('D:/app-port')

  // `\d{2,5}` alone would answer `…:51734` here, a port of five digits out of six.
  expect(applicationAddress(app, ['  ➜  Local:   http://localhost:517345/'])).toBe('')
  expect(applicationAddress(app, ['listening on http://127.0.0.1:65535'])).toBe(
    'http://127.0.0.1:65535'
  )
})

test('the address of this machine wins over the one on the network', () => {
  const app = project('D:/app-host')

  // `vite --host` prints the network address last; a page on it is one the app cannot draw.
  expect(
    applicationAddress(app, [
      '  ➜  Local:   http://localhost:5173/',
      '  ➜  Network: http://192.168.1.7:5173/'
    ])
  ).toBe('http://localhost:5173')
})

test('an exit ends the run and keeps its code', async () => {
  const app = project('D:/app-exit')
  const fired = events()
  const { transport } = recorder()
  const runner = useProjectRunner(app, transport, fired.listeners)
  await runner.start()

  fired.exit(app.id, 1)

  expect(runner.state.value).toBe('stopped')
  expect(runner.exitCode.value).toBe(1)
  expect(runner.running.value).toBe(false)
})

test('stopping asks the native side and leaves the run idle', async () => {
  const app = project('D:/app-stop')
  const { transport, calls } = recorder()
  const runner = useProjectRunner(app, transport, events().listeners)
  await runner.start()

  await runner.stop()

  expect(calls.at(-1)).toEqual(['project_stop', { id: app.id }])
  expect(runner.state.value).toBe('idle')
})

test('a start the native side refuses is reported', async () => {
  const app = project('D:/app-refused')
  const transport: ProjectRunnerTransport = async () => {
    throw new Error('the project path is not a directory')
  }
  const runner = useProjectRunner(app, transport, events().listeners)

  expect(await runner.start()).toBe(false)

  expect(runner.state.value).toBe('failed')
  expect(runner.failure.value).toBe('the project path is not a directory')
})

test('a project at the repository root runs there', () => {
  expect(applicationFolder(project('D:/app'))).toBe('D:/app')
  expect(applicationFolder(project('D:/app', 'web'))).toBe('D:/app/web')
})

test('a reloaded window picks the run it left up again', async () => {
  const app = project('D:/app-reload')
  const fired = events()
  const transport: ProjectRunnerTransport = async (command) =>
    command === 'project_run' ? 42 : null
  const runner = useProjectRunner(app, transport, fired.listeners)
  await settle()

  expect(runner.state.value).toBe('running')

  fired.output(app.id, '  ➜  Local:   http://localhost:5173/')
  expect(runner.address.value).toBe('http://localhost:5173')
})

test('a project that runs nothing stays idle when its screen mounts', async () => {
  const idle = project('D:/idle-app')
  const runner = useProjectRunner(idle, recorder().transport, events().listeners)
  await settle()

  expect(runner.state.value).toBe('idle')
})

test('a second start leaves the run that is up alone', async () => {
  const app = project('D:/app-twice')
  const fired = events()
  const { transport, calls } = recorder()
  const runner = useProjectRunner(app, transport, fired.listeners)
  await runner.start()
  fired.output(app.id, '  ➜  Local:   http://localhost:5173/')

  expect(await runner.start()).toBe(false)

  expect(calls.filter(([command]) => command === 'project_start')).toHaveLength(1)
  expect(runner.output.value).toHaveLength(1)
  expect(runner.state.value).toBe('running')
})

test('a process that exits before its start command answers stays stopped', async () => {
  const app = project('D:/app-fast-exit')
  const fired = events()
  let release = (): void => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const transport: ProjectRunnerTransport = async (command) => {
    if (command === 'project_run') return null
    if (command === 'project_start') await held
    return 42
  }
  const runner = useProjectRunner(app, transport, fired.listeners)
  await settle()

  const starting = runner.start()
  await settle()
  // The listeners are bound before the command is sent, so the exit reaches the run first.
  fired.exit(app.id, 1)
  release()
  await starting

  expect(runner.state.value).toBe('stopped')
  expect(runner.exitCode.value).toBe(1)
  expect(runner.running.value).toBe(false)
})

test('a listener that fails to bind leaves the one already bound behind', async () => {
  const app = project('D:/app-half-bound')
  const stopped: string[] = []
  const listeners: ProjectRunnerEvents = {
    listenOutput: async () => () => stopped.push('output'),
    listenExit: async () => {
      throw new Error('the window refused the listener')
    }
  }
  const runner = useProjectRunner(app, recorder().transport, listeners)

  expect(await runner.start()).toBe(false)

  expect(stopped).toEqual(['output'])
  expect(runner.state.value).toBe('failed')
})
test('a project that is removed takes its running application with it', async () => {
  const app = project('D:/app-removed')
  const { transport, calls } = recorder()
  const runner = useProjectRunner(app, transport, events().listeners)
  await runner.start()
  calls.length = 0

  await stopProjectRun(app.id, transport)

  expect(calls).toEqual([['project_stop', { id: app.id }]])
  expect(runner.state.value).toBe('idle')
  expect(runner.running.value).toBe(false)
})
