import { describe, expect, test } from 'bun:test'

import type { DownloadEvent } from '@tauri-apps/plugin-updater'

import { createDeferred } from '@/app/runtime/deferred'
import {
  createUpdaterSession,
  type PendingUpdate,
  type UpdaterBackend
} from '@/app/shell/updater/session'

const NOTES = '### Fixed\n\n- Keep the update prompt on screen.\n'

/** An update whose downloads the test finishes by hand. */
function fakeUpdate(options: { failInstall?: string } = {}) {
  const calls: string[] = []
  const downloads: Array<{
    emit: (event: DownloadEvent) => void
    finish: () => void
    fail: (error: Error) => void
  }> = []
  const update: PendingUpdate = {
    version: '0.16.0',
    currentVersion: '0.15.1',
    body: NOTES,
    download(onEvent) {
      calls.push('download')
      const done = createDeferred<undefined>()
      downloads.push({ emit: onEvent, finish: () => done.resolve(undefined), fail: done.reject })
      return done.promise
    },
    async install() {
      calls.push('install')
      if (options.failInstall) throw new Error(options.failInstall)
    },
    async close() {
      calls.push('close')
    }
  }
  return { update, calls, downloads }
}

function fakeBackend(
  check: UpdaterBackend['check'],
  options: { installQuitsApp?: boolean; approve?: boolean | (() => Promise<boolean>) } = {}
) {
  const calls: string[] = []
  const backend: UpdaterBackend = {
    check,
    async confirmRestart() {
      calls.push('confirmRestart')
      const { approve = true } = options
      return typeof approve === 'function' ? approve() : approve
    },
    async relaunch() {
      calls.push('relaunch')
    },
    async closeWindow() {
      calls.push('closeWindow')
    },
    installQuitsApp: options.installQuitsApp ?? false
  }
  return { backend, calls }
}

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe('createUpdaterSession', () => {
  test('shows the release and its trimmed Markdown notes', async () => {
    const { update } = fakeUpdate()
    const session = createUpdaterSession(fakeBackend(async () => update).backend)

    await session.check()

    expect(session.state.value).toEqual({
      status: 'available',
      release: { version: '0.16.0', currentVersion: '0.15.1', notes: NOTES.trim() }
    })
  })

  test('reports when there is nothing to install', async () => {
    const session = createUpdaterSession(fakeBackend(async () => null).backend)

    await session.check()

    expect(session.state.value).toEqual({ status: 'up-to-date' })
  })

  test('retries a failed check', async () => {
    const { update } = fakeUpdate()
    let attempts = 0
    const session = createUpdaterSession(
      fakeBackend(async () => {
        attempts++
        if (attempts === 1) throw new Error('offline')
        return update
      }).backend
    )

    await session.check()
    expect(session.state.value).toEqual({ status: 'failed', step: 'check', error: 'offline' })

    await session.retry()
    expect(session.state.value.status).toBe('available')
  })

  test('downloads with progress, installs, then restarts once documents may close', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const { backend, calls: backendCalls } = fakeBackend(async () => update)
    const session = createUpdaterSession(backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.emit({ event: 'Started', data: { contentLength: 4 } })
    downloads[0]?.emit({ event: 'Progress', data: { chunkLength: 2 } })
    expect(session.state.value).toMatchObject({
      status: 'downloading',
      progress: { downloaded: 2, total: 4 }
    })

    downloads[0]?.finish()
    await installing
    expect(calls).toEqual(['download', 'install'])
    expect(session.state.value).toMatchObject({ status: 'installed' })
    // Installing on macOS and Linux never restarts by itself.
    expect(backendCalls).toEqual([])

    await session.restart()
    expect(backendCalls).toEqual(['confirmRestart', 'relaunch'])
  })

  test('stays installed when the editor keeps its documents open', async () => {
    const { update, downloads } = fakeUpdate()
    const { backend, calls } = fakeBackend(async () => update, { approve: false })
    const session = createUpdaterSession(backend)
    await session.check()
    const installing = session.install()
    downloads[0]?.finish()
    await installing

    await session.restart()

    expect(calls).toEqual(['confirmRestart'])
    expect(session.state.value.status).toBe('installed')
  })

  test('cancels a download at once and reuses it when installing again', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const session = createUpdaterSession(fakeBackend(async () => update).backend)
    await session.check()

    const first = session.install()
    downloads[0]?.emit({ event: 'Progress', data: { chunkLength: 3 } })
    session.cancel()
    expect(session.state.value.status).toBe('available')

    // The detached download finishing must not install anything.
    downloads[0]?.emit({ event: 'Progress', data: { chunkLength: 1 } })
    expect(session.state.value.status).toBe('available')

    const second = session.install()
    expect(session.state.value).toMatchObject({
      status: 'downloading',
      progress: { downloaded: 4 }
    })
    downloads[0]?.finish()
    await Promise.all([first, second])

    expect(calls).toEqual(['download', 'install'])
    expect(session.state.value.status).toBe('installed')
  })

  test('ignores a cancelled download that finishes while detached', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const session = createUpdaterSession(fakeBackend(async () => update).backend)
    await session.check()

    const installing = session.install()
    session.cancel()
    downloads[0]?.finish()
    await installing

    expect(calls).toEqual(['download'])
    expect(session.state.value.status).toBe('available')
  })

  test('reports a failed download and starts a new one on retry', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const session = createUpdaterSession(fakeBackend(async () => update).backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.fail(new Error('connection reset'))
    await installing
    expect(session.state.value).toMatchObject({
      status: 'failed',
      step: 'download',
      error: 'connection reset',
      release: { version: '0.16.0' }
    })

    const retrying = session.retry()
    await settle()
    downloads[1]?.finish()
    await retrying
    expect(calls).toEqual(['download', 'download', 'install'])
  })

  test('keeps the release visible when the install fails', async () => {
    const { update, downloads } = fakeUpdate({ failInstall: 'signature mismatch' })
    const session = createUpdaterSession(fakeBackend(async () => update).backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.finish()
    await installing

    expect(session.state.value).toMatchObject({
      status: 'failed',
      step: 'install',
      error: 'signature mismatch',
      release: { version: '0.16.0' }
    })
  })

  test('closes documents before a Windows installer quits the app', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const { backend, calls: backendCalls } = fakeBackend(async () => update, {
      installQuitsApp: true,
      approve: false
    })
    const session = createUpdaterSession(backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.finish()
    await installing

    expect(backendCalls).toEqual(['confirmRestart'])
    expect(calls).toEqual(['download'])
    expect(session.state.value.status).toBe('available')
  })

  test('a cancel while the editor asks about documents stops a Windows install', async () => {
    const answer = createDeferred<boolean>()
    const { update, calls, downloads } = fakeUpdate()
    const { backend } = fakeBackend(async () => update, {
      installQuitsApp: true,
      approve: () => answer.promise
    })
    const session = createUpdaterSession(backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.finish()
    await settle()
    session.cancel()
    answer.resolve(true)
    await installing

    expect(calls).toEqual(['download'])
    expect(session.state.value.status).toBe('available')
  })

  test('reports a failed document prompt instead of waiting', async () => {
    const { update, calls, downloads } = fakeUpdate()
    const { backend } = fakeBackend(async () => update, {
      installQuitsApp: true,
      approve: () => Promise.reject(new Error('editor closed'))
    })
    const session = createUpdaterSession(backend)
    await session.check()

    const installing = session.install()
    downloads[0]?.finish()
    await installing

    expect(calls).toEqual(['download'])
    expect(session.state.value).toMatchObject({
      status: 'failed',
      step: 'install',
      error: 'editor closed'
    })
  })

  test('asks about documents once however often Restart Now is pressed', async () => {
    const answer = createDeferred<boolean>()
    const { update, downloads } = fakeUpdate()
    const { backend, calls } = fakeBackend(async () => update, { approve: () => answer.promise })
    const session = createUpdaterSession(backend)
    await session.check()
    const installing = session.install()
    downloads[0]?.finish()
    await installing

    const first = session.restart()
    const second = session.restart()
    answer.resolve(true)
    await Promise.all([first, second])

    expect(calls).toEqual(['confirmRestart', 'relaunch'])
  })

  test('releases the update handle when dismissed', async () => {
    const { update, calls } = fakeUpdate()
    const { backend, calls: backendCalls } = fakeBackend(async () => update)
    const session = createUpdaterSession(backend)

    await session.check()
    await session.dismiss()

    expect(calls).toEqual(['close'])
    expect(backendCalls).toEqual(['closeWindow'])
  })
})
