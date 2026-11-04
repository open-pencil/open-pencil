import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { runCLI } from '#cli-tests/helpers/run'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { figThumbnailSize } from '#cli-tests/helpers/fig'
setDefaultTimeout(60_000)
describe('lint CLI', () => {
  test('--fix --output saves a thumbnail of the fixed layers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-lint-'))
    const htmlPath = join(dir, 'tall.html')
    const figPath = join(dir, 'tall.fig')
    const fixedPath = join(dir, 'fixed.fig')
    await writeFile(htmlPath, '<div style="width:100px;height:400px;background:#000"></div>')
    expect((await runCLI(['import', htmlPath, '-o', figPath])).exitCode).toBe(0)

    await runCLI(['lint', figPath, '--fix', '-o', fixedPath])

    const { width, height } = figThumbnailSize(await readFile(fixedPath))
    expect(width / height).toBeCloseTo(100 / 400, 2)
  })
})
