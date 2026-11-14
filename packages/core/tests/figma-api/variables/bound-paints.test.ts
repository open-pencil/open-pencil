import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { FigmaPaint } from '#core/figma-api/paints'

type Proxy = ReturnType<FigmaAPI['createRectangle']>

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b },
  opacity,
  visible: true
})

/** A node's first fill as `r,g,b,opacity`, rounded as the Figma oracle prints it. */
function read(node: Proxy | { fills: unknown }): string {
  const fills = node.fills
  if (!Array.isArray(fills)) throw new Error('fills are mixed')
  const [paint] = fills as { color: Color; opacity: number }[]
  const round = (n: number) => Math.round(n * 100) / 100
  return [paint.color.r, paint.color.g, paint.color.b, paint.opacity].map(round).join(',')
}

function boundTo(paint: unknown): boolean {
  return typeof paint === 'object' && paint !== null && 'boundVariables' in paint
    ? !!(paint.boundVariables as { color?: unknown } | undefined)?.color
    : false
}

function solidOf(node: Proxy): Extract<FigmaPaint, { type: 'SOLID' }> {
  const [paint] = node.fills as readonly FigmaPaint[]
  if (paint.type !== 'SOLID') throw new Error('expected a solid paint')
  return paint
}

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  const collection = figma.variables.createVariableCollection('Theme')
  const light = collection.modes[0].modeId
  const dark = collection.addMode('Dark')
  const tone = figma.variables.createVariable('Tone', collection, 'COLOR')
  tone.setValueForMode(light, { r: 1, g: 0, b: 0, a: 1 })
  tone.setValueForMode(dark, { r: 0, g: 0, b: 1, a: 0.5 })
  const bind = (node: Proxy, opacity = 1) => {
    node.fills = [figma.variables.setBoundVariableForPaint(solid(0, 0, 0, opacity), 'color', tone)]
  }
  const setOpacity = (node: Proxy, opacity: number) => {
    node.fills = [{ ...solidOf(node), opacity }]
  }
  return { figma, collection, light, dark, tone, bind, setOpacity }
}

