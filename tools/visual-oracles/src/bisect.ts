#!/usr/bin/env bun

import { existsSync, mkdirSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'

import { $ } from 'bun'

import { parseColor } from '@open-pencil/core/color'
import { headlessRenderNodes, initCanvasKit, parseFigFile } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/core/scene-graph'

interface DiffMetrics {
  mean: number
  above5: number
  above10: number
  above20: number
  above40: number
  above80: number
}

interface BisectResult {
  depth: number
  indices: number[]
  names: string[]
  metrics: DiffMetrics
  figmaPath: string
  openPencilPath: string
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    page: { type: 'string', short: 'p' },
    'figma-page-id': { type: 'string' },
    output: { type: 'string', short: 'o', default: '/tmp/open-pencil-visual-bisect' },
    scale: { type: 'string', default: '1' },
    threshold: { type: 'string', default: '0.25' },
    depth: { type: 'string', default: '8' },
    'min-size': { type: 'string', default: '1' },
    background: { type: 'string', default: '#f9f9f9' },
    'root-node-id': { type: 'string' },
    'figma-root-id': { type: 'string' }
  }
})

const figPath = positionals[0]
if (!figPath || !values.page || !values['figma-page-id']) {
  console.error(`Usage:
  bun scripts/visual-bisect.ts <file.fig> --page Primitives --figma-page-id 1:22 [options]

Options:
  --output DIR          Output directory (default: /tmp/open-pencil-visual-bisect)
  --scale N             Export scale (default: 1)
  --threshold PERCENT   Stop splitting groups under this >40 diff percent (default: 0.25)
  --depth N             Max bisection depth (default: 8)
  --min-size N          Stop splitting groups at this child count (default: 1)
  --background HEX      Matte color for transparent pixels (default: #f9f9f9)
  --root-node-id ID     OpenPencil node whose children should be bisected
  --figma-root-id ID    Matching Figma node whose children should be bisected

What it does:
  It hides all top-level page children except a candidate subset in both Figma
  and OpenPencil, exports that subset from both renderers, diffs the images,
  then recursively splits only subsets that still differ. This isolates which
  top-level page children introduce visual differences without staring at the
  full-page diff.`)
  process.exit(1)
}

const pageName = values.page
const figmaPageId = values['figma-page-id']
const outputDir = values.output ?? '/tmp/open-pencil-visual-bisect'
const scale = Number(values.scale ?? '1')
const threshold = Number(values.threshold ?? '0.25')
const maxDepth = Number(values.depth ?? '8')
const minSize = Number(values['min-size'] ?? '1')
const matteColor = colorBytes(values.background ?? '#f9f9f9')

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

const graph = await loadGraph(figPath, pageName)
const page = graph.getPages().find((candidate) => candidate.name === pageName)
if (!page) throw new Error(`Page not found in .fig: ${pageName}`)
const rootNodeId = values['root-node-id'] ?? page.id
const figmaRootId = values['figma-root-id'] ?? figmaPageId
const rootNode = graph.getNode(rootNodeId)
if (!rootNode) throw new Error(`Root node not found in .fig: ${rootNodeId}`)
const childIds = [...rootNode.childIds]
const childNames = childIds.map((id) => graph.getNode(id)?.name ?? id)

console.log(`Visual bisect: ${basename(figPath)} / ${pageName}`)
console.log(`Root: ${rootNode.name} (${rootNode.id})`)
console.log(`Children: ${childIds.length}`)
console.log(`Output: ${outputDir}`)

const initialVisibility = await captureFigmaVisibility(figmaRootId)
const results: BisectResult[] = []

try {
  await bisect(
    childIds.map((_, index) => index),
    0
  )
} finally {
  await restoreFigmaVisibility(figmaRootId, initialVisibility)
}

results.sort((a, b) => b.metrics.above40 - a.metrics.above40 || a.indices.length - b.indices.length)
await writeReport(results)

console.log('\nTop suspects:')
for (const result of results.slice(0, 12)) {
  console.log(
    `${result.indices.join(',')} | >40 ${result.metrics.above40.toFixed(3)}% | ${result.names.join(' / ')}`
  )
}
console.log(`\nReport: ${outputDir}/report.md`)

