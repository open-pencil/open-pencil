import { describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { corePackagePath } from '#core-tests/helpers/paths'
import { build, defaultClientConditions, type Rolldown } from 'vite'

import { openPencil, type OpenPencilPluginOptions } from '@open-pencil/core/node/vite'

const CORE_SOURCE = corePackagePath('src')
const CORE_ASSETS = corePackagePath('assets')

async function buildPage(options?: OpenPencilPluginOptions, base = '/') {
  // Real path: Vite names the page by its path relative to the root, which a symlinked temp dir breaks.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'open-pencil-vite-')))
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><head></head><body><script type="module" src="./main.js"></script></body></html>'
  )
  // The page loads CanvasKit, as an app does: a locator nothing reads is left out of the bundle.
  await writeFile(
    join(root, 'main.js'),
    "import { getCanvasKit } from '@open-pencil/core/canvaskit'\nwindow.loadCanvasKit = getCanvasKit\n"
  )
  const result = await build({
    root,
    base,
    logLevel: 'silent',
    configFile: false,
    // Workspace packages build from source, as tests run without their `dist`: Core through the
    // alias, the packages it imports through their `bun` export condition.
    resolve: {
      alias: [{ find: /^@open-pencil\/core\/(.*)$/, replacement: `${CORE_SOURCE}/$1` }],
      conditions: ['bun', ...defaultClientConditions]
    },
    build: { write: false, minify: false },
    plugins: [openPencil(options)]
  })
  const outputs = Array.isArray(result) ? result : [result]
  return outputs.flatMap((output) => ('output' in output ? output.output : []))
}

function code(output: Array<Rolldown.OutputChunk | Rolldown.OutputAsset>): string {
  return output
    .filter((item): item is Rolldown.OutputChunk => item.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
}

function assetNames(output: Array<Rolldown.OutputChunk | Rolldown.OutputAsset>): string[] {
  return output.filter((item) => item.type === 'asset').map((item) => item.fileName)
}

describe('openPencil Vite plugin', () => {
  test('emits the engine files under base and points Core at them from the page', async () => {
    const output = await buildPage(undefined, '/editor/')
    const assets = assetNames(output)
    const fonts = (await readdir(CORE_ASSETS)).filter((file) => /\.(?:ttf|woff2)$/.test(file))

    for (const file of [
      'canvaskit',
      'harfbuzz-subset',
      ...fonts.map((f) => f.replace(/\..*$/, ''))
    ])
      expect(assets.some((name) => new RegExp(`^assets/${file}-[\\w-]+\\.\\w+$`).test(name))).toBe(
        true
      )

    const js = code(output)
    expect(js).toContain('/editor/assets/canvaskit-')
    expect(js).toContain('setBundledFontLocator')
    const html = output.find((item) => item.fileName === 'index.html')
    expect(html?.type === 'asset' ? String(html.source) : '').not.toContain('virtual:open-pencil')
  }, 60_000)

  test('leaves the page alone when the app imports the module itself', async () => {
    const output = await buildPage({ inject: false })
    expect(assetNames(output).some((name) => name.includes('canvaskit'))).toBe(false)
  }, 60_000)
})
