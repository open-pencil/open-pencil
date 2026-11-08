import { describe, expect, test } from 'bun:test'

import { createAPI, solidFill } from '#core-tests/helpers/figma-api'
import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

const red = { r: 1, g: 0, b: 0, a: 1 }
const green = { r: 0, g: 1, b: 0, a: 1 }
const blue = { r: 0, g: 0, b: 1, a: 1 }

const firstChild = (node: FigmaNodeProxy) => node.children[0]

// Measured in Figma desktop 126: instances show a component edit to the next line of the script.
describe('instance reads after component edits', () => {
  test('an instance shows its component’s new paint and layers at once', () => {
    const api = createAPI()
    const component = api.createComponent()
    const shape = api.createRectangle()
    component.appendChild(shape)
    shape.fills = [solidFill(red)]
    const instance = component.createInstance()

    shape.fills = [solidFill(green)]
    expect(firstChild(instance).fills).toMatchObject([{ color: { r: 0, g: 1, b: 0 } }])

    component.appendChild(api.createEllipse())
    expect(instance.children.map((child) => child.type)).toEqual(['RECTANGLE', 'ELLIPSE'])
  })

  test('an instance nested in another component follows its own component through it', () => {
    const api = createAPI()
    const inner = api.createComponent()
    const shape = api.createRectangle()
    inner.appendChild(shape)
    shape.fills = [solidFill(red)]
    const outer = api.createComponent()
    outer.appendChild(inner.createInstance())
    const placed = outer.createInstance()

    shape.fills = [solidFill(green)]
    expect(firstChild(firstChild(placed)).fills).toMatchObject([{ color: { r: 0, g: 1, b: 0 } }])
  })

  test('a fill an instance set itself stays when its component’s fill changes', () => {
    const api = createAPI()
    const component = api.createComponent()
    const shape = api.createRectangle()
    component.appendChild(shape)
    shape.fills = [solidFill(red)]
    const instance = component.createInstance()
    firstChild(instance).fills = [solidFill(blue)]

    shape.fills = [solidFill(green)]
    expect(firstChild(instance).fills).toMatchObject([{ color: { r: 0, g: 0, b: 1 } }])
  })

  test('a nested layer whose fill an instance set keeps its stroke following the component', () => {
    const api = createAPI()
    const tokens = api.variables.createVariableCollection('Tokens')
    const mode = tokens.modes[0].modeId
    const gray = api.variables.createVariable('Gray', tokens, 'COLOR')
    gray.setValueForMode(mode, { r: 0.5, g: 0.5, b: 0.5, a: 1 })
    const accent = api.variables.createVariable('Accent', tokens, 'COLOR')
    accent.setValueForMode(mode, green)
    const bound = (variable: typeof gray) =>
      api.variables.setBoundVariableForPaint(solidFill(red), 'color', variable)
    const inner = api.createComponent()
    const shape = api.createRectangle()
    inner.appendChild(shape)
    shape.fills = [bound(gray)]
    shape.strokes = [bound(gray)]
    const outer = api.createComponent()
    outer.appendChild(inner.createInstance())
    const placed = outer.createInstance()
    firstChild(firstChild(placed)).fills = [solidFill(blue)]

    shape.strokes = [bound(accent)]
    const copy = firstChild(firstChild(placed))
    expect(copy.fills).toMatchObject([{ color: { r: 0, g: 0, b: 1 } }])
    expect(copy.strokes).toMatchObject([{ boundVariables: { color: { id: accent.id } } }])
  })

  test('a host that syncs instances itself is asked to before a read', () => {
    const graph = new SceneGraph()
    let flushes = 0
    const api = new FigmaAPI(graph, { flushComponentSync: () => flushes++ })
    const component = api.createComponent()
    component.appendChild(api.createRectangle())
    const instance = component.createInstance()
    const before = flushes

    void firstChild(instance).fills
    expect(flushes).toBeGreaterThan(before)
  })
})
