import { expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts'

const execute = promisify(execFile)
const root = await resolveWorkspaceRoot(import.meta.dir)

test.each(['app-first', 'sdk-first'])(
  'Vue module declarations preserve Storybook default args (%s)',
  async (order) => {
    const directory = await mkdtemp(join(tmpdir(), 'open-pencil-vue-module-'))
    try {
      const declarations = [join(root, 'src/env.d.ts'), join(root, 'packages/vue/src/global.d.ts')]
      if (order === 'sdk-first') declarations.reverse()
      const project = join(directory, 'tsconfig.json')
      await writeFile(
        project,
        JSON.stringify({
          extends: join(root, 'tsconfig.json'),
          include: [],
          files: [
            ...declarations,
            join(root, 'src/components/ui/paint/FillSwatchTrigger.stories.ts')
          ]
        })
      )
      const result = await execute(
        process.execPath,
        [
          join(root, 'node_modules/@typescript/native-preview/bin/tsgo'),
          '--noEmit',
          '--project',
          project
        ],
        { cwd: root, timeout: 20_000, maxBuffer: 2 * 1024 * 1024 }
      )
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  30_000
)
