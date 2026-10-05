import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { resolvePlatformCommand } from '@/app/tauri/command'

import { repoPath } from '#tests/helpers/paths'

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'

describe('resolvePlatformCommand', () => {
  test('wraps a bare command in cmd /c through its own scope entry on Windows', () => {
    expect(resolvePlatformCommand('claude-agent-acp', [], WINDOWS_UA)).toEqual({
      command: 'cmd-claude-agent-acp',
      args: ['/c', 'claude-agent-acp']
    })
  })

  test('preserves extra args after the command on Windows', () => {
    expect(resolvePlatformCommand('gemini', ['--acp'], WINDOWS_UA)).toEqual({
      command: 'cmd-gemini',
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

const ShellScope = v.object({
  permissions: v.array(
    v.union([
      v.string(),
      v.object({
        identifier: v.string(),
        allow: v.optional(
          v.array(
            v.object({
              name: v.optional(v.string()),
              cmd: v.optional(v.string()),
              args: v.optional(v.union([v.boolean(), v.array(v.unknown())]))
            })
          )
        )
      })
    ])
  )
})

function spawnScope() {
  const text = readFileSync(repoPath('desktop/capabilities/default.json'), 'utf8')
  const capability = v.parse(v.pipe(v.string(), v.parseJson(), ShellScope), text)
  const spawn = capability.permissions.find(
    (permission) => typeof permission !== 'string' && permission.identifier === 'shell:allow-spawn'
  )
  return typeof spawn === 'string' ? [] : (spawn?.allow ?? [])
}

describe('shell scope', () => {
  // Every program the app starts, with the arguments it starts it with.
  const spawns: [string, string[]][] = [
    ...ACP_AGENTS.map((agent): [string, string[]] => [agent.command, agent.args]),
    ['openpencil-mcp-http', []],
    ['openpencil-harness', []]
  ]

  for (const userAgent of [WINDOWS_UA, MAC_UA]) {
    for (const [name, args] of spawns) {
      test(`allows exactly ${name} ${args.join(' ')} on ${userAgent === MAC_UA ? 'macOS' : 'Windows'}`, () => {
        const resolved = resolvePlatformCommand(name, args, userAgent)
        const entry = spawnScope().find((candidate) => candidate.name === resolved.command)
        expect(entry?.args === false ? [] : entry?.args).toEqual(resolved.args)
      })
    }
  }

  test('lets no program take arbitrary arguments', () => {
    expect(spawnScope().filter((entry) => entry.args === true)).toEqual([])
  })
})
