import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI, type FigmaInstanceNode } from '@open-pencil/core/figma-api'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected a value')
  }
  return value
}

function switchable(depth = 0, fanOut = 1) {
  const editor = createEditor()
  const { graph } = editor
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Chip',
    componentPropertyDefinitions: [
      { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: 'Small' }
    ]
  })
  const variant = (size: string, y: number, width: number) => {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      y,
      width,
      height: 20,
      componentPropertyValues: { Size: size }
    })
    graph.createNode('RECTANGLE', component.id, { name: 'Bg', width, height: 20 })
    let parentId = component.id
    for (let level = 0; level < depth; level++) {
      let lastId = parentId
      for (let sibling = 0; sibling < fanOut; sibling++) {
        lastId = graph.createNode('FRAME', parentId, { name: 'Frame', width, height: 20 }).id
      }
      parentId = lastId
    }
    return component
  }
  variant('Small', 0, 40)
  const large = variant('Large', 100, 80)
  const small = must(graph.getChildren(set.id)[0])
  const chip = must(graph.createInstance(small.id, pageId, { x: 500 }))
  const bg = () => must(graph.getChildren(chip.id)[0])
  const deepest = () => {
    let node = chip
    for (let level = 0; level < depth; level++) {
      node = must(graph.getChildren(node.id).at(-1))
    }
    return node
  }
  return { editor, graph, chip, large, bg, deepest }
}

test('switching a variant keeps an edit made before it undoable', () => {
  const { editor, chip, bg } = switchable()
  const bgId = bg().id
  editor.updateNodeWithUndo(bgId, { opacity: 0.5 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(bg().id).toBe(bgId)
  expect(bg().opacity).toBe(0.5)
  expect(bg().width).toBe(80)
  editor.undo.undo()
  expect(bg().width).toBe(40)
  expect(bg().opacity).toBe(0.5)
  editor.undo.undo()
  expect(bg().opacity).toBe(1)
  expect(chip.instanceOverrides.descendants.has(bgId)).toBe(false)
})

test('switching a deep variant and back updates each of its layers once', () => {
  const { editor, graph, chip, deepest } = switchable(24, 3)
  editor.updateNodeWithUndo(deepest().id, { opacity: 0.5 })
  const layers = graph.countDescendants(chip.id) + 1
  let updates = 0
  const updateNode = graph.updateNode.bind(graph)
  graph.updateNode = (...args: Parameters<typeof updateNode>) => {
    updates++
    return updateNode(...args)
  }
  for (let round = 0; round < 5; round++) {
    editor.switchInstanceVariant(chip.id, 'Size', 'Large')
    editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  }
  graph.updateNode = updateNode
  expect(updates).toBeLessThanOrEqual(10 * layers)
  expect(deepest().opacity).toBe(0.5)
})

function withOwnLayers() {
  const editor = createEditor()
  const { graph } = editor
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Chip',
    componentPropertyDefinitions: [
      { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: 'Small' }
    ]
  })
  const variant = (size: string, y: number, own: string) => {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      y,
      componentPropertyValues: { Size: size }
    })
    graph.createNode('RECTANGLE', component.id, { name: 'Bg', width: 40, height: 20 })
    graph.createNode('RECTANGLE', component.id, { name: own, width: 4, height: 4 })
    return component
  }
  const small = variant('Small', 0, 'Badge')
  variant('Large', 100, 'Icon')
  const chip = must(graph.createInstance(small.id, pageId, { x: 500 }))
  const named = (name: string) =>
    must(graph.getChildren(chip.id).find((node) => node.name === name))
  return { editor, chip, named }
}