// Figma desktop 126 (scratch/pr-oracle/1879 bound-paint, bound-cache, bound-instance): a bound
// paint's color and opacity are a cache Figma stores, reads, and draws as they are, refreshed
// from the variable only when the color it gives the layer changes.
describe('bound paints in the plugin API', () => {
  test('binding writes the variable color and alpha into the paint, whatever opacity it had', () => {
    const { figma, tone, bind } = setup()
    const rect = figma.createRectangle()
    bind(rect, 0.4)
    expect(read(rect)).toBe('1,0,0,1')
    // The paint holds them: they stay once the variable is gone.
    tone.remove()
    expect(read(rect)).toBe('1,0,0,1')
  })

  test('a bound paint written with another opacity or a literal color keeps it and its binding', () => {
    const { figma, bind, setOpacity } = setup()
    const rect = figma.createRectangle()
    bind(rect)
    setOpacity(rect, 0.5)
    expect(read(rect)).toBe('1,0,0,0.5')
    rect.fills = [{ ...solidOf(rect), color: { r: 0.1, g: 0.2, b: 0.3 } }]
    expect(read(rect)).toBe('0.1,0.2,0.3,0.5')
    expect(boundTo((rect.fills as unknown[])[0])).toBe(true)
  })

  test('a new value in the layer mode refreshes the paint; the same value does not', () => {
    const { figma, light, tone, bind, setOpacity } = setup()
    const rect = figma.createRectangle()
    bind(rect)
    setOpacity(rect, 0.5)
    tone.setValueForMode(light, { r: 1, g: 0, b: 0, a: 1 })
    expect(read(rect)).toBe('1,0,0,0.5')
    tone.setValueForMode(light, { r: 0, g: 0, b: 1, a: 0.3 })
    expect(read(rect)).toBe('0,0,1,0.3')
  })

  test('a mode set on a frame refreshes the paint inside it; the same mode again does not', () => {
    const { figma, collection, dark, bind, setOpacity } = setup()
    const frame = figma.createFrame()
    const rect = figma.createRectangle()
    frame.appendChild(rect)
    bind(rect)
    setOpacity(rect, 0.7)
    frame.setExplicitVariableModeForCollection(collection, dark)
    expect(read(rect)).toBe('0,0,1,0.5')
    setOpacity(rect, 0.7)
    frame.setExplicitVariableModeForCollection(collection, dark)
    expect(read(rect)).toBe('0,0,1,0.7')
    frame.clearExplicitVariableModeForCollection(collection)
    expect(read(rect)).toBe('1,0,0,1')
  })

  test('moving into a frame in another mode refreshes the paint', () => {
    const { figma, collection, dark, bind, setOpacity } = setup()
    const darkFrame = figma.createFrame()
    darkFrame.setExplicitVariableModeForCollection(collection, dark)
    const rect = figma.createRectangle()
    bind(rect)
    setOpacity(rect, 0.7)
    darkFrame.appendChild(rect)
    expect(read(rect)).toBe('0,0,1,0.5')
    // Another frame in the same mode gives the same color, so an edit made since stays.
    setOpacity(rect, 0.2)
    const alsoDark = figma.createFrame()
    alsoDark.setExplicitVariableModeForCollection(collection, dark)
    alsoDark.appendChild(rect)
    expect(read(rect)).toBe('0,0,1,0.2')
  })

  // scratch/pr-oracle/1879 rule-probe: the mode set for the layer decides, not the color it gives.
  test('setting the mode a layer already shows refreshes the paint; the same mode from elsewhere does not', () => {
    const { figma, collection, light, bind, setOpacity } = setup()
    const frame = figma.createFrame()
    const rect = figma.createRectangle()
    frame.appendChild(rect)
    bind(rect)
    setOpacity(rect, 0.4)
    frame.setExplicitVariableModeForCollection(collection, light)
    expect(read(rect)).toBe('1,0,0,1')
    // An inner frame setting the mode already set keeps the edit, and shields it from outer changes.
    setOpacity(rect, 0.4)
    const inner = figma.createFrame()
    frame.appendChild(inner)
    inner.appendChild(rect)
    inner.setExplicitVariableModeForCollection(collection, light)
    expect(read(rect)).toBe('1,0,0,0.4')
    frame.clearExplicitVariableModeForCollection(collection)
    expect(read(rect)).toBe('1,0,0,0.4')
  })

  test('moving into a frame that sets the mode a layer already shows refreshes the paint', () => {
    const { figma, collection, light, bind, setOpacity } = setup()
    const plain = figma.createFrame()
    const rect = figma.createRectangle()
    bind(rect)
    setOpacity(rect, 0.4)
    plain.appendChild(rect)
    expect(read(rect)).toBe('1,0,0,0.4')
    const lightFrame = figma.createFrame()
    lightFrame.setExplicitVariableModeForCollection(collection, light)
    lightFrame.appendChild(rect)
    expect(read(rect)).toBe('1,0,0,1')
    setOpacity(rect, 0.4)
    const alsoLight = figma.createFrame()
    alsoLight.setExplicitVariableModeForCollection(collection, light)
    alsoLight.appendChild(rect)
    expect(read(rect)).toBe('1,0,0,0.4')
  })

  test('removing the variable leaves the paint as it was last colored', () => {
    const { figma, light, tone, bind } = setup()
    const rect = figma.createRectangle()
    bind(rect)
    tone.setValueForMode(light, { r: 0, g: 0.5, b: 0, a: 1 })
    tone.remove()
    expect(read(rect)).toBe('0,0.5,0,1')
  })

  test("a component's opacity edit does not reach its instances; an instance edit sticks", () => {
    const { figma, collection, dark, bind, setOpacity } = setup()
    const component = figma.createComponent()
    const shape = figma.createRectangle()
    component.appendChild(shape)
    bind(shape)
    const same = component.createInstance()
    const holder = figma.createFrame()
    holder.setExplicitVariableModeForCollection(collection, dark)
    const other = component.createInstance()
    holder.appendChild(other)
    setOpacity(shape, 0.6)
    expect(read(shape)).toBe('1,0,0,0.6')
    expect(read(same.children[0])).toBe('1,0,0,1')
    expect(read(other.children[0])).toBe('0,0,1,0.5')
    const otherShape = other.children[0] as Proxy
    setOpacity(otherShape, 0.3)
    expect(read(otherShape)).toBe('0,0,1,0.3')
    holder.appendChild(same)
    expect(read(same.children[0])).toBe('0,0,1,0.5')
  })

  test('a layer a variant switch gives back shows its variable in the mode restored on it', () => {
    const { figma, collection, dark, bind, setOpacity } = setup()
    const variant = (name: string, withGroup: boolean) => {
      const component = figma.createComponent()
      component.name = `State=${name}`
      if (withGroup) {
        const group = figma.createFrame()
        group.name = 'Group'
        component.appendChild(group)
        const shape = figma.createRectangle()
        group.appendChild(shape)
        bind(shape)
      }
      return component
    }
    const on = variant('On', true)
    const off = variant('Off', false)
    figma.combineAsVariants([on, off], figma.currentPage)
    const instance = on.createInstance()
    const group = instance.children[0]
    group.setExplicitVariableModeForCollection(collection, dark)
    expect(read(group.children[0])).toBe('0,0,1,0.5')
    instance.setProperties({ State: 'Off' })
    instance.setProperties({ State: 'On' })
    const restored = instance.children[0]
    expect(restored.explicitVariableModes).toEqual({ [collection.id]: dark })
    expect(read(restored.children[0])).toBe('0,0,1,0.5')
    // A paint edit the switch gives back keeps its own opacity.
    setOpacity(restored.children[0] as Proxy, 0.3)
    instance.setProperties({ State: 'Off' })
    instance.setProperties({ State: 'On' })
    const again = instance.children[0]
    expect(read(again.children[0])).toBe('0,0,1,0.3')
  })

  test('a layer a swap adds shows its variable in the instance mode', () => {
    const { figma, collection, dark, bind } = setup()
    const plain = figma.createComponent()
    const filled = figma.createComponent()
    const shape = figma.createRectangle()
    filled.appendChild(shape)
    bind(shape)
    const holder = figma.createFrame()
    holder.setExplicitVariableModeForCollection(collection, dark)
    const instance = plain.createInstance()
    holder.appendChild(instance)
    instance.swapComponent(filled)
    expect(read(instance.children[0])).toBe('0,0,1,0.5')
  })
})
