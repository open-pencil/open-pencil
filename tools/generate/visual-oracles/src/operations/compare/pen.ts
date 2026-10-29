#!/usr/bin/env bun
/**
 * pen.dev oracle: exports the frames listed in the fixtures' manifest.json from the document open
 * in pen.dev, renders the same frames with OpenPencil, and records what the comparison in CI needs
 * to run offline.
 *
 * Open the probe document in pen.dev, then run:
 *   bun tools/generate/visual-oracles/src/cli.ts compare pen ~/.pencil/documents/<id>/untitled.pen
 *
 * Replaces the fixture folder (tests/fixtures/pen-oracles by default) with:
 *   probes.pen and its images    — the document
 *   <frame id>.png               — pen.dev's export of each frame, at scale 1
 *   iconify/<prefix>.json        — the Iconify icons the document draws, as Iconify sets
 *   google/                      — Google's answers for its Material Symbols, by URL in index.json
 *   fonts/<family>--<style>.font — the font faces its text is drawn with
 * keeping manifest.json, and writes pen.png, openpencil.png, diff.png, and metrics.json per frame
 * to --output.
 */

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { groupBy, omit, pick } from 'es-toolkit'
import * as v from 'valibot'

import {
  createIconifyProvider,
  createIconSetsProvider,
  createMaterialSymbolsProvider,
  MATERIAL_SYMBOLS_PREFIXES,
  parseIconName
} from '@open-pencil/core/icons'
import { IORegistry, penFormat } from '@open-pencil/core/io'
import {
  comparePNGs,
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { fontManager, prepareGraphFonts } from '@open-pencil/core/text'
import {
  isDocumentAssetPath,
  parsePenDocument,
  penAssets,
  type PenNode,
  type PenOverride
} from '@open-pencil/pen'

const PEN_MCP_SERVER =
  '/Applications/Pen.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64'
const ICONIFY_API = 'https://api.iconify.design'
const EXPORT_TIMEOUT_MS = 300_000

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
type IconSet = v.InferOutput<typeof iconSetSchema>

const savedDocumentSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ children: v.array(v.looseObject({ id: v.string() })) })
)
const manifestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ targets: v.array(v.looseObject({ penNodeId: v.string() })) })
)

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    fixtures: { type: 'string', default: 'tests/fixtures/pen-oracles' },
    output: { type: 'string', short: 'o', default: '/tmp/open-pencil-pen-oracle' },
    server: { type: 'string', default: PEN_MCP_SERVER }
  }
})
const source = positionals[0]
if (!source) {
  console.error(
    'Usage: bun tools/generate/visual-oracles/src/cli.ts compare pen <document open in pen.dev> [--fixtures DIR] [--output DIR]'
  )
  process.exit(1)
}

const fixtures = resolve(values.fixtures)
const output = resolve(values.output)
const { targets } = v.parse(manifestSchema, await Bun.file(join(fixtures, 'manifest.json')).text())
const wanted = new Set(targets.map((target) => target.penNodeId))
// The fixture keeps the manifest's frames and the components they use, and drops the `fileToken`
// pen.dev stamps each saved file with.
const saved = v.parse(savedDocumentSchema, await Bun.file(source).text())
const kept = withComponents(parsePenDocument(JSON.stringify(saved)).children, wanted)
const text = `${JSON.stringify(
  { ...omit(saved, ['fileToken']), children: saved.children.filter((node) => kept.has(node.id)) },
  null,
  2
)}\n`
const doc = parsePenDocument(text)
const frames = doc.children.filter((node) => wanted.has(node.id))
const missing = [...wanted].filter((id) => !frames.some((frame) => frame.id === id))
if (missing.length > 0) throw new Error(`The document has no top-level ${missing.join(', ')}`)
const assets = penAssets(doc)

// pen.dev exports first, so a failed export leaves the fixtures as they were, and into a
// directory of its own, which clearing the fixtures cannot reach.
const exported = mkdtempSync(join(tmpdir(), 'pen-export-'))
try {
  await exportFromPen(
    source,
    frames.map((frame) => frame.id),
    exported
  )
  clearFixtures()
  writeFileSync(join(fixtures, 'probes.pen'), text)
  for (const image of assets.images.filter(isDocumentAssetPath)) {
    mkdirSync(dirname(join(fixtures, image)), { recursive: true })
    copyFileSync(join(dirname(source), image), join(fixtures, image))
  }
  for (const frame of frames) {
    copyFileSync(join(exported, `${frame.id}.png`), join(fixtures, `${frame.id}.png`))
  }
} finally {
  rmSync(exported, { recursive: true, force: true })
}

const iconifyNames = assets.icons
  .map((request) => request.name)
  .filter((name) => !MATERIAL_SYMBOLS_PREFIXES.some((prefix) => name.startsWith(`${prefix}:`)))
const iconSets = await fetchIconSets(iconifyNames)
for (const set of iconSets.values()) {
  writeFileSync(
    join(fixtures, 'iconify', `${set.prefix}.json`),
    `${JSON.stringify(set, null, 2)}\n`
  )
}
const fonts = new Map<string, { data: ArrayBuffer }>()
fontManager.setDownloadedFontCache({
  read: () => Promise.resolve(null),
  write(family, style, data) {
    fonts.set(`${family}--${style}`, { data })
    return Promise.resolve()
  }
})

