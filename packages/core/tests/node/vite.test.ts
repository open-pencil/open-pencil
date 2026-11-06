import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { corePackagePath } from '#core-tests/helpers/paths'
import { build, defaultClientConditions, type Rolldown } from 'vite'

import { openPencil, type OpenPencilPluginOptions } from '@open-pencil/core/node/vite'

const CORE_SOURCE = corePackagePath('src')
const CORE_ASSETS = corePackagePath('assets')

// A page loads CanvasKit, as an app does: a locator nothing reads is left out of the bundle.
const LOAD_CANVASKIT =
  "import { getCanvasKit } from '@open-pencil/core/canvaskit'\nwindow.loadCanvasKit = getCanvasKit\n"

const roots: string[] = []

afterAll(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))))

type Output = Array<Rolldown.OutputChunk | Rolldown.OutputAsset>

async function buildPage(
  options?: OpenPencilPluginOptions,
  { base = '/', main = LOAD_CANVASKIT } = {}
): Promise<Output> {
  // Real path: Vite names the page by its path relative to the root, which a symlinked temp dir breaks.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'open-pencil-vite-')))
  roots.push(root)
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><head></head><body><script type="module" src="./main.js"></script></body></html>'
  )
  await writeFile(join(root, 'main.js'), main)
  const result = await build({
    root,
    base,
    logLevel: 'silent',
    configFile: false,
    // Workspace packages build from source, as tests run without their `dist`: Core through the
    // aliases, which keep its assets beside the sources as the app's do, and the packages it
    // imports through their `bun` export condition.
    resolve: {
      alias: [
        { find: /^@open-pencil\/core\/assets\//, replacement: `${CORE_ASSETS}/` },
        { find: /^@open-pencil\/core\/(.*)$/, replacement: `${CORE_SOURCE}/$1` }
      ],
      conditions: ['bun', ...defaultClientConditions]
    },
    build: { write: false, minify: false },
    plugins: [openPencil(options)]
  })
  const outputs = Array.isArray(result) ? result : [result]
  return outputs.flatMap((output) => ('output' in output ? output.output : []))
}

function code(output: Output): string {
  return output
    .filter((item): item is Rolldown.OutputChunk => item.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
}

function assetNames(output: Output): string[] {
  return output.filter((item) => item.type === 'asset').map((item) => item.fileName)
}

async function expectEngineFiles(output: Output): Promise<void> {
  const assets = assetNames(output)
  const fonts = (await readdir(CORE_ASSETS)).filter((file) => /\.(?:ttf|woff2)$/.test(file))
  for (const file of ['canvaskit', 'harfbuzz-subset', ...fonts.map((f) => f.replace(/\..*$/, ''))])
    expect(assets.some((name) => new RegExp(`^assets/${file}-[\\w-]+\\.\\w+$`).test(name))).toBe(
      true
    )
}

describe('openPencil Vite plugin', () => {
  test('emits every engine file under base and points Core at them from the page', async () => {
    const output = await buildPage(undefined, { base: '/editor/' })
    await expectEngineFiles(output)

    const js = code(output)
    expect(js).toContain('/editor/assets/canvaskit-')
    expect(js).toContain('setBundledFontLocator')
    const html = output.find((item) => item.fileName === 'index.html')
    expect(html?.type === 'asset' ? String(html.source) : '').not.toContain('runtime-assets')
  }, 60_000)

  test('leaves the page alone without injection, and the app imports the module itself', async () => {
    const alone = await buildPage({ inject: false })
    expect(assetNames(alone).some((name) => name.includes('canvaskit'))).toBe(false)

    const imported = await buildPage(
      { inject: false },
      { main: `import '@open-pencil/core/runtime-assets/install'\n${LOAD_CANVASKIT}` }
    )
    await expectEngineFiles(imported)
    expect(code(imported)).toContain('/assets/canvaskit-')
  }, 60_000)
})
