import { afterEach, describe, expect, test } from 'bun:test'

import { invoke } from '@tauri-apps/api/core'

import { readTauriDesignFile } from '@/app/shell/menu/files'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const DOT_FILE = '/home/ada/.pencil/documents/abc123/design.pen'
const PLAIN_FILE = '/home/ada/design.pen'
const BYTES = [0x50, 0x45, 0x4e, 0x31]

/** Segments starting with a dot (other than `.` itself) are hidden; `**` never matches them. */
function hasHiddenSegment(path: string): boolean {
  return path.split(/[/\\]/).some((segment) => segment.length > 1 && segment.startsWith('.'))
}

afterEach(async () => {
  await clearTauriMocks()
})

describe('readTauriDesignFile', () => {
  /**
   * The desktop fs scope (`requireLiteralLeadingDot` in `desktop/tauri.conf.json`) lets
   * `**` match only paths without a hidden segment, so a file in a dot-folder is
   * refused as a forbidden path unless the shell read it first. The shell reads the
   * one named file natively (`read_open_file`) instead of granting the webview access
   * to it, so the mock below emulates that scope: reads go through the native command,
   * and a `plugin:fs|write_file` on a hidden path is refused — nothing ever grants
   * the webview write access to it.
   */
  async function installScope() {
    const calls: Array<{ cmd: string; path: string }> = []
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'read_open_file') {
        const path = (args as { path: string }).path
        calls.push({ cmd, path })
        return BYTES
      }
      if (cmd === 'plugin:fs|write_file') {
        const path = (args as { path: string }).path
        calls.push({ cmd, path })
        if (hasHiddenSegment(path)) {
          throw new Error(`forbidden path: ${path}`)
        }
        return null
      }
      throw new Error(`unexpected IPC ${cmd}`)
    })
    return calls
  }

  test('opens a file inside a hidden folder', async () => {
    const calls = await installScope()

    const file = await readTauriDesignFile(DOT_FILE)

    expect(file.name).toBe('design.pen')
    expect(calls).toEqual([{ cmd: 'read_open_file', path: DOT_FILE }])
  })

  test('opens a file in a normal folder the same way', async () => {
    const calls = await installScope()

    const file = await readTauriDesignFile(PLAIN_FILE)

    expect(file.name).toBe('design.pen')
    expect(calls).toEqual([{ cmd: 'read_open_file', path: PLAIN_FILE }])
  })

  test('reading a hidden file does not allow writing it', async () => {
    const calls = await installScope()

    const file = await readTauriDesignFile(DOT_FILE)

    expect(file.name).toBe('design.pen')
    expect(calls.every((call) => call.cmd !== 'allow_open_file')).toBe(true)
    await expect(invoke('plugin:fs|write_file', { path: DOT_FILE, contents: [1] })).rejects.toThrow(
      `forbidden path: ${DOT_FILE}`
    )
  })

  test('refuses an unsupported file before any shell call', async () => {
    const calls = await installScope()

    await expect(readTauriDesignFile('/home/ada/notes.txt')).rejects.toThrow(
      'Unsupported document format'
    )
    expect(calls).toEqual([])
  })
})
