import { expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { cliSourcePath } from '#tests/helpers/paths'

const BUN_GLOBAL = /(?<![\w$.])Bun\s*\./g

async function typeScriptSources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return typeScriptSources(path)
      return entry.name.endsWith('.ts') ? [path] : []
    })
  )
  return files.flat()
}

// The published CLI is started through `bin/openpencil.js`, which uses a Node
// shebang, so the `Bun` global is unavailable when it is installed from npm.
test('CLI sources do not reference Bun globals', async () => {
  const root = cliSourcePath()
  const sources = await typeScriptSources(root)
  expect(sources.length).toBeGreaterThan(0)

  const offenders: string[] = []
  for (const path of sources) {
    const contents = await readFile(path, 'utf8')
    for (const match of contents.matchAll(BUN_GLOBAL)) {
      const line = contents.slice(0, match.index).split('\n').length
      offenders.push(`${relative(root, path)}:${line}`)
    }
  }

  expect(offenders).toEqual([])
})
