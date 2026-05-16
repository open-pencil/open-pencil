import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { renderNodesToImage } from '#core/io/formats/raster'
import { SceneGraph } from '#core/scene-graph'
import type { SceneNode } from '#core/scene-graph'
import { fontManager } from '#core/text'
import type { Color, Vector } from '#core/types'

import { expectDefined } from '#tests/helpers/assert'

interface TestCase {
  text: string
  fontSize: number
  offset: Vector
  radius: number
  spread: number
  color: Color
}

function generateMatrix(): TestCase[] {
  const cases: TestCase[] = []

  const offsets: Vector[] = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: -5, y: 5 },
    { x: 50, y: 0 }
  ]

  const radii = [0, 4, 10, 20, 100]
  const spreads = [0, 5, 10]
  const colors = [
    { r: 0, g: 0, b: 0, a: 0.5 },
    { r: 0, g: 0, b: 0, a: 1.0 }
  ]

  // Core matrix: each text/offset/radius/spread combination with black@1.0
  for (const font of [
    { text: 'O', size: 48 },
    { text: 'N', size: 48 },
    { text: 'M', size: 48 },
    { text: 'Shadow', size: 48 }
  ]) {
    for (const offset of offsets) {
      for (const radius of radii) {
        cases.push({
          text: font.text,
          fontSize: font.size,
          offset,
          radius,
          spread: 0,
          color: { r: 0, g: 0, b: 0, a: 1.0 }
        })
      }
    }
  }

  // Spread variants on 'N' at medium offset
  for (const spread of spreads) {
    for (const radius of radii) {
      cases.push({
        text: 'N',
        fontSize: 48,
        offset: { x: 10, y: 10 },
        radius,
        spread,
        color: { r: 0, g: 0, b: 0, a: 1.0 }
      })
    }
  }

  // Alpha variants on 'O'
  for (const color of colors) {
    for (const radius of radii) {
      cases.push({
        text: 'O',
        fontSize: 48,
        offset: { x: 10, y: 10 },
        radius,
        spread: 0,
        color
      })
    }
  }

  // Font size sweep on 'Shadow Test'
  const fontSizes = [12, 24, 48, 80, 120]
  for (const size of fontSizes) {
    cases.push({
      text: 'Shadow',
      fontSize: size,
      offset: { x: 4, y: 4 },
      radius: 10,
      spread: 0,
      color: { r: 0, g: 0, b: 0, a: 1.0 }
    })
  }

  // Dot glyph ('i') variants
  for (const offset of offsets.slice(0, 2)) {
    for (const radius of [0, 10, 20]) {
      cases.push({
        text: 'i',
        fontSize: 60,
        offset,
        radius,
        spread: 0,
        color: { r: 0, g: 0, b: 0, a: 1.0 }
      })
    }
  }

  // Negative spread edge case
  for (const spread of [-5]) {
    cases.push({
      text: 'N',
      fontSize: 48,
      offset: { x: 5, y: 5 },
      radius: 10,
      spread,
      color: { r: 0, g: 0, b: 0, a: 1.0 }
    })
  }

  return cases
}

function slugify(tc: TestCase, index: number): string {
  const offsetStr = `ox${tc.offset.x}_oy${tc.offset.y}`
  const parts = [
    String(index).padStart(3, '0'),
    tc.text.replace(/ /g, '_'),
    `fs${tc.fontSize}`,
    offsetStr,
    `r${tc.radius}`,
    `sp${tc.spread}`,
    `a${tc.color.a}`
  ]
  return parts.join('-')
}

async function main() {
  const ck = await initCanvasKit()

  const fontProvider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, fontProvider)

  const fontPath = join(process.cwd(), 'public/Inter-SemiBold.ttf')
  const fontData = await readFile(fontPath)
  fontManager.markLoaded(
    'Inter',
    'SemiBold',
    fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength)
  )

  const outputDir = join(process.cwd(), 'scratch/sdf-matrix')
  await mkdir(outputDir, { recursive: true })

  const matrix = generateMatrix()
  console.warn(`Generated ${matrix.length} test cases`)

  let generated = 0
  let failed = 0

  for (let i = 0; i < matrix.length; i++) {
    const tc = matrix[i]
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id

    const textProps = {
      text: tc.text,
      fontSize: tc.fontSize,
      fontFamily: 'Inter',
      fontWeight: 600,
      x: 20,
      y: 40,
      width: tc.fontSize * tc.text.length * 0.7 + 40,
      height: tc.fontSize * 1.4,
      visible: true,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0.8, b: 0, a: 1 },
          visible: true,
          opacity: 1
        }
      ],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: tc.color,
          offset: tc.offset,
          radius: tc.radius,
          spread: tc.spread
        }
      ]
    } satisfies Partial<SceneNode>

    const textNode = graph.createNode('TEXT', pageId, textProps)

    const surfW = Math.ceil(textProps.width) + 40
    const surfH = Math.ceil(textProps.height) + 40
    const surface = expectDefined(ck.MakeSurface(surfW, surfH), 'CanvasKit surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.fontProvider = fontProvider
    renderer.fontsLoaded = true

    const data = renderNodesToImage(ck, renderer, graph, pageId, [textNode.id], {
      scale: 2,
      format: 'PNG'
    })

    const filename = slugify(tc, i) + '.png'
    const filepath = join(outputDir, filename)

    if (data && data.length > 500) {
      await Bun.write(filepath, data)
      generated++
    } else {
      failed++
      console.warn(`  SKIP ${filename}: no image data`)
    }

    // Clean up all WASM objects per iteration.
    // Null the shared fontProvider so destroy() won't delete it (it's reused across iterations).
    // textFont is per-renderer (created in constructor) — destroy() deletes it correctly.
    // fontMgr/labelFont/sizeFont are null (only created in loadFonts(), which we bypassed
    // by setting fontsLoaded=true and manually assigning the shared fontProvider).
    renderer.fontProvider = null
    renderer.destroy()
  }

  console.warn(`\nResult: ${generated} generated, ${failed} failed out of ${matrix.length}`)
}

main()
