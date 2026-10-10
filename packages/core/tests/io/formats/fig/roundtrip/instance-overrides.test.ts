import { beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core'
import type { FigmaNodeProxy } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await initCodec()
})

type Writable = Record<string, unknown>

/** What the editor does after a component changes. */
function syncComponent(graph: SceneGraph, component: FigmaNodeProxy) {
  graph.syncInstances(component.id)
}

// Every value here is one Figma records as an instance override (live Figma, 2026-10-10).
const RECT_OVERRIDES: Writable = {
  cornerRadius: 12,
  cornerSmoothing: 0.5,
  strokeWeight: 7,
  strokeAlign: 'OUTSIDE',
  strokeCap: 'ROUND',
  strokeJoin: 'BEVEL',
  dashPattern: [4, 2],
  blendMode: 'MULTIPLY',
  locked: true
}
const TEXT_OVERRIDES: Writable = {
  fontSize: 24,
  lineHeight: { unit: 'PIXELS', value: 30 },
  letterSpacing: { unit: 'PIXELS', value: 2 },
  textCase: 'UPPER',
  textDecoration: 'UNDERLINE',
  textAlignHorizontal: 'CENTER',
  textAlignVertical: 'BOTTOM'
}
const ROW_OVERRIDES: Writable = { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'MAX' }

function build() {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const component = api.createComponent()
  component.name = 'Card'
  component.resize(300, 200)
  const box = api.createRectangle()
  box.name = 'Box'
  Object.assign(box, { strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] })
  component.appendChild(box)
  const corners = api.createRectangle()
  corners.name = 'Corners'
  component.appendChild(corners)
  const label = api.createText()
  label.name = 'Label'
  label.characters = 'Hello'
  component.appendChild(label)
  const row = api.createFrame()
  row.name = 'Row'
  row.layoutMode = 'HORIZONTAL'
  component.appendChild(row)
  const instance = component.createInstance()
  return { graph, api, component, instance }
}

function child(instance: FigmaNodeProxy, name: string): FigmaNodeProxy {
  const found = instance.children.find((node) => node.name === name)
  if (!found) throw new Error(`Missing ${name}`)
  return found
}

function read(node: FigmaNodeProxy, fields: Writable) {
  return Object.fromEntries(Object.keys(fields).map((key) => [key, Reflect.get(node, key)]))
}

async function reopen(graph: SceneGraph) {
  const exported = await exportFigFile(graph)
  const reloaded = await parseFigFile(exported.buffer as ArrayBuffer)
  const api = new FigmaAPI(reloaded)
  const instance = api.currentPage.children.find((node) => node.type === 'INSTANCE')
  const component = api.currentPage.children.find((node) => node.type === 'COMPONENT')
  if (!instance || !component) throw new Error('Missing instance or component')
  return { graph: reloaded, instance, component }
}

function sceneNode(graph: SceneGraph, proxy: FigmaNodeProxy): SceneNode {
  const node = graph.getNode(proxy.id)
  if (!node) throw new Error('Missing node')
  return node
}

describe('instance overrides Figma records', () => {
  test('survive saving and reopening a .fig file', async () => {
    const { graph, instance } = build()
    const box = child(instance, 'Box')
    Object.assign(box, RECT_OVERRIDES)
    Object.assign(box, { effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ] })
    const corners = child(instance, 'Corners')
    Object.assign(corners, { topLeftRadius: 10, bottomRightRadius: 4, strokeTopWeight: 3 })
    const label = child(instance, 'Label')
    Object.assign(label, TEXT_OVERRIDES)
    const row = child(instance, 'Row')
    Object.assign(row, ROW_OVERRIDES)

    const reopened = await reopen(graph)
    const box2 = child(reopened.instance, 'Box')
    expect(read(box2, RECT_OVERRIDES)).toEqual(RECT_OVERRIDES)
    expect(Reflect.get(box2, 'effects')).toMatchObject([{ type: 'DROP_SHADOW', radius: 8, offset: { x: 0, y: 4 } }])
    expect(
      read(child(reopened.instance, 'Corners'), { topLeftRadius: 0, bottomRightRadius: 0 })
    ).toEqual({ topLeftRadius: 10, bottomRightRadius: 4 })
    expect(Reflect.get(child(reopened.instance, 'Corners'), 'strokeTopWeight')).toBe(3)
    expect(read(child(reopened.instance, 'Label'), TEXT_OVERRIDES)).toMatchObject(TEXT_OVERRIDES)
    expect(read(child(reopened.instance, 'Row'), ROW_OVERRIDES)).toEqual(ROW_OVERRIDES)
  })

  test('stay overrides after reopening, so component edits leave them', async () => {
    const { graph, instance } = build()
    Object.assign(child(instance, 'Box'), {
      cornerRadius: 12,
      strokeWeight: 7,
      blendMode: 'MULTIPLY'
    })
    const reopened = await reopen(graph)
    const componentBox = child(reopened.component, 'Box')
    Object.assign(componentBox, {
      cornerRadius: 30,
      strokeWeight: 2,
      blendMode: 'SCREEN',
      opacity: 0.4
    })
    syncComponent(reopened.graph, reopened.component)
    const box = child(reopened.instance, 'Box')
    expect(read(box, { cornerRadius: 0, strokeWeight: 0, blendMode: '', opacity: 0 })).toEqual({
      cornerRadius: 12,
      strokeWeight: 7,
      blendMode: 'MULTIPLY',
      opacity: 0.4
    })
  })

  test('component edits reach fields the instance did not override', () => {
    const { component, instance, graph } = build()
    const componentBox = child(component, 'Box')
    Object.assign(componentBox, { strokeWeight: 5, strokeAlign: 'OUTSIDE', dashPattern: [2, 2] })
    syncComponent(graph, component)
    const box = child(instance, 'Box')
    expect(read(box, { strokeWeight: 0, strokeAlign: '', dashPattern: [] })).toEqual({
      strokeWeight: 5,
      strokeAlign: 'OUTSIDE',
      dashPattern: [2, 2]
    })
    expect(sceneNode(graph, box).strokes[0]?.weight).toBe(5)
  })

  test("an overridden stroke weight outlasts a change to the component's stroke paint", () => {
    const { component, instance, graph } = build()
    const box = child(instance, 'Box')
    Object.assign(box, { strokeWeight: 7 })
    Object.assign(child(component, 'Box'), {
      strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
    })
    syncComponent(graph, component)
    const strokes = sceneNode(graph, box).strokes
    expect(strokes[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(strokes[0]?.weight).toBe(7)
  })

  test('an instance unlocked from a locked component stays unlocked', async () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const component = api.createComponent()
    component.resize(100, 50)
    component.lockAspectRatio()
    const unlocked = component.createInstance()
    unlocked.name = 'Unlocked'
    unlocked.unlockAspectRatio()
    const inherits = component.createInstance()
    inherits.name = 'Inherits'
    const relocked = component.createInstance()
    relocked.name = 'Relocked'
    relocked.resize(200, 50)
    relocked.lockAspectRatio()

    const reloaded = new FigmaAPI(
      await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    )
    const lock = (name: string) =>
      reloaded.currentPage.children.find((node) => node.name === name)?.targetAspectRatio
    expect(lock('Unlocked')).toBeNull()
    expect(lock('Inherits')).toEqual({ x: 100, y: 50 })
    expect(lock('Relocked')).toEqual({ x: 200, y: 50 })
  })
})
