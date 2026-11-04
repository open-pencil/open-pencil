import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { strFromU8, unzipSync } from 'fflate'

import { getCanvasKit } from '@lawha/core/canvaskit'
import { BUILTIN_IO_FORMATS, IORegistry } from '@lawha/core/io'
import { SceneGraph } from '@lawha/scene-graph'
import { computeImageHash } from '@lawha/scene-graph/images'

setDefaultTimeout(120_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function pngSwatch(): Promise<Uint8Array> {
  const ck = await getCanvasKit()
  const surface = expectDefined(ck.MakeSurface(4, 4), 'surface')
  surface.getCanvas().clear(ck.Color(200, 40, 40, 1))
  const image = surface.makeImageSnapshot()
  const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'png')
  image.delete()
  surface.delete()
  return bytes
}

/** A card: auto layout, an Arabic heading, a shadow, an image, and a click that navigates. */
async function card() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const bytes = await pngSwatch()
  const hash = computeImageHash(bytes)
  graph.images.set(hash, bytes)
  const frame = graph.createNode('FRAME', page, {
    name: 'Product Card',
    x: 40,
    y: 60,
    width: 320,
    height: 200,
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    effects: [
      {
        type: 'DROP_SHADOW',
        visible: true,
        radius: 8,
        spread: 0,
        offset: { x: 0, y: 4 },
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        blendMode: 'NORMAL'
      }
    ]
  })
  graph.createNode('TEXT', frame.id, {
    name: 'Title',
    text: 'مرحبا بالعالم',
    fontFamily: 'Cairo',
    fontWeight: 700,
    fontSize: 24,
    textDirection: 'RTL',
    width: 288,
    height: 36,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Photo',
    width: 288,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        imageHash: hash,
        imageScaleMode: 'FILL',
        opacity: 1,
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 1 }
      }
    ]
  })
  return { graph, frame, hash }
}

async function exportPackage() {
  const { graph, frame, hash } = await card()
  const result = await io.exportContent('handoff', {
    graph,
    target: { scope: 'selection', nodeIds: [frame.id] }
  })
  expect(result.extension).toBe('zip')
  if (typeof result.data === 'string') throw new Error('Expected bytes')
  return { files: unzipSync(new Uint8Array(result.data)), frame, hash }
}

test('the package holds the guide, spec, references, code, tokens, images and verifier', async () => {
  const { files, hash } = await exportPackage()
  const names = Object.keys(files)
  for (const path of [
    'CLAUDE.md',
    'spec/design.json',
    'reference/product-card@1x.png',
    'reference/product-card@2x.png',
    'code/index.html',
    'code/tailwind.jsx',
    'tokens/tokens.css',
    'verify/verify.mjs',
    `assets/images/${hash}.png`
  ]) {
    expect(names).toContain(path)
  }
})

test('the spec has exact layout, text, effects and images for every layer', async () => {
  const { files, hash } = await exportPackage()
  const spec = JSON.parse(strFromU8(files['spec/design.json']))
  const [root] = spec.frames
  expect(root.frame).toEqual({ x: 0, y: 0, width: 320, height: 200 })
  expect(root.cornerRadius).toBe(12)
  expect(root.layout).toMatchObject({
    mode: 'VERTICAL',
    gap: 12,
    padding: { top: 16, right: 16, bottom: 16, left: 16 }
  })
  expect(root.effects[0]).toMatchObject({ type: 'DROP_SHADOW', radius: 8, offset: { x: 0, y: 4 } })
  expect(root.fills).toEqual([{ type: 'SOLID', color: '#FFFFFF' }])
  const [title, photo] = root.children
  expect(title.text).toMatchObject({
    characters: 'مرحبا بالعالم',
    fontFamily: 'Cairo',
    fontWeight: 700,
    fontSize: 24,
    direction: 'RTL'
  })
  expect(title.child).toMatchObject({ positioning: 'AUTO' })
  expect(photo.fills[0]).toMatchObject({ type: 'IMAGE', image: `assets/images/${hash}.png` })
  expect(spec.fonts).toEqual([{ family: 'Cairo', weights: [700], italic: false }])
})

test('references are the frame at 1x and 2x', async () => {
  const { files } = await exportPackage()
  const ck = await getCanvasKit()
  for (const [scale, size] of [
    ['1x', [320, 200]],
    ['2x', [640, 400]]
  ] as const) {
    const image = expectDefined(
      ck.MakeImageFromEncoded(files[`reference/product-card@${scale}.png`])
    )
    expect([image.width(), image.height()]).toEqual([...size])
    image.delete()
  }
})

test('the HTML marks the frame with the id the verifier and guide name', async () => {
  const { files } = await exportPackage()
  const html = strFromU8(files['code/index.html'])
  expect(html).toContain('id="product-card"')
  expect(html).toContain('مرحبا بالعالم')
  const guide = strFromU8(files['CLAUDE.md'])
  expect(guide).toContain('#product-card')
  expect(guide).toContain('Cairo: weights 700')
  const verifier = strFromU8(files['verify/verify.mjs'])
  expect(verifier).toContain('"slug": "product-card"')
})
