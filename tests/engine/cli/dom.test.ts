import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseFigFile } from '@open-pencil/core/io'
import type { SceneNode } from '@open-pencil/core/scene-graph'

import { cliSourcePath } from '#tests/helpers/paths'

setDefaultTimeout(30_000)

const CLI = cliSourcePath('index.ts')

interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

async function run(args: string[]): Promise<CommandResult> {
  const proc = Bun.spawn(['bun', CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

async function createFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-dom-cli-'))
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

test('dom CLI writes DesignDOM JSON output', async () => {
  const { htmlPath, cssPath, dir } = await createFixture()
  const output = join(dir, 'card.json')

  const { stdout, stderr, exitCode } = await run([
    'dom',
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
})

test('dom CLI reads embedded HTML styles without a sidecar CSS file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-dom-cli-embedded-'))
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

  const { stdout, stderr, exitCode } = await run([
    'dom',
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

test('dom CLI writes serialized HTML output', async () => {
  const { htmlPath, cssPath, dir } = await createFixture()
  const output = join(dir, 'card.out.html')

  const { stderr, exitCode } = await run([
    'dom',
    htmlPath,
    '--css',
    cssPath,
    '--format',
    'html',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('DOM/CSS card')
  expect(html).toContain('class="card"')
})

test('dom CLI writes a .fig that core IO can import', async () => {
  const { htmlPath, cssPath, dir } = await createFixture()
  const output = join(dir, 'card.fig')

  const { stdout, stderr, exitCode } = await run([
    'dom',
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
  const graph = await parseFigFile(bytes)
  const nodes = [...graph.nodes.values()]
  const card = findNode(nodes, 'card')
  const title = findNode(nodes, 'DOM/CSS card')

  expect(graph.getPages()).toHaveLength(1)
  expect(card?.type).toBe('FRAME')
  expect(title?.type).toBe('TEXT')
})

test('dom CLI compiles Tailwind candidates before import', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-dom-cli-tailwind-'))
  const htmlPath = join(dir, 'tailwind.html')
  const output = join(dir, 'tailwind.json')
  const classes = ['flex', 'flex-col', 'gap-2', 'w-60', 'p-6', 'rounded-xl', 'bg-white']

  await Bun.write(
    htmlPath,
    `<article class="${classes.join(' ')}"><h1 class="text-2xl">Tailwind card</h1></article>`
  )

  const { stdout, stderr, exitCode } = await run([
    'dom',
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