test('undoing a switch brings back a layer the new variant lacks, with its ID and override', () => {
  const { editor, chip, named } = withOwnLayers()
  const badgeId = named('Badge').id
  editor.updateNodeWithUndo(badgeId, { opacity: 0.3 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  editor.undo.undo()
  expect(named('Badge').id).toBe(badgeId)
  expect(named('Badge').opacity).toBe(0.3)
  expect(chip.instanceOverrides.descendants.get(badgeId)?.has('opacity')).toBe(true)
  editor.undo.undo()
  expect(named('Badge').opacity).toBe(1)
})

test('redoing a switch brings back the layers it added, so later edits redo on them', () => {
  const { editor, chip, named } = withOwnLayers()
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  const iconId = named('Icon').id
  editor.updateNodeWithUndo(iconId, { opacity: 0.4 })
  editor.undo.undo()
  editor.undo.undo()
  editor.undo.redo()
  editor.undo.redo()
  expect(named('Icon').id).toBe(iconId)
  expect(named('Icon').opacity).toBe(0.4)
})

// Figma (desktop 126) brings back an override on a layer the other variant lacks when the
// instance switches back, though its saved records drop it while the layer is gone.
test('switching back brings back the overrides of a layer the other variant lacks', () => {
  const { editor, chip, named } = withOwnLayers()
  editor.updateNodeWithUndo(named('Badge').id, { opacity: 0.3 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(chip.instanceOverrides.descendants.size).toBe(0)
  editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  const badge = named('Badge')
  expect(badge.opacity).toBe(0.3)
  expect(chip.instanceOverrides.descendants.get(badge.id)?.has('opacity')).toBe(true)
})

test('a layer removed with nothing overridden does not bring back an older override', () => {
  const { editor, chip, named } = withOwnLayers()
  const badge = named('Badge')
  editor.updateNodeWithUndo(badge.id, { opacity: 0.3 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  // Undo brings the layer back with its override, then a script resets it.
  editor.undo.undo()
  ;(new FigmaAPI(editor.graph).wrapNode(chip.id) as FigmaInstanceNode).resetOverrides()
  expect(named('Badge').opacity).toBe(1)
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  expect(named('Badge').opacity).toBe(1)
})

// Figma (desktop 126) keeps a rectangle's opacity on the ellipse of the same name.
test('a layer the new variant draws as another type keeps its overrides', () => {
  const editor = createEditor()
  const { graph } = editor
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Chip',
    componentPropertyDefinitions: [
      { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: 'Small' }
    ]
  })
  for (const [size, type] of [
    ['Small', 'RECTANGLE'],
    ['Large', 'ELLIPSE']
  ] as const) {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      componentPropertyValues: { Size: size }
    })
    graph.createNode(type, component.id, { name: 'Shape', width: 10, height: 10 })
  }
  const chip = must(graph.createInstance(must(graph.getChildren(set.id)[0]).id, pageId))
  const shape = () => must(graph.getChildren(chip.id)[0])
  editor.updateNodeWithUndo(shape().id, { opacity: 0.5 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(shape().type).toBe('ELLIPSE')
  expect(shape().opacity).toBe(0.5)
  expect(chip.instanceOverrides.descendants.get(shape().id)?.has('opacity')).toBe(true)
  editor.undo.undo()
  expect(shape().type).toBe('RECTANGLE')
  expect(shape().opacity).toBe(0.5)
})

type LayerSpec = {
  name: string
  type: 'RECTANGLE' | 'FRAME' | 'GROUP' | 'INSTANCE'
  of?: string
  children?: LayerSpec[]
}

/** A Size set whose variants draw the given layers, and an instance of its first variant. */
function chipDrawing(
  variants: Record<string, LayerSpec[]>,
  makeComponents: (graph: SceneGraph, pageId: string) => Record<string, string> = () => ({})
) {
  const editor = createEditor()
  const { graph } = editor
  const pageId = editor.state.currentPageId
  const components = makeComponents(graph, pageId)
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Chip',
    componentPropertyDefinitions: [
      { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: Object.keys(variants)[0] }
    ]
  })
  const draw = (parentId: string, layers: LayerSpec[]) => {
    for (const layer of layers) {
      const node =
        layer.type === 'INSTANCE'
          ? must(graph.createInstance(must(components[layer.of ?? '']), parentId, { name: layer.name }))
          : graph.createNode(layer.type, parentId, { name: layer.name, width: 10, height: 10 })
      if (layer.children) draw(node.id, layer.children)
    }
  }
  for (const [size, layers] of Object.entries(variants)) {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      componentPropertyValues: { Size: size }
    })
    draw(component.id, layers)
  }
  const chip = must(graph.createInstance(must(graph.getChildren(set.id)[0]).id, pageId))
  const at = (...names: string[]) => {
    let node = chip
    for (const name of names) {
      node = must(graph.getChildren(node.id).find((child) => child.name === name))
    }
    return node
  }
  const to = (size: string) => editor.switchInstanceVariant(chip.id, 'Size', size)
  return { editor, graph, chip, at, to }
}

