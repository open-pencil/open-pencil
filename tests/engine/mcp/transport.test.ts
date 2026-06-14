import { describe, expect, it } from 'bun:test'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getSocketDir,
  getSocketPath,
  getDiscoveryPath,
  platformHasUnixSockets,
  platformName
} from '@open-pencil/mcp/transport'

describe('transport/paths', () => {
  describe('getSocketDir', () => {
    it('returns a valid directory path', async () => {
      const dir = await getSocketDir()
      expect(dir).toBeTruthy()
      expect(typeof dir).toBe('string')
    })

    it('respects OPENPENCIL_MCP_SOCKET env override', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      process.env.OPENPENCIL_MCP_SOCKET = join(tmpdir(), 'test-openpencil-socket', 'mcp.sock')
      try {
        const dir = await getSocketDir()
        expect(dir).toBe(join(tmpdir(), 'test-openpencil-socket'))
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
      }
    })

    it('uses platform-appropriate default path', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      delete process.env.OPENPENCIL_MCP_SOCKET
      try {
        const dir = await getSocketDir()
        if (process.platform === 'darwin') {
          expect(dir).toContain('Library/Application Support/OpenPencil')
        } else if (process.platform === 'win32') {
          const localAppData = process.env.LOCALAPPDATA
          if (localAppData) {
            expect(dir.toLowerCase()).toContain(localAppData.toLowerCase())
          }
          expect(dir.toLowerCase()).toContain('openpencil')
        } else {
          // Linux / other Unix
          const xdg = process.env.XDG_RUNTIME_DIR
          if (xdg) {
            expect(dir).toContain(xdg)
          } else {
            expect(dir).toContain('.openpencil')
          }
        }
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
      }
    })

    it('creates the directory if it does not exist', async () => {
      const testDir = join(tmpdir(), `openpencil-test-${Date.now()}`)
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      process.env.OPENPENCIL_MCP_SOCKET = `${testDir}/mcp.sock`
      try {
        const dir = await getSocketDir()
        expect(dir).toBe(testDir)
        const info = await stat(dir).catch(() => null)
        expect(info).not.toBeNull()
        expect(info?.isDirectory()).toBe(true)
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
        const { rm } = await import('node:fs/promises')
        await rm(testDir, { recursive: true, force: true }).catch(() => null)
      }
    })
  })

  describe('getSocketPath', () => {
    it('returns a path ending in mcp.sock', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      delete process.env.OPENPENCIL_MCP_SOCKET
      try {
        const path = await getSocketPath()
        expect(path).toMatch(/mcp\.sock$/)
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
      }
    })

    it('respects OPENPENCIL_MCP_SOCKET override', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      const overrideDir = join(tmpdir(), 'openpencil-test-override')
      process.env.OPENPENCIL_MCP_SOCKET = join(overrideDir, 'mcp.sock')
      try {
        const path = await getSocketPath()
        expect(path).toBe(join(overrideDir, 'mcp.sock'))
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
        const { rm } = await import('node:fs/promises')
        await rm(overrideDir, { recursive: true, force: true }).catch(() => null)
      }
    })
  })

  describe('getDiscoveryPath', () => {
    it('returns a path ending in mcp.json', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      delete process.env.OPENPENCIL_MCP_SOCKET
      try {
        const path = await getDiscoveryPath()
        expect(path).toMatch(/mcp\.json$/)
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
      }
    })

    it('ignores OPENPENCIL_MCP_SOCKET override (stays on platform path)', async () => {
      const originalSocket = process.env.OPENPENCIL_MCP_SOCKET
      const overrideDir = join(tmpdir(), 'openpencil-test-discovery-override')
      process.env.OPENPENCIL_MCP_SOCKET = join(overrideDir, 'mcp.sock')
      try {
        const path = await getDiscoveryPath()
        // The discovery file must NOT be co-located with the override socket —
        // it always stays on the well-known platform path so clients can find
        // it without knowing the socket override.
        expect(path).not.toBe(join(overrideDir, 'mcp.json'))
        expect(path).toMatch(/mcp\.json$/)
      } finally {
        if (originalSocket == null) {
          delete process.env.OPENPENCIL_MCP_SOCKET
        } else {
          process.env.OPENPENCIL_MCP_SOCKET = originalSocket
        }
      }
    })
  })

  describe('platformHasUnixSockets', () => {
    it('returns true on POSIX platforms, false on Windows', () => {
      expect(platformHasUnixSockets()).toBe(process.platform !== 'win32')
    })
  })

  describe('platformName', () => {
    it('returns a valid platform name', () => {
      const name = platformName()
      expect(['macos', 'linux', 'windows', 'other']).toContain(name)
    })
  })
})
