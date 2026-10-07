import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { npmInstallArgs } from '@/app/ai/agents/native'
import { HARNESS_PACKAGE } from '@/app/ai/harness/companion'
import { MCP_PACKAGE_NAME } from '@/app/automation/mcp/failure'
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

/** The arguments a scope entry lets through for `args`, the way the shell plugin builds them. */
function allowedArgs(scope: boolean | unknown[] | undefined, args: string[]): unknown[] | null {
  if (scope === false) return []
  if (!Array.isArray(scope)) return null
  return scope.map((allowed, index) => {
    if (typeof allowed === 'string') return allowed
    const validator = v.parse(v.object({ validator: v.string() }), allowed).validator
    const value = args[index] ?? ''
    return new RegExp(validator).test(value) ? value : { rejected: value }
  })
}

const rootPackage = v.parse(
  v.pipe(v.string(), v.parseJson(), v.object({ version: v.string() })),
  readFileSync(repoPath('package.json'), 'utf8')
)

describe('shell scope', () => {
  // Every program the app starts, with the arguments it starts it with.
  // npm installs only these packages; a build pins the companions to the app's version, which
  // tests stand in for with a placeholder the scope rightly refuses.
  const installs = [
    ...ACP_AGENTS.flatMap((agent) => (agent.adapterPackage ? [agent.adapterPackage] : [])),
    `${MCP_PACKAGE_NAME}@${rootPackage.version}`,
    `${HARNESS_PACKAGE}@${rootPackage.version}`
  ]
  const spawns: [string, string[]][] = [
    ...ACP_AGENTS.map((agent): [string, string[]] => [agent.command, agent.args]),
    ['openpencil-mcp-http', []],
    ['openpencil-harness', []],
    ...installs.map((target): [string, string[]] => ['npm', npmInstallArgs(target)])
  ]

  for (const userAgent of [WINDOWS_UA, MAC_UA]) {
    for (const [name, args] of spawns) {
      test(`allows exactly ${name} ${args.join(' ')} on ${userAgent === MAC_UA ? 'macOS' : 'Windows'}`, () => {
        const resolved = resolvePlatformCommand(name, args, userAgent)
        const entry = spawnScope().find((candidate) => candidate.name === resolved.command)
        expect(entry?.cmd).toBe(userAgent === WINDOWS_UA ? 'cmd' : name)
        expect(allowedArgs(entry?.args, resolved.args)).toEqual(resolved.args)
      })
    }
  }

  test('allows nothing but those programs', () => {
    const expected = [WINDOWS_UA, MAC_UA].flatMap((userAgent) =>
      spawns.map(([name, args]) => resolvePlatformCommand(name, args, userAgent).command)
    )
    expect(
      spawnScope()
        .map((entry) => entry.name)
        .sort()
    ).toEqual([...new Set(expected)].sort())
  })

  test('lets npm install nothing but those packages', () => {
    const validators = spawnScope().flatMap((entry) =>
      Array.isArray(entry.args) ? entry.args.filter((arg) => typeof arg !== 'string') : []
    )
    expect(validators.length).toBeGreaterThan(0)
    for (const validator of validators) {
      const pattern = new RegExp(v.parse(v.object({ validator: v.string() }), validator).validator)
      for (const target of ['left-pad', '@open-pencil/mcp@0.15.1 & calc', '@open-pencil/mcp']) {
        expect(pattern.test(target)).toBe(false)
      }
    }
  })

  test('lets no program take arbitrary arguments', () => {
    expect(spawnScope().filter((entry) => entry.args === true)).toEqual([])
  })
})
