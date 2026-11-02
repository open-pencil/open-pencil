import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

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

test('switching a deep variant and back stays linear in its layers', () => {
  const { editor, chip, deepest } = switchable(24, 3)
  editor.updateNodeWithUndo(deepest().id, { opacity: 0.5 })
  const started = performance.now()
  for (let round = 0; round < 5; round++) {
    editor.switchInstanceVariant(chip.id, 'Size', 'Large')
    editor.switchInstanceVariant(chip.id, 'Size', 'Small')
  }
  expect(performance.now() - started).toBeLessThan(1000)
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