// Google's answers for the Material Symbols the document draws, kept to be served back offline.
const google = new Map<string, Uint8Array>()
const recordingFetch: typeof fetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init)
    const url = input instanceof Request ? input.url : String(input)
    if (response.ok) google.set(url, await response.clone().bytes())
    return response
  },
  { preconnect: fetch.preconnect }
)
const icons = createIconSetsProvider({
  sources: [
    {
      prefixes: MATERIAL_SYMBOLS_PREFIXES,
      provider: createMaterialSymbolsProvider(recordingFetch)
    }
  ],
  fallback: createIconifyProvider({
    fetchCollection: (prefix, names) => {
      const set = iconSets.get(prefix)
      if (!set) return Promise.reject(new Error(`No "${prefix}" icons were recorded`))
      return Promise.resolve({ ...set, icons: pick(set.icons, names) })
    },
    search: () => Promise.resolve({ icons: [], total: 0, collections: {} }),
    collections: () => Promise.resolve([]),
    collectionIcons: () => Promise.resolve([])
  })
})
const { graph } = await new IORegistry([penFormat]).readDocument(
  {
    name: 'probes.pen',
    data: new TextEncoder().encode(text),
    readAsset: (path) => Bun.file(join(fixtures, path)).bytes()
  },
  { icons }
)
graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
const pageId = graph.getPages()[0].id
await prepareGraphFonts(
  graph,
  frames.map((frame) => frame.id)
)

const codec = createCanvasKitRasterCodec(await initCanvasKit())
for (const frame of frames) {
  const name = frame.name ?? frame.id
  const dir = join(output, frame.id)
  mkdirSync(dir, { recursive: true })
  const pen = await Bun.file(join(fixtures, `${frame.id}.png`)).bytes()
  writeFileSync(join(dir, 'pen.png'), pen)
  const ours = await headlessRenderNodes(graph, pageId, [frame.id])
  if (!ours) {
    console.log(`${name} (${frame.id}): OpenPencil rendered nothing`)
    continue
  }
  writeFileSync(join(dir, 'openpencil.png'), ours)
  const comparison = comparePNGs(codec, pen, ours)
  const differentPercent = comparison
    ? (100 * comparison.changedPixels) / comparison.totalPixels
    : 100
  if (comparison?.mask) writeFileSync(join(dir, 'diff.png'), comparison.mask)
  writeFileSync(
    join(dir, 'metrics.json'),
    `${JSON.stringify({ id: frame.id, name, differentPercent }, null, 2)}\n`
  )
  console.log(`${name} (${frame.id}): ${differentPercent.toFixed(2)}% pixels differ`)
}

for (const [face, { data }] of fonts) {
  writeFileSync(join(fixtures, 'fonts', `${face}.font`), new Uint8Array(data))
}
const index = Object.fromEntries([...google.keys()].map((url, at) => [url, `${at}.bin`]))
for (const [url, bytes] of google) writeFileSync(join(fixtures, 'google', index[url]), bytes)
writeFileSync(join(fixtures, 'google', 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(
  `Recorded ${iconSets.size} icon sets, ${google.size} Google answers, and ${fonts.size} font faces in ${fixtures}`
)

/** Empties the fixture folder except its manifest, which holds the comparison's thresholds. */
function clearFixtures() {
  mkdirSync(fixtures, { recursive: true })
  for (const entry of readdirSync(fixtures)) {
    if (entry !== 'manifest.json') rmSync(join(fixtures, entry), { recursive: true, force: true })
  }
  mkdirSync(join(fixtures, 'iconify'))
  mkdirSync(join(fixtures, 'google'))
  mkdirSync(join(fixtures, 'fonts'))
  mkdirSync(output, { recursive: true })
}

/** The IDs of `ids` and of every top-level node holding a component they use, at any depth. */
function withComponents(nodes: readonly PenNode[], ids: ReadonlySet<string>): Set<string> {
  const owners = new Map<string, string>()
  const refs = new Map<string, string[]>()
  const visit = (node: PenOverride, top: string) => {
    if (node.id) owners.set(node.id, top)
    if (node.ref) refs.get(top)?.push(node.ref)
    for (const child of node.children ?? []) visit(child, top)
    for (const override of Object.values(node.descendants ?? {})) visit(override, top)
  }
  for (const node of nodes) {
    refs.set(node.id, [])
    visit(node, node.id)
  }
  const kept = new Set(ids)
  for (const id of kept) {
    for (const ref of refs.get(id) ?? []) {
      const owner = owners.get(ref)
      if (owner) kept.add(owner)
    }
  }
  return kept
}

/** Exports frames from the document open in pen.dev, through pen.dev's MCP server. */
async function exportFromPen(document: string, frameIds: string[], directory: string) {
  const client = new Client({ name: 'open-pencil-pen-oracle', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({ command: values.server, args: ['--app', 'desktop'] })
  )
  try {
    const result = await client.callTool(
      {
        name: 'execute',
        arguments: {
          filePath: document,
          input: `Export(${JSON.stringify(frameIds)}, "png", ${JSON.stringify(directory)}, { scale: 1 })`
        }
      },
      // Exporting every frame takes pen.dev a while.
      { timeout: EXPORT_TIMEOUT_MS }
    )
    if (result.isError) throw new Error(`pen.dev export failed: ${JSON.stringify(result.content)}`)
  } finally {
    await client.close()
  }
}

/** The Iconify sets holding `names`, each with just the icons named from it. */
async function fetchIconSets(names: readonly string[]): Promise<Map<string, IconSet>> {
  const byPrefix = groupBy(
    names.flatMap((name) => parseIconName(name) ?? []),
    (icon) => icon.prefix
  )
  const sets = new Map<string, IconSet>()
  for (const [prefix, icons] of Object.entries(byPrefix)) {
    const query = icons.map((icon) => icon.iconName).join(',')
    const response = await fetch(`${ICONIFY_API}/${prefix}.json?icons=${query}`)
    if (!response.ok) throw new Error(`Iconify answered ${response.status} for "${prefix}"`)
    sets.set(prefix, v.parse(iconSetSchema, await response.text()))
  }
  return sets
}
