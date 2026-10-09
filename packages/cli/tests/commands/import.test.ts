import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

setDefaultTimeout(60_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const stderr = await new Response(proc.stderr).text()
  return { stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('import CLI', () => {
  test('saves an imported flex column with its layout applied', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-import-'))
    const htmlPath = join(dir, 'column.html')
    const figPath = join(dir, 'column.fig')
    await writeFile(
      htmlPath,
      `<div style="width:390px;height:844px;display:flex;flex-direction:column;padding:24px;gap:16px">
        <div style="width:100px;height:40px;background:#ff0000"></div>
        <div style="width:200px;height:60px;background:#00ff00"></div>
      </div>`
    )

    const imported = await cli(['import', htmlPath, '-o', figPath])
    expect(imported.stderr).toBe('')
    expect(imported.exitCode).toBe(0)

    // A .fig keeps the geometry it stores, so this reads what the import wrote.
    const { graph } = await io.readDocument({
      name: figPath,
      data: new Uint8Array(await readFile(figPath))
    })
    const page = graph.getPages()[0]
    const column = graph.getNode(page.childIds[0])
    const [first, second] = (column?.childIds ?? []).map((id) => graph.getNode(id))
    expect(first).toMatchObject({ x: 24, y: 24, width: 100, height: 40 })
    expect(second).toMatchObject({ x: 24, y: 80, width: 200, height: 60 })
  })
})
