import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { figThumbnailSize } from '#cli-tests/helpers/fig'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneNode } from '@open-pencil/scene-graph'
import { uint8ArrayToArrayBuffer } from '@open-pencil/test-support/paths'
import { runCLI } from '#cli-tests/helpers/run'

setDefaultTimeout(60_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)
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

    const imported = await runCLI(['import', htmlPath, '-o', figPath])
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

  test('saves a thumbnail of the imported layers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-import-'))
    const htmlPath = join(dir, 'tall.html')
    const figPath = join(dir, 'tall.fig')
    await writeFile(htmlPath, '<div style="width:100px;height:400px;background:#000"></div>')
    expect((await runCLI(['import', htmlPath, '-o', figPath])).exitCode).toBe(0)

    const { width, height } = figThumbnailSize(await readFile(figPath))
    expect(width / height).toBeCloseTo(100 / 400, 2)
  })
})

setDefaultTimeout(30_000)

async function createFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-import-cli-'))
  const htmlPath = join(dir, 'card.html')
  const cssPath = join(dir, 'card.css')

  await Bun.write(
    htmlPath,
    `
      <article class="card">
        <h1>DOM/CSS card</h1>
        <p>Imported from HTML and CSS.</p>
      </article>
    `
  )
  await Bun.write(
    cssPath,
    `
      .card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 240px;
        padding: 24px;
        background: #ffffff;
        border: 1px solid #dddddd;
        border-radius: 16px;
      }
      h1 {
        font-size: 24px;
      }
    `
  )

  return { dir, htmlPath, cssPath }
}

function findNode(nodes: Iterable<SceneNode>, name: string): SceneNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node
  }
}

test.each(['card.json', 'missing/nested/card.json'])(
  'import CLI writes DesignDOM JSON output to %s',
  async (relativeOutput) => {
    const { htmlPath, cssPath, dir } = await createFixture()
    const output = join(dir, relativeOutput)

    const { stdout, stderr, exitCode } = await runCLI([
      'import',
      htmlPath,
      '--css',
      cssPath,
      '--format',
      'json',
      '--output',
      output,
      '--json'
    ])

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)

    const summary = JSON.parse(stdout)
    expect(summary).toMatchObject({ format: 'json', output, pages: 1, rootElements: 1 })

    const document = JSON.parse(await Bun.file(output).text())
    expect(document.children[0].tagName).toBe('article')
    expect(document.children[0].computedStyle.display).toBe('flex')
    expect(document.children[0].computedStyle.width).toBe('240px')
  }
)

test('import CLI reads embedded HTML styles without a sidecar CSS file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-import-cli-embedded-'))
  const htmlPath = join(dir, 'embedded.html')
  const output = join(dir, 'embedded.json')

  await Bun.write(
    htmlPath,
    `<!doctype html>
    <html>
      <head>
        <style>
          .card { display: flex; flex-direction: column; gap: 10px; width: 280px; height: 140px; padding: 20px; }
        </style>
      </head>
      <body><article class="card"><h1>Embedded CSS</h1></article></body>
    </html>`
  )

  const { stdout, stderr, exitCode } = await runCLI([
    'import',
    htmlPath,
    '--format',
    'json',
    '--output',
    output,
    '--json'
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(JSON.parse(stdout)).toMatchObject({ format: 'json', output, rootElements: 1 })

  const document = JSON.parse(await Bun.file(output).text())
  expect(document.children[0].tagName).toBe('article')
  expect(document.children[0].computedStyle.width).toBe('280px')
  expect(document.children[0].computedStyle.gap).toBe('10px')
})

test.each(['card.fig', 'missing/nested/card.fig'])(
  'import CLI writes a .fig that core IO can import to %s',
  async (relativeOutput) => {
    const { htmlPath, cssPath, dir } = await createFixture()
    const output = join(dir, relativeOutput)

    const { stdout, stderr, exitCode } = await runCLI([
      'import',
      htmlPath,
      '--css',
      cssPath,
      '--output',
      output,
      '--json'
    ])

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout)).toMatchObject({ format: 'fig', output, pages: 1, rootElements: 1 })

    const bytes = new Uint8Array(await Bun.file(output).arrayBuffer())
    const graph = await parseFigFile(uint8ArrayToArrayBuffer(bytes))
    const nodes = [...graph.nodes.values()]
    const card = findNode(nodes, 'card')
    const title = findNode(nodes, 'DOM/CSS card')

    expect(graph.getPages()).toHaveLength(1)
    expect(card?.type).toBe('FRAME')
    expect(title?.type).toBe('TEXT')
  }
)

test('import CLI compiles Tailwind candidates before import', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-import-cli-tailwind-'))
  const htmlPath = join(dir, 'tailwind.html')
  const output = join(dir, 'tailwind.json')
  const classes = ['flex', 'flex-col', 'gap-2', 'w-60', 'p-6', 'rounded-xl', 'bg-white']

  await Bun.write(
    htmlPath,
    `<article class="${classes.join(' ')}"><h1 class="text-2xl">Tailwind card</h1></article>`
  )

  const { stdout, stderr, exitCode } = await runCLI([
    'import',
    htmlPath,
    '--tailwind',
    classes.join(' '),
    '--format',
    'json',
    '--output',
    output,
    '--json'
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(JSON.parse(stdout)).toMatchObject({ format: 'json', output })

  const document = JSON.parse(await Bun.file(output).text())
  expect(document.children[0].computedStyle.display).toBe('flex')
  expect(document.children[0].computedStyle.width).toBe('240px')
})
