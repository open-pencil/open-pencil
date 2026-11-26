import { afterEach, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

import * as v from 'valibot'

import { repoPath } from '@open-pencil/test-support/paths'

import {
  canRunHostProcesses,
  canSelfUpdate,
  readDesktopCapabilities
} from '@/app/tauri/capabilities'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  if ('window' in globalThis) {
    Reflect.deleteProperty(globalThis.window, '__OPENPENCIL_DESKTOP_CAPABILITIES__')
  }
  await clearTauriMocks()
})

describe('readDesktopCapabilities', () => {
  test('the browser has neither feature', () => {
    expect(readDesktopCapabilities(false, { selfUpdate: true, hostProcesses: true })).toEqual({
      selfUpdate: false,
      hostProcesses: false
    })
  })

  test('a desktop shell that defines nothing keeps both on', () => {
    expect(readDesktopCapabilities(true, undefined)).toEqual({
      selfUpdate: true,
      hostProcesses: true
    })
  })

  test('takes what the shell defines', () => {
    expect(readDesktopCapabilities(true, { selfUpdate: false, hostProcesses: false })).toEqual({
      selfUpdate: false,
      hostProcesses: false
    })
  })

  test('falls back to the shell defaults for a malformed value', () => {
    const errors: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => errors.push(args)
    try {
      expect(readDesktopCapabilities(true, { selfUpdate: 'no' })).toEqual({
        selfUpdate: true,
        hostProcesses: true
      })
    } finally {
      console.error = original
    }
    expect(errors).toHaveLength(1)
  })
})

describe('desktop capabilities on window', () => {
  test('are read from the global the shell defines', async () => {
    await mockTauriIPC(() => null)
    Object.defineProperty(window, '__OPENPENCIL_DESKTOP_CAPABILITIES__', {
      value: Object.freeze({ selfUpdate: false, hostProcesses: true }),
      configurable: true
    })

    expect(canSelfUpdate()).toBe(false)
    expect(canRunHostProcesses()).toBe(true)
  })
})

describe('desktop capability files', () => {
  const Capability = v.object({
    identifier: v.string(),
    windows: v.optional(v.array(v.string())),
    permissions: v.array(v.union([v.string(), v.object({ identifier: v.string() })]))
  })
  const CAPABILITIES = 'desktop/capabilities'

  function readCapability(file: string): v.InferOutput<typeof Capability> {
    return v.parse(
      v.pipe(v.string(), v.parseJson(), Capability),
      readFileSync(repoPath(`${CAPABILITIES}/${file}`), 'utf8')
    )
  }

  // The desktop app starts host programs itself; a page given the shell plugin could start any.
  test('grant no window the shell plugin', () => {
    const files = readdirSync(repoPath(CAPABILITIES)).filter((file) => file.endsWith('.json'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const shell = readCapability(file)
        .permissions.map((permission) =>
          typeof permission === 'string' ? permission : permission.identifier
        )
        .filter((permission) => permission.startsWith('shell:'))
      expect({ file, shell }).toEqual({ file, shell: [] })
    }
  })

  // Agents' questions are answered there, so the editor's windows must not share its grants.
  test('give the permission window’s capability to that window alone', () => {
    expect(readCapability('permission.json').windows).toEqual(['permission'])
  })
})
