import { describe, expect, test } from 'bun:test'

import { resolvePlatformCommand } from '@/app/tauri/command'

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'

describe('resolvePlatformCommand', () => {
  test('wraps a bare command in cmd /c on Windows', () => {
    expect(resolvePlatformCommand('claude-agent-acp', [], WINDOWS_UA)).toEqual({
      command: 'cmd',
      args: ['/c', 'claude-agent-acp']
    })
  })

  test('preserves extra args after the command on Windows', () => {
    expect(resolvePlatformCommand('gemini', ['--acp'], WINDOWS_UA)).toEqual({
      command: 'cmd',
      args: ['/c', 'gemini', '--acp']
    })
  })

  test('passes the command through unchanged on non-Windows', () => {
    expect(resolvePlatformCommand('claude-agent-acp', ['--acp'], MAC_UA)).toEqual({
      command: 'claude-agent-acp',
      args: ['--acp']
    })
  })

  test('defaults args to an empty array', () => {
    expect(resolvePlatformCommand('openpencil-mcp-http', undefined, MAC_UA)).toEqual({
      command: 'openpencil-mcp-http',
      args: []
    })
  })

  test('passes through when the user agent is unavailable (headless/non-browser)', () => {
    expect(resolvePlatformCommand('openpencil-mcp-http', ['--stdio'], '')).toEqual({
      command: 'openpencil-mcp-http',
      args: ['--stdio']
    })
  })
})
