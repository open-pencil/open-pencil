import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { SceneGraph } from '#core/scene-graph'
import { fontManager } from '#core/text'

async function main() {
  const ck = await initCanvasKit()

  // Initialize font service
  const fontProvider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, fontProvider)

  const fontPath = join(process.cwd(), 'public/Inter-SemiBold.ttf')
  const fontData = await readFile(fontPath)
  fontManager.markLoaded(
    'Inter',
    'SemiBold',
    fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength)
  )

  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  const width = 400
  const height = 400

  // Create a text node with an inner shadow
  // We use a large 'O' to have a clear counter
  const textProps = {
    text: 'O',
    fontSize: 300,
    fontFamily: 'Inter',
    fontWeight: 600,
    x: 50,
    y: 50,
    width: 300,
    height: 300,
    visible: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
    effects: [
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 40, y: 0 }, // Significant horizontal shift to the right
        radius: 0, // Hard edge
        spread: 0
      }
    ]
  }

  const textNode = graph.createNode('TEXT', pageId, textProps as any)
  const nodeId = textNode.id

  const surface = ck.MakeSurface(width, height)!
  const canvas = surface.getCanvas()
  const renderer = new SkiaRenderer(ck, surface)
  renderer.fontProvider = fontProvider
  renderer.fontsLoaded = true

  // Clear background to a distinct color (e.g., blue) to distinguish from text (white) and shadow (black)
  canvas.clear(ck.Color4f(0, 0, 1, 1))

  renderer.renderSceneToCanvas(canvas, graph, pageId)
  surface.flush()

  const pixels = surface.getCanvas().readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  }) as Uint8Array

  function getPixel(x: number, y: number) {
    const idx = (y * width + x) * 4
    return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
  }

  // Find the horizontal center line
  const centerY = Math.floor(height / 2)

  // Scan the center line to find the 'O' boundaries
  // Background (Blue) | Left Stem (White/Shadow) | Counter (Blue) | Right Stem (White/Shadow) | Background (Blue)

  let transitions = []
  let lastColor = ''
  for (let x = 0; x < width; x++) {
    const p = getPixel(x, centerY)
    const color = p[0] > 200 ? 'white' : p[2] > 200 ? 'blue' : 'black'
    if (color !== lastColor) {
      transitions.push({ x, color })
      lastColor = color
    }
  }

  console.log('Transitions at centerY:', transitions)

  // Expected transitions for a physically correct inner shadow (light from left):
  // 1. blue -> black (left outer edge, shadow starts)
  // 2. black -> white (left stem shadow ends)
  // 3. white -> blue (left inner edge, counter structural island starts - illuminated)
  // 4. blue -> black (RIGHT inner edge, shadow cast from structural drop-off into right stem)
  // 5. black -> white (right stem shadow ends)
  // 6. white -> blue (right outer edge, end)

  // We are specifically looking for a black pixel transition AFTER the halfway point,
  // indicating the right inner wall of the counter is physically casting a shadow.
  const hasShadowOnRightInnerEdge = transitions.some((t) => t.color === 'black' && t.x > width / 2)

  // Save image for inspection
  const image = surface.makeImageSnapshot()
  const data = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  if (data) {
    await Bun.write('scratch/escher-trap-detected.png', data)
    console.log('Saved scratch/escher-trap-detected.png')
  }
  surface.delete()

  if (!hasShadowOnRightInnerEdge) {
    console.error('❌ FAILED: Missing shadow on the right inner edge of the counter.')
    console.error(
      'The renderer has fallen into the Escher Trap and failed to model physical drop-off geometry.'
    )
    process.exit(1)
  } else {
    console.log(
      '✅ PASSED: Physically accurate shadow detected on the right inner edge of the counter'
    )
    process.exit(0)
  }
}

main()
