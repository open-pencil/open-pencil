import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { renderNodesToImage } from '#core/io/formats/raster'
import { SceneGraph } from '#core/scene-graph'
import type { SceneNode } from '#core/scene-graph'
import { fontManager } from '#core/text'

import { expectDefined } from '#tests/helpers/assert'

async function main() {
  const ck = await initCanvasKit()

  // Initialize font service
  const fontProvider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, fontProvider)

  // Load Inter font from public dir
  const fontPath = join(process.cwd(), 'public/Inter-SemiBold.ttf')
  console.warn('Loading font from:', fontPath)
  const fontData = await readFile(fontPath)
  fontManager.markLoaded(
    'Inter',
    'SemiBold',
    fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength)
  )

  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  // Create a text node with an inner shadow
  const textProps = {
    text: 'INNER SHADOW',
    fontSize: 80,
    fontFamily: 'Inter',
    fontWeight: 600, // SemiBold
    x: 50,
    y: 100,
    width: 700,
    height: 100,
    visible: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0.8, b: 0, a: 1 }, visible: true, opacity: 1 }],
    effects: [
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.8 },
        offset: { x: 4, y: 4 },
        radius: 10,
        spread: 0
      }
    ]
  } satisfies Partial<SceneNode>

  const textNode = graph.createNode('TEXT', pageId, textProps)
  const nodeId = textNode.id

  const surface = expectDefined(ck.MakeSurface(800, 300), 'CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.fontProvider = fontProvider
  renderer.fontsLoaded = true

  console.warn('Node created:', nodeId)
  console.warn('Font loaded for node:', renderer.isNodeFontLoaded(textNode))
  console.warn('Absolute position:', graph.getAbsolutePosition(nodeId))

  // Render with scale 2
  const data = renderNodesToImage(ck, renderer, graph, pageId, [nodeId], {
    scale: 2,
    format: 'PNG'
  })
  await Bun.write('scratch/text-inner-shadow-verification.png', data)
  surface.delete()

  if (data && data.length > 2000) {
    console.warn(`✅ Generated scratch/text-inner-shadow-verification.png (${data.length} bytes)`)
  } else {
    console.error(`❌ Failed to generate useful image (size: ${data?.length ?? 0} bytes)`)
    if (data) {
      await Bun.write('scratch/failed.png', data)
    }
  }
}

main()
