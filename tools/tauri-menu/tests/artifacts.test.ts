import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts'

import { MENU_ARTIFACTS } from '../src/menu'

test('committed menus match the schema', async () => {
  const root = await resolveWorkspaceRoot(import.meta.dir)

  for (const [path, render] of Object.entries(MENU_ARTIFACTS)) {
    expect(await readFile(join(root, path), 'utf8'), `${path} is stale`).toBe(render())
  }
})
