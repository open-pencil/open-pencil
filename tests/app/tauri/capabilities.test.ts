import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

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

describe('project sidecar file scope', () => {
  const Capability = v.object({
    identifier: v.string(),
    permissions: v.array(
      v.union([
        v.string(),
        v.object({
          identifier: v.string(),
          allow: v.optional(v.array(v.object({ path: v.string() })))
        })
      ])
    )
  })
  const TauriConfig = v.object({
    plugins: v.object({ fs: v.object({ requireLiteralLeadingDot: v.boolean() }) })
  })

  function readJSON<T extends v.GenericSchema>(path: string, schema: T): v.InferOutput<T> {
    return v.parse(v.pipe(v.string(), v.parseJson(), schema), readFileSync(repoPath(path), 'utf8'))
  }

  /** The paths one permission allows, which the file scope matches a read or a write against. */
  function allowedPaths(identifier: string): string[] {
    const capability = readJSON('desktop/capabilities/default.json', Capability)
    for (const permission of capability.permissions) {
      if (typeof permission === 'string' || permission.identifier !== identifier) continue
      return (permission.allow ?? []).map((entry) => entry.path)
    }
    return []
  }

  // A project's sidecar lives in `.opencanvas`, which `requireLiteralLeadingDot` keeps out of
  // `**`, so the folder is allowed by name: reading it, writing the file, and making the folder.
  test('allows the sidecar folder by name', () => {
    expect(allowedPaths('fs:allow-read-file')).toContain('**/.opencanvas/**')
    expect(allowedPaths('fs:allow-write-file')).toContain('**/.opencanvas/**')
    expect(allowedPaths('fs:allow-mkdir')).toContain('**/.opencanvas')
  })

  // Every other hidden path stays out, which is what the scope is for; a broad pattern here would
  // let a document name a startup folder or a shell profile.
  test('opens no hidden path beyond that folder', () => {
    expect(
      readJSON('desktop/tauri.conf.json', TauriConfig).plugins.fs.requireLiteralLeadingDot
    ).toBe(true)
    for (const identifier of ['fs:allow-read-file', 'fs:allow-write-file', 'fs:allow-mkdir']) {
      const hidden = allowedPaths(identifier).filter((path) => path.includes('/.'))
      expect(hidden.filter((path) => !path.includes('.opencanvas'))).toEqual([])
    }
  })
})

describe('host process permissions', () => {
  const Capability = v.object({
    identifier: v.string(),
    permissions: v.array(v.union([v.string(), v.object({ identifier: v.string() })]))
  })
  const Config = v.object({
    app: v.object({ security: v.object({ capabilities: v.array(v.string()) }) })
  })

  function readJSON<T extends v.GenericSchema>(path: string, schema: T): v.InferOutput<T> {
    return v.parse(v.pipe(v.string(), v.parseJson(), schema), readFileSync(repoPath(path), 'utf8'))
  }

  // The shell grants host-processes at startup only when allowed; a shell permission in a
  // capability that is always enabled would let a sandboxed package spawn anyway.
  test('are granted by no capability that is always enabled', () => {
    const enabled = readJSON('desktop/tauri.conf.json', Config).app.security.capabilities
    expect(enabled).not.toContain('host-processes')
    for (const identifier of enabled) {
      const capability = readJSON(`desktop/capabilities/${identifier}.json`, Capability)
      const shell = capability.permissions
        .map((permission) => (typeof permission === 'string' ? permission : permission.identifier))
        .filter((permission) => permission.startsWith('shell:'))
      expect(shell).toEqual([])
    }
  })
})
