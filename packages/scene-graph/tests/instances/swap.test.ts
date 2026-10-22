import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  recordAssignmentOverride
} from '@open-pencil/scene-graph/components'
import { instanceMainComponent, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

/** A set with two variants and an instance of the first, left with the variant's name. */
function setWithInstance() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Switch' })
  const off = graph.createNode('COMPONENT', set.id, { name: 'State=Off' })
  const on = graph.createNode('COMPONENT', set.id, { name: 'State=On' })
  const instance = graph.createInstance(off.id, pageId)
  if (!instance) throw new Error('No instance')
  return { graph, instance, on }
}

describe('swapping an instance', () => {
  test('renames an instance named after its component, as Figma does', () => {
    const { graph, instance, on } = setWithInstance()
    graph.swapInstanceComponent(instance.id, on.id)
    expect(graph.getNode(instance.id)?.name).toBe('State=On')
  })

  test('keeps the name when asked, so a view showing another variant keeps layer paths', () => {
    const { graph, instance, on } = setWithInstance()
    graph.swapInstanceComponent(instance.id, on.id, { keepName: true })
    expect(graph.getNode(instance.id)?.name).toBe('State=Off')
    expect(graph.getNode(instance.id)?.componentId).toBe(on.id)
  })
})

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected a value')
  }
  return value
}

type Layers = (graph: SceneGraph, componentId: string) => void

function swappable(off: Layers, on: Layers, graph = new SceneGraph()) {
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Switch' })
  const offVariant = graph.createNode('COMPONENT', set.id, { name: 'State=Off' })
  off(graph, offVariant.id)
  const onVariant = graph.createNode('COMPONENT', set.id, { name: 'State=On', y: 100 })
  on(graph, onVariant.id)
  const instance = must(graph.createInstance(offVariant.id, pageId, { x: 500 }))
  const child = (name: string, nth = 0) =>
    must(graph.getChildren(instance.id).filter((node) => node.name === name)[nth])
  const override = (nodeId: string, changes: Partial<SceneNode>) => {
    graph.updateNode(nodeId, changes)
    recordInstanceOverride(graph, nodeId, Object.keys(changes))
  }
  return { graph, instance, offVariant, onVariant, child, override }
}

function rectangles(...names: string[]): Layers {
  return (graph, componentId) => {
    for (const name of names) {
      graph.createNode('RECTANGLE', componentId, { name, width: 10, height: 10 })
    }
  }
}