async function loadGraph(path: string, targetPageName: string): Promise<SceneGraph> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
  const parsed = await parseFigFile(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    {
      populate: 'all'
    }
  )
  const targetPage = parsed.getPages().find((candidate) => candidate.name === targetPageName)
  if (targetPage) computeAllLayouts(parsed, targetPage.id)
  return parsed
}

async function bisect(indices: number[], depth: number): Promise<void> {
  if (indices.length === 0 || depth > maxDepth) return

  const result = await compareSubset(indices, depth)
  const label = `[depth ${depth}] [${indices.join(',')}] >40=${result.metrics.above40.toFixed(3)}% ${result.names.join(' / ')}`
  console.log(label)

  if (result.metrics.above40 <= threshold) return
  results.push(result)

  if (indices.length <= minSize) return
  const mid = Math.floor(indices.length / 2)
  await bisect(indices.slice(0, mid), depth + 1)
  await bisect(indices.slice(mid), depth + 1)
}

async function compareSubset(indices: number[], depth: number): Promise<BisectResult> {
  const stem = `d${depth}-${indices[0]}-${indices.at(-1)}-${indices.length}`
  const figmaPath = `${outputDir}/${stem}-figma.png`
  const openPencilPath = `${outputDir}/${stem}-open-pencil.png`

  await exportFigmaSubset(figmaRootId, indices, figmaPath)
  await exportOpenPencilSubset(indices, openPencilPath)

  return {
    depth,
    indices,
    names: indices.map((index) => childNames[index]),
    metrics: await diffImages(figmaPath, openPencilPath),
    figmaPath,
    openPencilPath
  }
}

async function exportOpenPencilSubset(indices: number[], path: string): Promise<void> {
  const indexSet = new Set(indices)
  const changed: Array<{ id: string; visible: boolean }> = []
  for (let index = 0; index < childIds.length; index++) {
    const node = graph.getNode(childIds[index])
    if (!node) continue
    changed.push({ id: node.id, visible: node.visible })
    node.visible = indexSet.has(index)
  }

  try {
    const nodeIds =
      rootNode.type === 'CANVAS' ? indices.map((index) => childIds[index]) : [rootNode.id]
    const data = await headlessRenderNodes(graph, page.id, nodeIds, {
      scale,
      format: 'PNG',
      trimTransparent: nodeIds.every((id) => graph.getNode(id)?.type === 'TEXT')
    })
    if (!data) throw new Error(`OpenPencil render produced no image for ${indices.join(',')}`)
    await Bun.write(path, data)
  } finally {
    for (const entry of changed) {
      const node = graph.getNode(entry.id)
      if (node) node.visible = entry.visible
    }
  }
}

async function exportFigmaSubset(pageId: string, indices: number[], path: string): Promise<void> {
  await setFigmaVisibleIndices(pageId, indices)
  await $`figma-use export node ${pageId} --output ${path} --scale ${String(scale)}`.quiet()
}

async function captureFigmaVisibility(pageId: string): Promise<boolean[]> {
  const code = `
    const node = figma.getNodeById(${JSON.stringify(pageId)});
    if (!node || !('children' in node)) throw new Error('Node has no children: ${pageId}');
    return node.children.map((child) => child.visible);
  `
  const out = await $`figma-use eval ${code} --json`.quiet()
  return JSON.parse(out.text().trim())
}

async function setFigmaVisibleIndices(pageId: string, indices: number[]): Promise<void> {
  const code = `
    const visible = new Set(${JSON.stringify(indices)});
    const node = figma.getNodeById(${JSON.stringify(pageId)});
    if (!node || !('children' in node)) throw new Error('Node has no children: ${pageId}');
    node.children.forEach((child, index) => { child.visible = visible.has(index); });
  `
  await $`figma-use eval ${code}`.quiet()
}

