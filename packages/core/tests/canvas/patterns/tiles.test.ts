import { afterAll, describe, expect, test } from 'bun:test'

import { unpremultipliedPixels } from '#core-tests/helpers/figma-rows'
import {
  BLACK,
  TARGET,
  TILE,
  WHITE,
  addOutline,
  addOutlineSource,
  addTarget,
  channel,
  darkPixels,
  exportLayer,
  patternOf,
  solid
} from '#core-tests/helpers/patterns'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Effect, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { patternTilesOf } from '#core/canvas/patterns/tiles'
import { createGraphEventSubscription } from '#core/editor/graph-events'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(TARGET, TARGET), 'surface'))
afterAll(() => renderer.destroy())

const SHADOW: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 1, a: 1 },
  offset: { x: 100, y: 100 },
  radius: 0,
  spread: 0,
  visible: true,
  showShadowBehindNode: false
}

function outlinedScene(sourceProps: Partial<SceneNode> = {}, targetEffects: Effect[] = []) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const source = addOutlineSource(graph, page, sourceProps)
  const target = addTarget(graph, page, source, targetEffects)
  const other = graph.createNode('RECTANGLE', page, { x: 100 })
  return { graph, page, source, target, other }
}

function draw(graph: SceneGraph, page: string): void {
  renderer.renderSceneToCanvas(renderer.surface.getCanvas(), graph, page)
}

function canvasDarkPixels(graph: SceneGraph, page: string): number[] {
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  draw(graph, page)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = unpremultipliedPixels(ck, image)
    return darkPixels(Array.from({ length: TARGET * TARGET }, (_, i) => pixels[i * 4]))
  } finally {
    image.delete()
  }
}

function darkPixelCount(graph: SceneGraph, page: string, firstRow = 0): number {
  return canvasDarkPixels(graph, page)
    .slice(firstRow * TARGET)
    .filter((dark) => dark === 1).length
}

function freshDarkPixelCount(graph: SceneGraph, page: string): number {
  renderer.invalidateAllPictures()
  return darkPixelCount(graph, page)
}

function followEdits(graph: SceneGraph): void {
  createGraphEventSubscription({
    getGraph: () => graph,
    getRenderers: () => [renderer],
    scheduleComponentSync: () => undefined,
    requestRender: () => undefined,
    emitEditorEvent: () => undefined
  }).subscribeToGraph()
}

function editedScene(sourceProps: Partial<SceneNode> = {}, targetEffects: Effect[] = []) {
  const scene = outlinedScene(sourceProps, targetEffects)
  followEdits(scene.graph)
  renderer.invalidateAllPictures()
  const before = darkPixelCount(scene.graph, scene.page)
  return { ...scene, before }
}

const BLUR: Effect = {
  type: 'LAYER_BLUR',
  color: { r: 0, g: 0, b: 0, a: 1 },
  offset: { x: 0, y: 0 },
  radius: 2,
  spread: 0,
  visible: true
}

const HALF = TARGET / 2

function selfPatternedSourceDarkPixels(tiledBeforeItsSource: boolean): number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const target = tiledBeforeItsSource
    ? graph.createNode('RECTANGLE', page, { width: TARGET, height: HALF, effects: [SHADOW] })
    : null
  const source = graph.createNode('FRAME', page, {
    y: HALF,
    width: HALF,
    height: HALF,
    fills: [solid(WHITE)]
  })
  graph.createNode('RECTANGLE', source.id, {
    width: HALF,
    height: HALF,
    fills: [{ ...patternOf(source.id, WHITE), scale: 0.5 }],
    effects: [SHADOW]
  })
  addOutline(graph, source.id, { x: 4, y: 4, width: 12, height: 12 })
  if (target) {
    graph.updateNode(target.id, { fills: [solid(WHITE), patternOf(source.id)] })
  }
  renderer.invalidateAllPictures()
  return darkPixelCount(graph, page, HALF)
}

function cachedShaders() {
  return [...patternTilesOf(renderer).shaders.values()].map((tile) => tile.shader)
}

function sourceInTurnedParent(targetEffects: Effect[] = []) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const parent = graph.createNode('FRAME', page, {
    x: 100,
    y: 100,
    width: TILE,
    height: TILE,
    rotation: 90,
    fills: []
  })
  const source = graph.createNode('FRAME', parent.id, {
    width: TILE,
    height: TILE,
    fills: [solid(WHITE)]
  })
  graph.createNode('RECTANGLE', source.id, { width: TILE, height: 3, fills: [solid(BLACK)] })
  const target = addTarget(graph, page, source, targetEffects)
  return { graph, page, source, target }
}

function perTileRow(dark: number[], width: number): number[] {
  return Array.from({ length: TILE }, (_, row) =>
    dark.slice(row * width, row * width + TILE).reduce((sum, value) => sum + value, 0)
  )
}

