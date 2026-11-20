import { afterEach, describe, expect, test } from 'bun:test'
import { join as joinPath } from 'node:path'

import { BaseDirectory } from '@tauri-apps/api/path'

import { computeExpectedDiscoveryPath, resolveDiscoveryPath } from '@/app/automation/mcp/discovery'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const HOME = '/home/user'
const RUNTIME = '/run/user/1000'
const HOME_DISCOVERY = `${HOME}/.openpencil/mcp.json`
const RUNTIME_DISCOVERY = `${RUNTIME}/openpencil/mcp.json`

function useLinux(): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { platform: 'Linux x86_64' }
  })
}

function isArgs(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** `runtime` is what `runtimeDir()` resolves to; throwing means the directory is unavailable. */
async function mockDiscoveryPaths(runtime: () => string): Promise<void> {
  await mockTauriIPC((cmd, args) => {
    if (cmd === 'plugin:path|resolve_directory') {
      const directory = isArgs(args) ? args.directory : undefined
      if (directory === BaseDirectory.Home) return HOME
      if (directory === BaseDirectory.Runtime) return runtime()
      return null
    }
    if (cmd === 'plugin:path|join') {
      const paths = isArgs(args) && Array.isArray(args.paths) ? args.paths : []
      return joinPath(...paths.filter((segment): segment is string => typeof segment === 'string'))
    }
    if (cmd === 'plugin:fs|exists') return false
    return null
  })
}

afterEach(async () => {
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'navigator')
})

describe('Linux MCP discovery path', () => {
  test('uses $XDG_RUNTIME_DIR/openpencil/mcp.json when the runtime directory is set', async () => {
    useLinux()
    // The server trims XDG_RUNTIME_DIR; Tauri can hand the value back with surrounding space.
    await mockDiscoveryPaths(() => `  ${RUNTIME}  `)

    await expect(computeExpectedDiscoveryPath()).resolves.toBe(RUNTIME_DISCOVERY)
  })

  test.each<[string, () => string]>([
    [
      'unavailable',
      () => {
        throw new Error('runtime directory is unset')
      }
    ],
    ['blank', () => ' \t ']
  ])('uses ~/.openpencil/mcp.json when the runtime directory is %s', async (_label, runtime) => {
    useLinux()
    await mockDiscoveryPaths(runtime)

    await expect(computeExpectedDiscoveryPath()).resolves.toBe(HOME_DISCOVERY)
  })

  test('uses the home discovery path when /health reports the runtime directory', async () => {
    useLinux()
    await mockDiscoveryPaths(() => {
      throw new Error('runtime directory is unset')
    })

    // The runtime directory is not inside home, so the unauthenticated /health
    // report cannot redirect the read there. The app has to compute it itself.
    await expect(resolveDiscoveryPath(RUNTIME_DISCOVERY)).resolves.toBe(HOME_DISCOVERY)
  })
})