test('a layer comes back with its overrides after a variant that draws it under another ID', () => {
  const badge: LayerSpec = { name: 'Badge', type: 'RECTANGLE' }
  const { editor, at, to } = chipDrawing({ Small: [badge], Large: [], Huge: [badge] })
  editor.updateNodeWithUndo(at('Badge').id, { opacity: 0.3 })
  to('Large')
  to('Huge')
  expect(at('Badge').opacity).toBe(0.3)
})

test('undoing a switch back and switching again brings the overrides back once more', () => {
  const { editor, chip, named } = withOwnLayers()
  editor.updateNodeWithUndo(named('Badge').id, { opacity: 0.3 })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  editor.undo.undo()
  editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  expect(named('Badge').opacity).toBe(0.3)
})

test('the layers in a layer drawn as another type keep their overrides', () => {
  const dot: LayerSpec = { name: 'Dot', type: 'RECTANGLE' }
  const { editor, at, to } = chipDrawing({
    Small: [{ name: 'Box', type: 'FRAME', children: [dot] }],
    Large: [{ name: 'Box', type: 'GROUP', children: [dot] }]
  })
  editor.updateNodeWithUndo(at('Box', 'Dot').id, { opacity: 0.4 })
  to('Large')
  expect(at('Box').type).toBe('GROUP')
  expect(at('Box', 'Dot').opacity).toBe(0.4)
})

test('a nested instance the other variant lacks comes back with the overrides on its layers', () => {
  const { editor, at, to } = chipDrawing(
    { Small: [{ name: 'Pill', type: 'INSTANCE', of: 'pill' }], Large: [] },
    (graph, pageId) => {
      const pill = graph.createNode('COMPONENT', pageId, { name: 'Pill', x: 400 })
      graph.createNode('RECTANGLE', pill.id, { name: 'Label', width: 10, height: 10 })
      return { pill: pill.id }
    }
  )
  editor.updateNodeWithUndo(at('Pill').id, { opacity: 0.6 })
  editor.updateNodeWithUndo(at('Pill', 'Label').id, { opacity: 0.2 })
  to('Large')
  to('Small')
  expect(at('Pill').opacity).toBe(0.6)
  expect(at('Pill', 'Label').opacity).toBe(0.2)
})

test('a layer drawn as another type keeps a binding its instance removed', () => {
  const { graph, chip, at, to } = chipDrawing({
    Small: [{ name: 'Shape', type: 'RECTANGLE' }],
    Large: [{ name: 'Shape', type: 'FRAME' }]
  })
  const collection = graph.createCollection('Look')
  const faded = graph.createVariable('Faded', 'FLOAT', collection.id, 0.5)
  for (const variant of graph.getChildren(must(chip.componentId && graph.getNode(chip.componentId)?.parentId)))
    graph.bindVariable(must(graph.getChildren(variant.id)[0]).id, 'opacity', faded.id)
  graph.syncInstances(must(chip.componentId))
  // Removing the variable claims the layer's bindings, as the panel records it.
  const shape = at('Shape')
  setInstanceOverride(chip.instanceOverrides, chip.id, shape.id, 'boundVariables')
  graph.unbindVariable(shape.id, 'opacity')
  to('Large')
  expect(at('Shape').type).toBe('FRAME')
  expect(at('Shape').boundVariables.opacity).toBeUndefined()
})

/** A Pill set (Shape=Round with a Label text property, and Shape=Square) to nest in variants. */
function pillSet(graph: SceneGraph, pageId: string) {
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Pill',
    x: 400,
    componentPropertyDefinitions: [
      { id: 'pill:shape', name: 'Shape', type: 'VARIANT', defaultValue: 'Round' },
      { id: 'pill:label', name: 'Label', type: 'TEXT', defaultValue: 'Pill' }
    ]
  })
  const ids: Record<string, string> = {}
  for (const shape of ['Round', 'Square']) {
    const variant = graph.createNode('COMPONENT', set.id, {
      name: `Shape=${shape}`,
      componentPropertyValues: { Shape: shape }
    })
    graph.createNode('TEXT', variant.id, {
      name: 'Label',
      text: 'Pill',
      componentPropertyReferences: [{ field: 'TEXT', propertyId: 'pill:label' }]
    })
    ids[shape] = variant.id
  }
  return { pill: must(ids.Round), square: must(ids.Square) }
}

