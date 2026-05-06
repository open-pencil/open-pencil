#!/usr/bin/env bun
/**
 * Visual comparison pipeline: Figma vs OpenPencil renderer.
 *
 * Copy an element in Figma, then run:
 *   bun scripts/visual-compare.ts [--scale 2] [--output /tmp/visual-compare]
 *
 * Or pass a node ID directly (skips clipboard):
 *   bun scripts/visual-compare.ts --node 1:23 [--scale 2]
 *
 * Outputs:
 *   figma.png  — exported from real Figma
 *   ours.png   — rendered by OpenPencil headless SkiaRenderer
 *   diff.png   — visual diff (red = changed pixels)
 */

import { existsSync, mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { $ } from 'bun'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderNodesToImage, initCanvasKit } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/core/scene-graph'
import { loadFont } from '@open-pencil/core/text'

import { parseFigmaClipboard, importClipboardNodes } from '#core/clipboard'

const { values: opts } = parseArgs({
  options: {
    scale: { type: 'string', default: '2' },
    output: { type: 'string', short: 'o', default: '/tmp/visual-compare' },
    node: { type: 'string', short: 'n' }
  }
})

const scale = Number(opts.scale)
const outputDir = opts.output ?? '/tmp/visual-compare'
const figmaPath = `${outputDir}/figma.png`
const oursPath = `${outputDir}/ours.png`
const diffPath = `${outputDir}/diff.png`

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

if (opts.node) {
  await runWithNodeId(opts.node)
} else {
  await runWithClipboard()
}

// --- Mode 1: Clipboard ---

async function runWithClipboard() {
  console.log('📋 Reading clipboard…')
  const html = await readClipboardHtml()
  if (!html) bail('No HTML on clipboard. Copy an element in Figma first.')

  const parsed = await parseFigmaClipboard(html)
  if (!parsed) bail('Clipboard has no Figma data. Copy an element in Figma first.')
  console.log(`   ${parsed.nodes.length} node changes, ${parsed.blobs.length} blobs`)

  console.log('🖼️  Rendering with OpenPencil…')
  await renderOurs(html)

  console.log('🎨 Pasting into Figma & exporting…')
  await ensureFigmaConnected()
  await renderFigmaViaPaste()

  await diff()
}

// --- Mode 2: Node ID ---

async function runWithNodeId(nodeId: string) {
  await ensureFigmaConnected()

  console.log(`🎨 Exporting node ${nodeId} from Figma…`)
  await $`figma-use export node ${nodeId} --output ${figmaPath} --scale ${String(scale)}`.quiet()
  console.log(`   → ${figmaPath}`)

  console.log('📋 Exporting clipboard data from Figma…')
  // Select the node, copy, read clipboard, render with our engine
  await $`figma-use eval ${`(() => { const n = figma.getNodeById('${nodeId}'); if (n) { figma.currentPage.selection = [n]; } })()`}`.quiet()
  await Bun.sleep(200)
  await $`osascript -e 'tell application "Figma" to activate'`.quiet()
  await Bun.sleep(300)
  await $`osascript -e 'tell application "System Events" to keystroke "c" using command down'`.quiet()
  await Bun.sleep(1000)

  const html = await readClipboardHtml()
  if (!html) bail('Failed to copy from Figma')
  const parsed = await parseFigmaClipboard(html)
  if (!parsed) bail('Clipboard has no Figma data after copy')

  console.log('🖼️  Rendering with OpenPencil…')
  await renderOurs(html)

  await diff()
}

// --- Rendering ---