describe('layers of a swapped instance', () => {
  test('keep their IDs and overrides when the new component has layers of the same name', () => {
    const { graph, instance, onVariant, child, override } = swappable(
      rectangles('Bg', 'Label'),
      (g, id) => {
        g.createNode('RECTANGLE', id, { name: 'Bg', width: 30, height: 10 })
        g.createNode('RECTANGLE', id, { name: 'Label', width: 10, height: 10, opacity: 0.8 })
      }
    )
    const bg = child('Bg')
    const label = child('Label')
    override(label.id, { visible: false })
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(child('Bg').id).toBe(bg.id)
    expect(child('Bg').width).toBe(30)
    expect(child('Label').id).toBe(label.id)
    expect(child('Label').visible).toBe(false)
    expect(child('Label').opacity).toBe(0.8)
    expect(instance.instanceOverrides.descendants.get(label.id)?.has('visible')).toBe(true)
  })

  test('are cloned fresh for new layers, and removed with their overrides for missing ones', () => {
    const { graph, instance, onVariant, child, override } = swappable(
      rectangles('Bg', 'Badge'),
      rectangles('Icon', 'Bg')
    )
    const badge = child('Badge')
    override(badge.id, { opacity: 0.3 })
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(graph.getChildren(instance.id).map((node) => node.name)).toEqual(['Icon', 'Bg'])
    expect(graph.getNode(badge.id)).toBeUndefined()
    expect(instance.instanceOverrides.descendants.has(badge.id)).toBe(false)
    expect(child('Icon').componentId).toBe(must(graph.getChildren(onVariant.id)[0]).id)
  })

  test('match same-named siblings by their order among them', () => {
    const { graph, instance, onVariant, child, override } = swappable(
      rectangles('Item', 'Item', 'Item'),
      rectangles('Item', 'Item')
    )
    const second = child('Item', 1)
    const third = child('Item', 2)
    override(second.id, { opacity: 0.4 })
    override(third.id, { opacity: 0.2 })
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(graph.getChildren(instance.id).map((node) => node.id)).toEqual([
      child('Item', 0).id,
      second.id
    ])
    expect(child('Item', 1).opacity).toBe(0.4)
    expect(instance.instanceOverrides.descendants.has(third.id)).toBe(false)
  })

  test('drop a layer of the same name but another type', () => {
    const { graph, instance, onVariant, child } = swappable(rectangles('Bg'), (g, id) => {
      g.createNode('FRAME', id, { name: 'Bg' })
    })
    const bg = child('Bg')
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(child('Bg').type).toBe('FRAME')
    expect(child('Bg').id).not.toBe(bg.id)
  })

  test('keep overrides on layers inside nested instances', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const icon = graph.createNode('COMPONENT', pageId, { name: 'Icon', x: 900 })
    graph.createNode('RECTANGLE', icon.id, { name: 'Glyph', width: 5, height: 5 })
    const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Chip' })
    const variant = (name: string, y: number) => {
      const component = graph.createNode('COMPONENT', set.id, { name, y })
      graph.createNode('RECTANGLE', component.id, { name: 'Bg', width: 10, height: 10 })
      must(graph.createInstance(icon.id, component.id, { name: 'Icon' }))
      return component
    }
    const off = variant('State=Off', 0)
    const on = variant('State=On', 100)
    const chip = must(graph.createInstance(off.id, pageId, { x: 500 }))
    const nested = must(graph.getChildren(chip.id).find((node) => node.name === 'Icon'))
    const glyph = must(graph.getChildren(nested.id)[0])
    graph.updateNode(glyph.id, { visible: false })
    recordInstanceOverride(graph, glyph.id, ['visible'])
    graph.swapInstanceComponent(chip.id, on.id)
    expect(graph.getChildren(chip.id).map((node) => node.id)).toContain(nested.id)
    expect(graph.getNode(glyph.id)?.visible).toBe(false)
    expect(nested.instanceOverrides.descendants.get(glyph.id)?.has('visible')).toBe(true)
    expect(nested.componentId).toBe(must(graph.getChildren(on.id)[1]).id)
  })

  test('re-apply a binding override per field, keeping the new layer’s other bindings', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Theme')
    const strong = graph.createVariable('Strong', 'FLOAT', collection.id, 0.9)
    const round = graph.createVariable('Round', 'FLOAT', collection.id, 6)
    const { instance, onVariant, child } = swappable(
      rectangles('Bg'),
      (g, id) => {
        const bg = g.createNode('RECTANGLE', id, { name: 'Bg', width: 10, height: 10 })
        g.bindVariable(bg.id, 'opacity', strong.id)
      },
      graph
    )
    const bg = child('Bg')
    graph.bindVariable(bg.id, 'cornerRadius', round.id)
    recordInstanceOverride(graph, bg.id, ['boundVariables/cornerRadius'])
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(child('Bg').boundVariables).toEqual({ opacity: strong.id, cornerRadius: round.id })
  })
})

function captionedDialog() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const label = graph.createNode('COMPONENT', pageId, {
    name: 'Label',
    x: 900,
    componentPropertyDefinitions: [
      { id: 'prop:text', name: 'Text', type: 'TEXT', defaultValue: 'Text' },
      { id: 'prop:hint', name: 'Hint', type: 'TEXT', defaultValue: 'Hint' }
    ]
  })
  graph.createNode('TEXT', label.id, {
    name: 'Caption',
    text: 'Text',
    componentPropertyReferences: [{ field: 'TEXT', propertyId: 'prop:text' }]
  })
  graph.createNode('TEXT', label.id, {
    name: 'Hint',
    text: 'Hint',
    componentPropertyReferences: [{ field: 'TEXT', propertyId: 'prop:hint' }]
  })
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Dialog' })
  const variant = (value: string, y: number) => {
    const component = graph.createNode('COMPONENT', set.id, { name: `Kind=${value}`, y })
    const nested = must(graph.createInstance(label.id, component.id, { name: 'Label' }))
    for (const definition of label.componentPropertyDefinitions) {
      applyComponentPropertyValue(graph, nested.id, definition, `${value} ${definition.name}`)
    }
    return component
  }
  const ok = variant('Ok', 0)
  const cancel = variant('Cancel', 100)
  const dialog = must(graph.createInstance(ok.id, pageId, { x: 500 }))
  const nested = must(graph.getChildren(dialog.id)[0])
  const texts = () => graph.getChildren(nested.id).map((node) => node.text)
  return { graph, label, cancel, dialog, nested, texts }
}