test('a nested instance the other variant lacks comes back switched as it was', () => {
  let square = ''
  const { graph, chip, at, to } = chipDrawing(
    { Small: [{ name: 'Pill', type: 'INSTANCE', of: 'pill' }], Large: [] },
    (scene, pageId) => {
      const pills = pillSet(scene, pageId)
      square = pills.square
      return pills
    }
  )
  graph.swapInstanceComponent(at('Pill').id, square)
  expect(instanceMainComponent(graph, at('Pill'))?.id).toBe(square)
  to('Large')
  expect(graph.getChildren(chip.id).some((layer) => layer.name === 'Pill')).toBe(false)
  to('Small')
  expect(instanceMainComponent(graph, at('Pill'))?.id).toBe(square)
})

test('a nested instance the other variant lacks comes back with its property values', () => {
  const { editor, graph, chip, at, to } = chipDrawing(
    { Small: [{ name: 'Pill', type: 'INSTANCE', of: 'pill' }], Large: [] },
    pillSet
  )
  editor.setInstanceComponentProperty(at('Pill').id, 'pill:label', 'Mine')
  expect(at('Pill', 'Label').text).toBe('Mine')
  to('Large')
  expect(graph.getChildren(chip.id).some((layer) => layer.name === 'Pill')).toBe(false)
  to('Small')
  expect(at('Pill').componentPropertyAssignments['pill:label']).toBe('Mine')
  expect(at('Pill', 'Label').text).toBe('Mine')
})

test('a layer in a removed nested instance takes no binding where no instance holds it', () => {
  const { graph, chip, at, to } = chipDrawing(
    {
      Small: [{ name: 'Pill', type: 'INSTANCE', of: 'pill' }],
      Large: [],
      Huge: [{ name: 'Pill', type: 'FRAME', children: [{ name: 'Label', type: 'RECTANGLE' }] }]
    },
    pillSet
  )
  const collection = graph.createCollection('Look')
  const faded = graph.createVariable('Faded', 'FLOAT', collection.id, 0.5)
  // The nested Pill binds its label's opacity, an override the Pill holds.
  const pill = at('Pill')
  const label = at('Pill', 'Label')
  setInstanceOverride(pill.instanceOverrides, pill.id, label.id, 'boundVariables/opacity')
  graph.bindVariable(label.id, 'opacity', faded.id)
  // Only the nested Pill holds it, as a file saves an override on the instance that made it.
  chip.instanceOverrides.descendants.delete(label.id)
  to('Large')
  to('Huge')
  expect(at('Pill').type).toBe('FRAME')
  expect(at('Pill', 'Label').boundVariables.opacity).toBeUndefined()
})

test('a switch lays out the auto layout around it, and undo puts the siblings back', () => {
  const { editor, graph, large } = switchable()
  const pageId = editor.state.currentPageId
  const row = graph.createNode('FRAME', pageId, {
    name: 'Row',
    y: 300,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10
  })
  const small = must(graph.getNode(must(large.parentId))).childIds[0]
  const chip = must(graph.createInstance(must(small), row.id))
  const sibling = graph.createNode('RECTANGLE', row.id, { name: 'Sibling', width: 20, height: 20 })
  editor.runLayoutForNode(row.id)
  expect(must(graph.getNode(sibling.id)).x).toBe(50)
  editor.select([chip.id])
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(must(graph.getNode(sibling.id)).x).toBe(90)
  editor.undo.undo()
  expect(must(graph.getNode(chip.id)).width).toBe(40)
  expect(must(graph.getNode(sibling.id)).x).toBe(50)
  expect(editor.state.selectedIds.size).toBe(0)
  editor.undo.redo()
  expect(must(graph.getNode(sibling.id)).x).toBe(90)
  expect(must(graph.getNode(chip.id)).width).toBe(80)
})

