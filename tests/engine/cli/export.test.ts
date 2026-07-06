import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import { runOpenPencilCLI } from '#tests/helpers/cli'
import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

setDefaultTimeout(30_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createFigFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-export-cli-'))
  const figPath = join(dir, 'card.fig')
  const graph = makeSceneGraph('Export Page')
  const rect = createRect(graph, firstPageId(graph), {
    name: 'Export Card',
    x: 0,
    y: 0,
    width: 160,
    height: 80
  })
  rect.layoutMode = 'HORIZONTAL'
  rect.itemSpacing = 8
  rect.paddingLeft = 16
  rect.paddingRight = 16
  rect.paddingTop = 16
  rect.paddingBottom = 16
  rect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }]

  const result = await io.writeDocument('fig', graph)
  await Bun.write(figPath, result.data as Uint8Array)
  return { dir, figPath }
}

test('export CLI writes HTML with inline styles by default', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('style=')
  expect(html).toContain('display: flex')
})

test('export CLI can write HTML styles as Tailwind classes', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-tailwind.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--css',
    'tailwind',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('class="')
  expect(html).toContain('flex')
  expect(html).not.toContain('style=')
})

test('export CLI can write standalone HTML', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-standalone.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('data-open-pencil-html="standalone"')
  expect(html).toContain('position:relative')
  expect(html).toContain('position: absolute')
  expect(html).not.toContain('@tailwindcss/browser@4')
})

test('export CLI precompiles Tailwind CSS for standalone Tailwind HTML', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-standalone-tailwind.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--css',
    'tailwind',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('<style>')
  expect(html).toContain('class="')
  expect(html).toContain('.flex')
  expect(html).not.toContain('@tailwindcss/browser@4')
})

test('export CLI can write external standalone HTML assets', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-external.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--css',
    'tailwind',
    '--assets',
    'external',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  const cssPath = join(dir, 'card-external.assets', 'openpencil.css')
  const css = await Bun.file(cssPath).text()
  expect(html).toContain('<link rel="stylesheet" href="card-external.assets/openpencil.css">')
  expect(html).not.toContain('<style>')
  expect(css).toContain('.flex')
  expect(css).toContain('.op-stage')
})