function canvasDarkPixelsPerTileRow(graph: SceneGraph, page: string): number[] {
  return perTileRow(canvasDarkPixels(graph, page), TARGET)
}

function darkPixelsPerTileRow(graph: SceneGraph, page: string, nodeIds: string[]): number[] {
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, nodeIds, {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    }),
    'png'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
  const width = image.width()
  image.delete()
  return perTileRow(darkPixels(channel(ck, png, 0)), width)
}

describe('pattern tiles', () => {
  test('are recorded once and kept across frames', () => {
    const { graph, page } = outlinedScene()
    renderer.invalidateAllPictures()
    draw(graph, page)
    const first = cachedShaders()
    draw(graph, page)
    expect(first).toHaveLength(1)
    expect(cachedShaders()[0]).toBe(first[0])
  })

  test('are dropped when a layer inside their source changes, and only then', () => {
    const { graph, page, source, other } = outlinedScene()
    renderer.invalidateAllPictures()
    draw(graph, page)
    renderer.invalidateNodePicture(other.id)
    expect(cachedShaders()).toHaveLength(1)
    renderer.invalidateNodePicture(source.childIds[0])
    expect(cachedShaders()).toHaveLength(0)
  })

  test('are recorded again after fonts change', () => {
    const { graph, page } = outlinedScene()
    renderer.invalidateAllPictures()
    draw(graph, page)
    const first = cachedShaders()
    renderer.fontGeneration += 1
    draw(graph, page)
    expect(cachedShaders()).toHaveLength(1)
    expect(cachedShaders()[0]).not.toBe(first[0])
  })

  test('are not kept while images draw at preview resolution', () => {
    const { graph, target } = outlinedScene()
    renderer.invalidateAllPictures()
    renderer.viewportImageRendering = true
    renderer.worldViewport = { x: 0, y: 0, w: TARGET, h: TARGET }
    try {
      renderer.renderNode(renderer.surface.getCanvas(), graph, target.id, {})
    } finally {
      renderer.viewportImageRendering = false
    }
    expect(cachedShaders()).toHaveLength(0)
  })

  test('belong to the document they were drawn from', () => {
    const first = outlinedScene()
    const second = outlinedScene()
    renderer.invalidateAllPictures()
    draw(first.graph, first.page)
    const shaders = cachedShaders()
    draw(second.graph, second.page)
    expect(cachedShaders()).toHaveLength(1)
    expect(cachedShaders()[0]).not.toBe(shaders[0])
  })

  test('follow a layer deleted from their source', () => {
    const { graph, page, source, before } = editedScene()
    graph.deleteNode(source.childIds[0])
    const after = darkPixelCount(graph, page)
    expect(after).not.toBe(before)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('follow a layer moved out of their source', () => {
    const { graph, page, source, before } = editedScene()
    graph.reparentNode(source.childIds[0], page)
    const after = darkPixelCount(graph, page)
    expect(after).not.toBe(before)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('are dropped with their deleted source', () => {
    const { graph, page, source, before } = editedScene()
    graph.deleteNode(source.id)
    const after = darkPixelCount(graph, page)
    expect(cachedShaders()).toHaveLength(0)
    expect(after).not.toBe(before)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('let a change inside a parent cycle finish', () => {
    const { graph, page } = outlinedScene()
    renderer.invalidateAllPictures()
    draw(graph, page)
    const outer = graph.createNode('FRAME', page)
    const inner = graph.createNode('FRAME', outer.id)
    outer.parentId = inner.id
    renderer.invalidateNodePicture(inner.id)
    expect(cachedShaders()).toHaveLength(1)
  })

  test('come back on a cached target when its hidden source is shown again', () => {
    const { graph, page, source, before } = editedScene({}, [SHADOW])
    graph.updateNode(source.id, { visible: false })
    expect(darkPixelCount(graph, page)).not.toBe(before)
    graph.updateNode(source.id, { visible: true })
    expect(darkPixelCount(graph, page)).toBe(before)
  })

  test('appear on a cached target when a source that started hidden is shown', () => {
    const { graph, page, source, before } = editedScene({ visible: false }, [SHADOW])
    graph.updateNode(source.id, { visible: true })
    const after = darkPixelCount(graph, page)
    expect(after).not.toBe(before)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('come back on a cached target when its source gets its size back', () => {
    const { graph, page, source, before } = editedScene({}, [SHADOW])
    graph.updateNode(source.id, { width: 0 })
    expect(darkPixelCount(graph, page)).not.toBe(before)
    graph.updateNode(source.id, { width: source.height })
    expect(darkPixelCount(graph, page)).toBe(before)
  })

  test('come back on a cached target when undo restores its deleted source', () => {
    const { graph, page, source, before } = editedScene({}, [SHADOW])
    const frame = structuredClone({ ...source, childIds: [] })
    const outline = structuredClone(expectDefined(graph.getNode(source.childIds[0]), 'outline'))
    graph.deleteNode(source.id)
    expect(darkPixelCount(graph, page)).not.toBe(before)
    graph.createNodeWithId(frame.id, 'FRAME', page, frame)
    graph.createNodeWithId(outline.id, 'RECTANGLE', frame.id, outline)
    expect(darkPixelCount(graph, page)).toBe(before)
  })

  test('appear on a cached target when its source is created under the id it was imported with', () => {
    const { graph, page, source, target } = editedScene({}, [SHADOW])
    const importedId = 'imported-source'
    graph.updateNode(target.id, { fills: [target.fills[0], patternOf(importedId)] })
    const missing = darkPixelCount(graph, page)
    addOutlineSource(graph, page, {
      source: { ...structuredClone(source.source), id: importedId }
    })
    const after = darkPixelCount(graph, page)
    expect(after).not.toBe(missing)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('leave no picture of a layer drawn inside the tile of the source it lies in', () => {
    expect(selfPatternedSourceDarkPixels(true)).toBe(selfPatternedSourceDarkPixels(false))
  })

  test('survive an export of a layer patterned from them', () => {
    const { graph, page, target } = outlinedScene()
    renderer.invalidateAllPictures()
    draw(graph, page)
    const shaders = cachedShaders()
    exportLayer(ck, renderer, graph, page, target)
    expect(cachedShaders()).toHaveLength(1)
    expect(cachedShaders()[0]).toBe(shaders[0])
  })

  test('follow a layer deleted from their source after an export', () => {
    const { graph, page, source, before } = editedScene({}, [SHADOW])
    const plain = graph.createNode('RECTANGLE', page, {
      y: TARGET / 2,
      width: TARGET,
      height: TARGET / 2,
      fills: [solid(WHITE), patternOf(source.id)]
    })
    darkPixelCount(graph, page)
    exportLayer(ck, renderer, graph, page, plain)
    darkPixelCount(graph, page)
    graph.deleteNode(source.childIds[0])
    const after = darkPixelCount(graph, page)
    expect(after).not.toBe(before)
    expect(after).toBe(freshDarkPixelCount(graph, page))
  })

  test('keep the turn of a source in a turned parent when exported with it', () => {
    const { graph, page, source, target } = sourceInTurnedParent()
    renderer.invalidateAllPictures()
    const alone = darkPixelsPerTileRow(graph, page, [target.id])
    expect(alone).toEqual([10, 10, 10, 0, 0, 0, 0, 0, 0, 0])
    expect(darkPixelsPerTileRow(graph, page, [target.id, source.id])).toEqual(alone)
  })

  test('leave the canvas tile untouched by an export with their source', () => {
    const { graph, page, source, target } = sourceInTurnedParent([SHADOW])
    renderer.invalidateAllPictures()
    darkPixelsPerTileRow(graph, page, [target.id, source.id])
    const afterExport = canvasDarkPixelsPerTileRow(graph, page)
    renderer.invalidateAllPictures()
    expect(afterExport).toEqual(canvasDarkPixelsPerTileRow(graph, page))
  })

  test('forget the targets that were deleted', () => {
    const { graph, page, source } = editedScene()
    for (let cycle = 0; cycle < 200; cycle++) {
      const layer = addTarget(graph, page, source)
      draw(graph, page)
      graph.deleteNode(layer.id)
    }
    expect(patternTilesOf(renderer).targets.targetCount).toBe(1)
  })

  test('follow a layer deleted from their source after its only target was deleted', () => {
    const { graph, page, source, target } = editedScene()
    graph.deleteNode(target.id)
    darkPixelCount(graph, page)
    graph.deleteNode(source.childIds[0])
    addTarget(graph, page, source)
    expect(darkPixelCount(graph, page)).toBe(freshDarkPixelCount(graph, page))
  })

  test('follow a layer deleted from their source when undo restores their only target', () => {
    const { graph, page, source, target } = editedScene()
    const restored = structuredClone({ ...target, childIds: [] })
    graph.deleteNode(target.id)
    darkPixelCount(graph, page)
    graph.deleteNode(source.childIds[0])
    graph.createNodeWithId(restored.id, 'RECTANGLE', page, restored)
    expect(darkPixelCount(graph, page)).toBe(freshDarkPixelCount(graph, page))
  })
})

describe('layer structure edits', () => {
  test('keep the picture of a parent on a page without patterns', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      width: TARGET,
      height: TARGET,
      fills: [solid(WHITE)],
      effects: [BLUR]
    })
    const child = graph.createNode('RECTANGLE', frame.id, { width: 4, height: 4 })
    followEdits(graph)
    renderer.invalidateAllPictures()
    draw(graph, page)
    const picture = renderer.nodePictures.get(frame.id)
    expect(picture).toBeDefined()
    graph.deleteNode(child.id)
    expect(renderer.nodePictures.get(frame.id)).toBe(expectDefined(picture, 'picture'))
  })
})