function variantsOf(
  editor: ReturnType<typeof createEditor>,
  fill: (componentId: string, size: string) => void
) {
  const { graph } = editor
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Chip',
    componentPropertyDefinitions: [
      { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: 'Small' }
    ]
  })
  for (const size of ['Small', 'Large']) {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      width: 40,
      height: 20,
      componentPropertyValues: { Size: size }
    })
    fill(component.id, size)
  }
  const small = must(graph.getChildren(set.id)[0])
  const chip = must(graph.createInstance(small.id, pageId, { x: 500 }))
  const child = () => must(graph.getChildren(chip.id)[0])
  return { chip, child }
}

test('a nested instance hidden in the instance stays hidden after a switch', () => {
  const editor = createEditor()
  const { graph } = editor
  const dot = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Dot',
    width: 4,
    height: 4
  })
  const { chip, child } = variantsOf(editor, (componentId) => {
    graph.createInstance(dot.id, componentId, { name: 'Dot' })
  })
  editor.updateNodeWithUndo(child().id, { visible: false })
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(child().visible).toBe(false)
})

test('a boolean layer takes the union of a variant that sets no operation', () => {
  const editor = createEditor()
  const { chip, child } = variantsOf(editor, (componentId, size) => {
    editor.graph.createNode('BOOLEAN_OPERATION', componentId, {
      name: 'Shape',
      booleanOperation: size === 'Small' ? 'SUBTRACT' : undefined
    })
  })
  expect(child().booleanOperation).toBe('SUBTRACT')
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(child().booleanOperation).toBe('UNION')
})

function withNestedDot(
  edit: (editor: ReturnType<typeof createEditor>, dotId: string, size: string) => void
) {
  const editor = createEditor()
  const { graph } = editor
  const dot = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Dot',
    width: 4,
    height: 4
  })
  const { chip, child } = variantsOf(editor, (componentId, size) => {
    const nested = must(graph.createInstance(dot.id, componentId, { name: 'Dot' }))
    edit(editor, nested.id, size)
  })
  return { editor, chip, child }
}

test('a nested instance follows what the new variant sets on it, past its own binding', () => {
  const tokens = { small: '', large: '', width: '' }
  const { editor, chip, child } = withNestedDot((editing, dotId, size) => {
    const { graph } = editing
    const collection = graph.createCollection(`Tokens ${size}`)
    const height = graph.createVariable(
      'Height',
      'FLOAT',
      collection.id,
      size === 'Small' ? 10 : 20
    ).id
    if (size === 'Small') {
      tokens.small = height
      tokens.width = graph.createVariable('Width', 'FLOAT', collection.id, 12).id
    } else {
      tokens.large = height
    }
    editing.bindVariable(dotId, 'height', height)
    editing.updateNodeWithUndo(dotId, { visible: size === 'Large' })
  })
  editor.bindVariable(child().id, 'width', tokens.width)
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(child().boundVariables.height).toBe(tokens.large)
  expect(child().height).toBe(20)
  expect(child().boundVariables.width).toBe(tokens.width)
  expect(child().visible).toBe(true)
  const large = must(editor.graph.variables.get(tokens.large))
  const mode = must(editor.graph.variableCollections.get(large.collectionId)).defaultModeId
  editor.updateVariableValue(tokens.large, mode, 30)
  expect(child().height).toBe(30)
})

test('a nested instance drops a binding the new variant does not set, and keeps its own', () => {
  const tokens = { small: '', own: '' }
  const { editor, chip, child } = withNestedDot((editing, dotId, size) => {
    if (size === 'Small') {
      const collection = editing.graph.createCollection('Tokens')
      tokens.small = editing.graph.createVariable('Height', 'FLOAT', collection.id, 10).id
      tokens.own = editing.graph.createVariable('Radius', 'FLOAT', collection.id, 2).id
      editing.bindVariable(dotId, 'height', tokens.small)
      editing.bindVariable(dotId, 'cornerRadius', tokens.small)
    }
  })
  editor.bindVariable(child().id, 'cornerRadius', tokens.own)
  expect(child().boundVariables.height).toBe(tokens.small)
  editor.switchInstanceVariant(chip.id, 'Size', 'Large')
  expect(child().boundVariables.height).toBeUndefined()
  expect(child().boundVariables.cornerRadius).toBe(tokens.own)
})
