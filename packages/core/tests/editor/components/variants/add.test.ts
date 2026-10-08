import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function defined<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected value')
  return value
}

/** A standalone Chip component with a text property and an instance, as on Figma's canvas. */
function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const chip = editor.graph.createNode('COMPONENT', page, {
    name: 'Chip',
    x: 40,
    y: 40,
    width: 80,
    height: 32
  })
  const label = editor.graph.createNode('TEXT', chip.id, { name: 'Label', text: 'Chip' })
  const property = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
  const instance = defined(editor.graph.createInstance(chip.id, page, { x: 40, y: 200 }))
  return { editor, chip, property, instance }
}

// Live Figma 126: Add variant on a standalone component and then on its set.
describe('Add variant', () => {
  test('turns a standalone component into a set the way Figma does', () => {
    const { editor, chip, property, instance } = setup()
    editor.undo.clear()
    const added = defined(editor.addVariant(chip.id))

    const set = defined(editor.graph.getNode(defined(chip.parentId)))
    expect(set).toMatchObject({ type: 'COMPONENT_SET', name: 'Chip', layoutMode: 'NONE' })
    expect(set).toMatchObject({ x: 20, y: 20, width: 120, height: 124 })
    const [variant, value] = set.componentPropertyDefinitions
    expect(variant).toMatchObject({
      name: 'Property 1',
      type: 'VARIANT',
      defaultValue: 'Default',
      variantOptions: ['Default', 'Variant2']
    })
    expect(value).toMatchObject({ id: property, name: 'Label', type: 'TEXT' })

    const copy = defined(editor.graph.getNode(added))
    expect(chip).toMatchObject({ name: 'Property 1=Default', x: 20, y: 20 })
    expect(chip.componentPropertyDefinitions).toEqual([])
    expect(copy).toMatchObject({ name: 'Property 1=Variant2', x: 20, y: 72 })
    expect(instance.componentId).toBe(chip.id)
    expect([...editor.state.selectedIds]).toEqual([added])

    // One step: the component is back as it was, with its property and outside a set.
    editor.undo.undo()
    expect(editor.graph.getNode(added)).toBeUndefined()
    expect(chip).toMatchObject({ name: 'Chip', x: 40, y: 40 })
    expect(chip.componentPropertyDefinitions.map((item) => item.id)).toEqual([property])
    expect(editor.graph.getNode(defined(chip.parentId))?.type).toBe('CANVAS')
    expect(editor.undo.undo()).toBeNull()
  })

  test('from a set, appends the next value below the last variant and grows the set', () => {
    const { editor, chip } = setup()
    editor.addVariant(chip.id)
    const setId = defined(chip.parentId)
    const third = defined(editor.addVariant(setId))

    const set = defined(editor.graph.getNode(setId))
    expect(defined(editor.graph.getNode(third))).toMatchObject({
      name: 'Property 1=Variant3',
      x: 20,
      y: 124
    })
    expect(set).toMatchObject({ width: 120, height: 176 })
    expect(set.componentPropertyDefinitions[0]?.variantOptions).toEqual([
      'Default',
      'Variant2',
      'Variant3'
    ])
    editor.undo.undo()
    expect(editor.graph.getNode(third)).toBeUndefined()
    expect(set.height).toBe(124)
    expect(set.componentPropertyDefinitions[0]?.variantOptions).toEqual(['Default', 'Variant2'])
  })

  test('skips values variants use even when the set does not list them', () => {
    const { editor, chip } = setup()
    editor.addVariant(chip.id)
    const set = defined(editor.graph.getNode(defined(chip.parentId)))
    // As some files save it: Variant2 is in use but missing from the declared options.
    const [variant, ...rest] = set.componentPropertyDefinitions
    editor.graph.updateNode(set.id, {
      componentPropertyDefinitions: [{ ...defined(variant), variantOptions: ['Default'] }, ...rest]
    })
    const added = defined(editor.addVariant(set.id))
    expect(defined(editor.graph.getNode(added)).name).toBe('Property 1=Variant3')
    expect(editor.getComponentSetVariantConflicts(set.id)).toEqual([])
  })

  test('in a set with auto layout, the copy follows the last variant where layout puts it', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const set = editor.graph.createNode('COMPONENT_SET', page, {
      name: 'Badge',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 16,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      componentPropertyDefinitions: [
        {
          id: 'variant:state',
          name: 'State',
          type: 'VARIANT',
          defaultValue: 'Info',
          variantOptions: ['Info', 'Warning']
        }
      ]
    })
    for (const state of ['Info', 'Warning'])
      editor.graph.createNode('COMPONENT', set.id, {
        name: `State=${state}`,
        width: 71,
        height: 25,
        componentPropertyValues: { State: state }
      })
    await Promise.resolve()
    editor.runLayoutForNode(set.id)
    const width = set.width
    // As loaded from a .fig: layout prefers the geometry the file saved.
    for (const variant of editor.graph.getChildren(set.id))
      editor.graph.updateNode(variant.id, {
        derivedLayout: { x: variant.x, y: variant.y, width: variant.width, height: variant.height }
      })
    editor.graph.updateNode(set.id, { derivedLayout: { width, height: set.height } })

    const added = defined(editor.addVariant(set.id))
    const copy = defined(editor.graph.getNode(added))
    expect(copy).toMatchObject({ name: 'State=Variant2', x: 16 + 2 * (71 + 16), y: 16 })
    expect(set.width).toBe(width + 71 + 16)
    editor.undo.undo()
    expect(editor.graph.getNode(added)).toBeUndefined()
    expect(set.width).toBe(width)
    expect(set.derivedLayout).toEqual({ width, height: set.height })
  })

  test('a duplicated variant keeps its values for the caller to change', () => {
    const { editor, chip } = setup()
    const second = defined(editor.addVariant(chip.id))
    const copy = defined(editor.duplicateVariant(second))
    expect(defined(editor.graph.getNode(copy))).toMatchObject({
      name: 'Property 1=Variant2',
      y: 124
    })
    expect(editor.getComponentSetVariantConflicts(defined(chip.parentId))).toHaveLength(1)
  })
})

