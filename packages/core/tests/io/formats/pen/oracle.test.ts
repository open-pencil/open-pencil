import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'
import { once, pick } from 'es-toolkit'
import * as v from 'valibot'

import {
  createIconifyProvider,
  createIconSetsProvider,
  createMaterialSymbolsProvider,
  MATERIAL_SYMBOLS_PREFIXES
} from '@open-pencil/core/icons'
import { IORegistry, penFormat } from '@open-pencil/core/io'
import {
  comparePNGs,
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { fontManager, prepareGraphFonts, WEB_FONT_PROVIDER_IDS } from '@open-pencil/core/text'
import { parsePenDocument } from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'

// pen.dev's own exports of every frame in probes.pen, recorded with the fonts and icons they draw
// by `bun tools/generate/visual-oracles/src/cli.ts compare pen`.
const ORACLES = join(FIXTURES, 'pen-oracles')

const manifestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    document: v.string(),
    targets: v.array(
      v.object({
        node: v.string(),
        penNodeId: v.string(),
        maximumDifferentPercent: v.number(),
        note: v.optional(v.string())
      })
    )
  })
)

const iconSetSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({
    prefix: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    icons: v.record(v.string(), v.looseObject({ body: v.string() }))
  })
)

const manifest = v.parse(manifestSchema, await Bun.file(join(ORACLES, 'manifest.json')).text())
const source = await Bun.file(join(ORACLES, manifest.document)).text()

const googleIndexSchema = v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.string()))

/** Google's recorded answers for the Material Symbols the probes draw, served back by URL. */
async function recordedGoogle(input: RequestInfo | URL): Promise<Response> {
  const index = v.parse(
    googleIndexSchema,
    await Bun.file(join(ORACLES, 'google', 'index.json')).text()
  )
  const file = index[input instanceof Request ? input.url : String(input)]
  if (!file) return new Response(null, { status: 404 })
  return new Response(await Bun.file(join(ORACLES, 'google', file)).arrayBuffer())
}

/** Icons from the recorded Iconify sets and Google answers only. */
function recordedIcons() {
  return createIconSetsProvider({
    sources: [
      {
        prefixes: MATERIAL_SYMBOLS_PREFIXES,
        provider: createMaterialSymbolsProvider(
          Object.assign(recordedGoogle, { preconnect: fetch.preconnect })
        )
      }
    ],
    fallback: createIconifyProvider({
      async fetchCollection(prefix, names) {
        const file = Bun.file(join(ORACLES, 'iconify', `${prefix}.json`))
        if (!(await file.exists())) throw new Error(`No "${prefix}" icons were recorded`)
        const set = v.parse(iconSetSchema, await file.text())
        return { ...set, icons: pick(set.icons, names) }
      },
      search: () => Promise.resolve({ icons: [], total: 0, collections: {} }),
      collections: () => Promise.resolve([]),
      collectionIcons: () => Promise.resolve([])
    })
  })
}

const enabledProviders = fontManager.enabledOnlineFontProviders()

/** The probe document, read with the recorded faces and the bundled ones, never a download. */
const readProbes = once(async (): Promise<SceneGraph> => {
  fontManager.setOnlineFontProviders(
    Object.fromEntries(WEB_FONT_PROVIDER_IDS.map((id) => [id, false]))
  )
  fontManager.setDownloadedFontCache({
    async read(family, style) {
      const file = Bun.file(join(ORACLES, 'fonts', `${family}--${style}.font`))
      return (await file.exists()) ? file.arrayBuffer() : null
    },
    write: () => Promise.resolve()
  })
  const { graph } = await new IORegistry([penFormat]).readDocument(
    {
      name: manifest.document,
      data: new TextEncoder().encode(source),
      readAsset: (path) => Bun.file(join(ORACLES, path)).bytes()
    },
    { icons: recordedIcons() }
  )
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
  await prepareGraphFonts(
    graph,
    manifest.targets.map((target) => target.penNodeId)
  )
  return graph
})

afterAll(() => {
  fontManager.setDownloadedFontCache(null)
  fontManager.setOnlineFontProviders(
    Object.fromEntries(WEB_FONT_PROVIDER_IDS.map((id) => [id, enabledProviders.includes(id)]))
  )
})

describe('.pen frames against pen.dev', () => {
  test('every target is a frame of the probe document, exported by pen.dev', () => {
    const frames = new Set(parsePenDocument(source).children.map((node) => node.id))
    for (const { penNodeId } of manifest.targets) {
      expect(frames.has(penNodeId)).toBe(true)
      expect(existsSync(join(ORACLES, `${penNodeId}.png`))).toBe(true)
    }
  })

  for (const target of manifest.targets) {
    test(`${target.node} draws as pen.dev draws it`, async () => {
      const graph = await readProbes()
      const codec = createCanvasKitRasterCodec(await initCanvasKit())
      const pen = await Bun.file(join(ORACLES, `${target.penNodeId}.png`)).bytes()
      const ours = await headlessRenderNodes(graph, graph.getPages()[0].id, [target.penNodeId])
      expect(ours).not.toBeNull()
      const comparison = ours ? comparePNGs(codec, pen, ours) : null
      expect(comparison).not.toBeNull()
      if (!comparison) return
      const differentPercent = (100 * comparison.changedPixels) / comparison.totalPixels
      expect(differentPercent).toBeLessThanOrEqual(target.maximumDifferentPercent)
    })
  }
})