function badgedCards() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const badges = graph.createNode('COMPONENT_SET', pageId, { name: 'Badge' })
  const small = graph.createNode('COMPONENT', badges.id, { name: 'Size=S' })
  graph.createNode('RECTANGLE', small.id, { name: 'Dot', width: 4, height: 4 })
  const large = graph.createNode('COMPONENT', badges.id, { name: 'Size=L', y: 50 })
  graph.createNode('RECTANGLE', large.id, { name: 'Dot', width: 8, height: 8 })
  const cards = graph.createNode('COMPONENT_SET', pageId, { name: 'Card', x: 300 })
  const card = (value: string, y: number) => {
    const component = graph.createNode('COMPONENT', cards.id, { name: `State=${value}`, y })
    graph.createNode('RECTANGLE', component.id, { name: 'Bg', width: 20, height: 20 })
    must(graph.createInstance(small.id, component.id, { name: 'Badge' }))
    return component
  }
  const first = card('A', 0)
  const second = card('B', 100)
  const instance = must(graph.createInstance(first.id, pageId, { x: 900 }))
  return { graph, large, second, instance }
}

describe('nested copies of a swapped instance', () => {
  test('take the property values the new layer assigns', () => {
    const { graph, cancel, dialog, texts } = captionedDialog()
    graph.swapInstanceComponent(dialog.id, cancel.id)
    expect(texts()).toEqual(['Cancel Text', 'Cancel Hint'])
  })

  test('keep the property values set on them, and take the others', () => {
    const { graph, label, cancel, dialog, nested, texts } = captionedDialog()
    const text = must(label.componentPropertyDefinitions[0])
    applyComponentPropertyValue(graph, nested.id, text, 'Mine')
    recordAssignmentOverride(graph, nested.id, text.id)
    graph.swapInstanceComponent(dialog.id, cancel.id)
    expect(texts()).toEqual(['Mine', 'Cancel Hint'])
  })

  test('keep a variant chosen on them', () => {
    const { graph, large, second, instance } = badgedCards()
    const badge = must(graph.getChildren(instance.id)[1])
    graph.swapInstanceComponent(badge.id, large.id)
    graph.swapInstanceComponent(instance.id, second.id)
    expect(graph.getChildren(instance.id)[1]?.id).toBe(badge.id)
    expect(instanceMainComponent(graph, badge)?.id).toBe(large.id)
    expect(badge.name).toBe('Badge')
  })

  test('keep their IDs and overrides when renamed', () => {
    const { graph, second, instance } = badgedCards()
    const bg = must(graph.getChildren(instance.id)[0])
    graph.updateNode(bg.id, { name: 'Backdrop', opacity: 0.5 })
    recordInstanceOverride(graph, bg.id, ['name', 'opacity'])
    graph.swapInstanceComponent(instance.id, second.id)
    expect(graph.getChildren(instance.id)[0]?.id).toBe(bg.id)
    expect(bg.name).toBe('Backdrop')
    expect(bg.opacity).toBe(0.5)
  })
})

describe('a matched copy', () => {
  test('points the source link an imported copy carries at its new layer', () => {
    const { graph, instance, onVariant, child } = swappable(rectangles('Bg'), rectangles('Bg'))
    const bg = child('Bg')
    setInstanceOverride(
      instance.instanceOverrides,
      instance.id,
      bg.id,
      'sourceComponentId',
      bg.componentId
    )
    graph.swapInstanceComponent(instance.id, onVariant.id)
    const layer = must(graph.getChildren(onVariant.id)[0])
    expect(instance.instanceOverrides.descendants.get(bg.id)?.get('sourceComponentId')).toBe(
      layer.id
    )
  })

  test('takes the boolean operation and export settings of its new layer', () => {
    const exporting =
      (operation: SceneNode['booleanOperation'], scale: number): Layers =>
      (g, id) => {
        g.createNode('BOOLEAN_OPERATION', id, {
          name: 'Shape',
          booleanOperation: operation,
          exportSettings: [{ format: 'png', scale }]
        })
      }
    const { graph, instance, onVariant, child } = swappable(
      exporting('UNION', 1),
      exporting('SUBTRACT', 2)
    )
    const shape = child('Shape')
    graph.swapInstanceComponent(instance.id, onVariant.id)
    expect(child('Shape').id).toBe(shape.id)
    expect(child('Shape').booleanOperation).toBe('SUBTRACT')
    expect(child('Shape').exportSettings).toEqual(
      must(graph.getChildren(onVariant.id)[0]).exportSettings
    )
  })
})