describe('variant values', () => {
  test('adds a value no variant uses yet and removes it again', () => {
    const { editor, chip } = setup()
    editor.addVariant(chip.id)
    const setId = defined(chip.parentId)
    const propertyId = defined(editor.getComponentSetPropertyDefs(setId)[0]).id
    expect(editor.addVariantValue(setId, propertyId, 'Pressed')).toBe(true)
    expect(editor.getVariantOptions(setId, propertyId)).toEqual(['Default', 'Variant2', 'Pressed'])
    expect(editor.addVariantValue(setId, propertyId, 'Pressed')).toBe(false)
    expect(editor.removeVariantValue(setId, propertyId, 'Pressed')).toEqual({ kind: 'changed' })
    expect(editor.getVariantOptions(setId, propertyId)).toEqual(['Default', 'Variant2'])
  })

  test('removing a value variants use needs a replacement that keeps combinations unique', () => {
    const { editor, chip } = setup()
    const second = defined(editor.addVariant(chip.id))
    const setId = defined(chip.parentId)
    const propertyId = defined(editor.getComponentSetPropertyDefs(setId)[0]).id
    expect(editor.removeVariantValue(setId, propertyId, 'Variant2')).toEqual({ kind: 'invalid' })
    // Variant2 → Default would give two variants the same combination.
    expect(editor.removeVariantValue(setId, propertyId, 'Variant2', 'Default')).toMatchObject({
      kind: 'conflict'
    })
    editor.addVariantValue(setId, propertyId, 'Hover')
    expect(editor.removeVariantValue(setId, propertyId, 'Variant2', 'Hover')).toEqual({
      kind: 'changed'
    })
    expect(defined(editor.graph.getNode(second)).name).toBe('Property 1=Hover')
    editor.undo.undo()
    expect(defined(editor.graph.getNode(second)).name).toBe('Property 1=Variant2')
  })
})