async function renderOurs(html: string) {
  const result = await parseFigmaClipboard(html)
  if (!result) throw new Error('Failed to parse clipboard')

  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  const createdIds = importClipboardNodes(result.nodes, graph, pageId, 0, 0, result.blobs)
  if (createdIds.length === 0) throw new Error('No nodes imported from clipboard')

  computeAllLayouts(graph)

  const families = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (node.fontFamily) families.add(node.fontFamily)
  }
  for (const family of families) {
    await loadFont(family)
  }

  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1
  renderer.viewportHeight = 1
  renderer.dpr = 1

  const data = renderNodesToImage(ck, renderer, graph, pageId, createdIds, {
    scale,
    format: 'PNG'
  })

  surface.delete()
  if (!data) throw new Error('Render produced no image')
  await Bun.write(oursPath, data)
  console.log(`   → ${oursPath}`)
}

async function renderFigmaViaPaste() {
  // Create temp page so we don't pollute the user's work
  await $`figma-use eval ${'(() => { const p = figma.createPage(); p.name = "__visual_compare__"; figma.currentPage = p; return p.id; })()'} --json`.quiet()

  try {
    // Activate Figma and paste
    await $`osascript -e 'tell application "Figma" to activate'`.quiet()
    await Bun.sleep(500)
    await $`osascript -e 'tell application "System Events" to keystroke "v" using command down'`.quiet()
    await Bun.sleep(2000)

    // Get pasted selection
    const selJson = await $`figma-use selection get --json`.quiet()
    const selection = JSON.parse(selJson.text().trim())
    if (!selection.length) throw new Error('Nothing pasted. Ensure clipboard has Figma data.')

    const nodeId = selection[0].id

    // Export from Figma
    await $`figma-use export node ${nodeId} --output ${figmaPath} --scale ${String(scale)}`.quiet()
    console.log(`   → ${figmaPath}`)
  } finally {
    // Clean up: remove temp page
    await $`figma-use eval ${'(() => { const ps = figma.root.children; const tmp = ps.find(p => p.name === "__visual_compare__"); if (tmp) { const other = ps.find(p => p !== tmp); if (other) figma.currentPage = other; tmp.remove(); } })()'}`
      .quiet()
      .nothrow()
  }
}

// --- Diff ---

async function diff() {
  console.log('🔍 Computing diff…')

  const figmaSize = (await $`identify -format '%wx%h' ${figmaPath}`.quiet()).text().trim()
  const oursSize = (await $`identify -format '%wx%h' ${oursPath}`.quiet()).text().trim()

  if (figmaSize !== oursSize) {
    console.log(`   ⚠ Size mismatch: Figma ${figmaSize}, Ours ${oursSize} → resizing`)
    await $`magick ${oursPath} -resize ${figmaSize}! ${oursPath}`.quiet()
  }

  const result =
    await $`magick compare -metric AE -highlight-color red -lowlight-color '#FFFFFF33' -compose src ${figmaPath} ${oursPath} ${diffPath}`
      .quiet()
      .nothrow()

  const diffPixels = parseInt(result.stderr.toString().trim(), 10) || 0
  const [w, h] = figmaSize.split('x').map(Number)
  const total = w * h
  const pct = ((diffPixels / total) * 100).toFixed(2)

  console.log(`   → ${diffPath}`)
  console.log(
    `   ${diffPixels.toLocaleString()} different pixels (${pct}% of ${total.toLocaleString()})`
  )
  console.log(`\n✅ Done! Images in ${outputDir}/`)
}

// --- Helpers ---

async function readClipboardHtml(): Promise<string | null> {
  const proc = Bun.spawn(
    [
      'swift',
      '-e',
      'import AppKit; if let h = NSPasteboard.general.string(forType: .html) { print(h) } else { exit(1) }'
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const text = await new Response(proc.stdout).text()
  return (await proc.exited) === 0 ? text.trim() : null
}

async function ensureFigmaConnected() {
  const s = await $`figma-use status`.quiet().nothrow()
  if (s.exitCode !== 0) {
    bail(
      'figma-use not connected. Start Figma with:\n  open -a Figma --args --remote-debugging-port=9222'
    )
  }
}

function bail(msg: string): never {
  console.error(msg)
  process.exit(1)
}
