import { afterEach, describe, expect, test } from 'bun:test'

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
   * `**` match only paths without a hidden segment, so a read of a file in a dot-folder
   * is refused as a forbidden path unless the shell allow-listed that exact file first,
   * as it does for files handed to the executable. The mock below emulates that scope.
   */
  async function installScope() {
    const allowed = new Set<string>()
    const calls: Array<{ cmd: string; path: string }> = []
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'allow_open_file') {
        const path = (args as { path: string }).path
        allowed.add(path)
        calls.push({ cmd, path })
        return null
      }
      if (cmd === 'plugin:fs|read_file') {
        const path = (args as { path: string }).path
        calls.push({ cmd, path })
        if (hasHiddenSegment(path) && !allowed.has(path)) {
          throw new Error(`forbidden path: ${path}`)
        }
        return BYTES
      }
      throw new Error(`unexpected IPC ${cmd}`)
    })
    return calls
  }

  test('opens a file inside a hidden folder', async () => {
    const calls = await installScope()

    const file = await readTauriDesignFile(DOT_FILE)

    expect(file.name).toBe('design.pen')
    expect(calls).toEqual([
      { cmd: 'allow_open_file', path: DOT_FILE },
      { cmd: 'plugin:fs|read_file', path: DOT_FILE }
    ])
  })

  test('opens a file in a normal folder the same way', async () => {
    const calls = await installScope()

    const file = await readTauriDesignFile(PLAIN_FILE)

    expect(file.name).toBe('design.pen')
    expect(calls).toEqual([
      { cmd: 'allow_open_file', path: PLAIN_FILE },
      { cmd: 'plugin:fs|read_file', path: PLAIN_FILE }
    ])
  })

  test('refuses an unsupported file before any shell call', async () => {
    const calls = await installScope()

    await expect(readTauriDesignFile('/home/ada/notes.txt')).rejects.toThrow(
      'Unsupported document format'
    )
    expect(calls).toEqual([])
  })
})
