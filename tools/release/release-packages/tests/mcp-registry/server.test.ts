import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  MCP_PACKAGE_DIRECTORY,
  releaseServer,
  serverVersionURL
} from '#release/mcp-registry/server'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const server = {
  name: 'dev.openpencil/mcp',
  description: 'Design tools',
  packages: [{ registryType: 'npm', identifier: '@open-pencil/mcp', transport: { type: 'stdio' } }]
}
const manifest = { name: '@open-pencil/mcp', version: '1.2.3', mcpName: 'dev.openpencil/mcp' }
const json = (value: unknown) => JSON.stringify(value)

describe('releaseServer', () => {
  test('names the release version for the entry and its npm package', () => {
    const entry = releaseServer(json(server), json(manifest))
    expect(entry.version).toBe('1.2.3')
    expect(entry.packages[0]).toMatchObject({ identifier: '@open-pencil/mcp', version: '1.2.3' })
    expect(entry).toMatchObject({ description: 'Design tools' })
  })

  test('refuses an mcpName the registry entry does not have', () => {
    expect(() =>
      releaseServer(json(server), json({ ...manifest, mcpName: 'dev.openpencil/other' }))
    ).toThrow('does not match')
  })

  test('refuses an entry for another npm package', () => {
    expect(() =>
      releaseServer(json(server), json({ ...manifest, name: '@open-pencil/cli' }))
    ).toThrow('not @open-pencil/cli')
  })

  test('accepts the committed server.json with the MCP package manifest', async () => {
    const directory = join(await resolveWorkspaceRoot(import.meta.dir), MCP_PACKAGE_DIRECTORY)
    const packageText = await readFile(join(directory, 'package.json'), 'utf8')
    const entry = releaseServer(await readFile(join(directory, 'server.json'), 'utf8'), packageText)
    expect(entry.name).toBe('dev.openpencil/mcp')
  })
})

test('serverVersionURL escapes the slash in the entry name', () => {
  expect(serverVersionURL('dev.openpencil/mcp', '1.2.3')).toBe(
    'https://registry.modelcontextprotocol.io/v0.1/servers/dev.openpencil%2Fmcp/versions/1.2.3'
  )
})