async function restoreFigmaVisibility(pageId: string, visibility: boolean[]): Promise<void> {
  const code = `
    const visibility = ${JSON.stringify(visibility)};
    const node = figma.getNodeById(${JSON.stringify(pageId)});
    if (!node || !('children' in node)) return;
    node.children.forEach((child, index) => { child.visible = visibility[index] ?? child.visible; });
  `
  await $`figma-use eval ${code}`.quiet().nothrow()
}

async function diffImages(expectedPath: string, actualPath: string): Promise<DiffMetrics> {
  const ck = await initCanvasKit()
  const expected = ck.MakeImageFromEncoded(await Bun.file(expectedPath).bytes())
  const actual = ck.MakeImageFromEncoded(await Bun.file(actualPath).bytes())
  if (!expected || !actual) throw new Error('Failed to decode PNGs')

  try {
    const width = Math.min(expected.width(), actual.width())
    const height = Math.min(expected.height(), actual.height())
    const imageInfo = {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }
    const expectedPixels = expected.readPixels(0, 0, imageInfo)
    const actualPixels = actual.readPixels(0, 0, imageInfo)
    if (!expectedPixels || !actualPixels) throw new Error('Failed to read image pixels')

    let sum = 0
    let above5 = 0
    let above10 = 0
    let above20 = 0
    let above40 = 0
    let above80 = 0
    const total = width * height
    const bg = matteColor
    for (let pixel = 0; pixel < total; pixel++) {
      const offset = pixel * 4
      const expectedRgb = compositeRgb(expectedPixels, offset, bg)
      const actualRgb = compositeRgb(actualPixels, offset, bg)
      const dr = Math.abs(expectedRgb[0] - actualRgb[0])
      const dg = Math.abs(expectedRgb[1] - actualRgb[1])
      const db = Math.abs(expectedRgb[2] - actualRgb[2])
      const max = Math.max(dr, dg, db)
      sum += dr + dg + db
      if (max > 5) above5++
      if (max > 10) above10++
      if (max > 20) above20++
      if (max > 40) above40++
      if (max > 80) above80++
    }

    return {
      mean: sum / total,
      above5: (above5 / total) * 100,
      above10: (above10 / total) * 100,
      above20: (above20 / total) * 100,
      above40: (above40 / total) * 100,
      above80: (above80 / total) * 100
    }
  } finally {
    expected.delete()
    actual.delete()
  }
}

async function writeReport(items: BisectResult[]): Promise<void> {
  const lines = [
    `# Visual bisect report`,
    ``,
    `- File: ${figPath}`,
    `- Page: ${pageName}`,
    `- Figma page id: ${figmaPageId}`,
    `- Scale: ${scale}`,
    `- Threshold (>40): ${threshold}%`,
    ``,
    `| depth | indices | >40 | >20 | mean | names | images |`,
    `|---:|---|---:|---:|---:|---|---|`
  ]

  for (const item of items) {
    lines.push(
      `| ${item.depth} | ${item.indices.join(',')} | ${item.metrics.above40.toFixed(3)}% | ${item.metrics.above20.toFixed(3)}% | ${item.metrics.mean.toFixed(3)} | ${item.names.map(escapePipes).join('<br>')} | [figma](${item.figmaPath}) / [open-pencil](${item.openPencilPath}) |`
    )
  }

  await Bun.write(`${outputDir}/report.md`, `${lines.join('\n')}\n`)
}

function colorBytes(input: string): readonly [number, number, number] {
  const color = parseColor(input)
  return [color.r * 255, color.g * 255, color.b * 255]
}

function compositeRgb(
  pixels: Uint8Array,
  offset: number,
  bg: readonly [number, number, number]
): [number, number, number] {
  const alpha = pixels[offset + 3] / 255
  if (alpha >= 1) return [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
  if (alpha <= 0) return [bg[0], bg[1], bg[2]]
  return [
    pixels[offset] * alpha + bg[0] * (1 - alpha),
    pixels[offset + 1] * alpha + bg[1] * (1 - alpha),
    pixels[offset + 2] * alpha + bg[2] * (1 - alpha)
  ]
}

function escapePipes(value: string): string {
  return value.replaceAll('|', '\\|')
}
