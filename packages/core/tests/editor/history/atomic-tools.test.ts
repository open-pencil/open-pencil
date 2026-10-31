import { describe, expect, test } from 'bun:test'

import { node, setup, withOtherPage } from '#core-tests/helpers/atomic-tool'

import { createEditor, executeAtomicTool } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { ALL_TOOLS, type ToolDef } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

describe('atomic agent tools', () => {
  test('component edits and undo propagate through the editor synchronizer', async () => {
    const editor = createEditor()
    const figma = new FigmaAPI(editor.graph)
    const component = figma.createComponent()
    const instance = component.createInstance()
    await Promise.resolve()
    const def = ALL_TOOLS.find((tool) => tool.name === 'set_opacity')
    if (!def) throw new Error('Missing set_opacity')
    executeAtomicTool(editor, figma, def, { id: component.id, value: 0.5 })
    await Promise.resolve()
    expect(instance.opacity).toBe(0.5)
    editor.undo.undo()
    await Promise.resolve()
    expect(component.opacity).toBe(1)
    expect(instance.opacity).toBe(1)
    editor.undo.redo()
    await Promise.resolve()
    expect(instance.opacity).toBe(0.5)
  })

  test('undo targets the original page and keeps unrelated later changes', () => {
    const { figma, editor, undo, rectangle, tool } = setup()
    const pageId = figma.currentPage.id
    executeAtomicTool(editor, figma, tool('set_opacity'), { id: rectangle.id, value: 0.5 })
    const another = figma.createPage()
    figma.currentPage = another
    rectangle.name = 'Later name'
    undo.undo()
    expect(rectangle.opacity).toBe(1)
    expect(rectangle.name).toBe('Later name')
    expect(rectangle.parent?.id).toBe(pageId)
    expect(figma.currentPage.id).toBe(another.id)
    undo.redo()
    expect(rectangle.opacity).toBe(0.5)
  })

  test('variable values and bound nodes are undoable across pages', () => {
    const { figma, editor, undo, rectangle, tool } = setup()
    const collection = figma.variables.createVariableCollection('Colors')
    const variable = figma.variables.createVariable('Brand', collection, 'COLOR')
    variable.setValueForMode(collection.defaultModeId, { r: 1, g: 0, b: 0, a: 1 })
    tool('set_fill').execute(figma, { id: rectangle.id, color: '#ff0000' })
    new OpenPencilAPI(figma).bindVariable(rectangle.id, 'fills/0/color', variable)
    const page = figma.createPage()
    figma.currentPage = page
    executeAtomicTool(editor, figma, tool('set_variable'), {
      id: variable.id,
      mode: collection.defaultModeId,
      value: '#00ff00'
    })
    expect(
      figma.variables.getVariableById(variable.id)?.valuesByMode[collection.defaultModeId]
    ).toMatchObject({ g: 1 })
    undo.undo()
    expect(
      figma.variables.getVariableById(variable.id)?.valuesByMode[collection.defaultModeId]
    ).toMatchObject({ r: 1, g: 0 })
    undo.redo()
    expect(
      figma.variables.getVariableById(variable.id)?.valuesByMode[collection.defaultModeId]
    ).toMatchObject({ r: 0, g: 1 })
  })

  test.each(['node', 'variable'] as const)('replays %s property presence exactly', (kind) => {
    for (const before of ['absent', 'undefined', 'value'] as const) {
      for (const after of ['absent', 'undefined', 'value'] as const) {
        if (before === after) continue
        const { graph, figma, editor, undo, rectangle, tool } = setup()
        const collection = graph.createCollection('Test')
        const variable = graph.createVariable('Test', 'STRING', collection.id, '')
        const target = kind === 'node' ? graph.getNode(rectangle.id) : variable
        if (!target) throw new Error('Missing target')
        const key = kind === 'node' ? 'booleanOperation' : 'key'
        const value = kind === 'node' ? 'UNION' : 'variable-key'
        const set = (state: typeof before) => {
          if (state === 'absent') Reflect.deleteProperty(target, key)
          else Reflect.set(target, key, state === 'undefined' ? undefined : value)
        }
        const assertState = (state: typeof before) => {
          expect(Object.hasOwn(target, key)).toBe(state !== 'absent')
          expect(Reflect.get(target, key)).toBe(state === 'value' ? value : undefined)
        }
        set(before)
        executeAtomicTool(
          editor,
          figma,
          {
            ...tool('set_opacity'),
            execute: () => {
              // Code that writes into a node directly reports it first.
              if (kind === 'node') graph.willChangeNode(graph.getNode(rectangle.id))
              set(after)
            }
          },
          {}
        )
        assertState(after)
        expect(undo.canUndo).toBe(true)
        undo.undo()
        assertState(before)
        undo.redo()
        assertState(after)
      }
    }
  })

  test.each(['node', 'variable'] as const)('rejects replacement of a captured %s', (kind) => {
    const { graph, figma, editor, undo, rectangle, tool } = setup()
    const collection = graph.createCollection('Test')
    const variable = graph.createVariable('Test', 'STRING', collection.id, '')
    const node = graph.getNode(rectangle.id)
    if (!node) throw new Error('Missing node')
    expect(() =>
      executeAtomicTool(
        editor,
        figma,
        {
          ...tool('set_opacity'),
          execute: () => {
            if (kind === 'node') graph.nodes.set(node.id, structuredClone(node))
            else graph.variables.set(variable.id, structuredClone(variable))
          }
        },
        {}
      )
    ).toThrow('Atomic tools must not change')
    expect(graph.getNode(node.id)).toBe(node)
    expect(graph.variables.get(variable.id)).toBe(variable)
    expect(undo.canUndo).toBe(false)
  })

  test('rejects and restores instance index corruption even on reported success', () => {
    const { graph, figma, editor, undo, tool } = setup()
    const component = figma.createComponent()
    const instance = component.createInstance()
    const before = structuredClone(graph.instanceIndex)
    expect(() =>
      executeAtomicTool(
        editor,
        figma,
        {
          ...tool('set_opacity'),
          execute: () => {
            graph.instanceIndex.get(component.id)?.delete(instance.id)
          }
        },
        {}
      )
    ).toThrow('Atomic tools must not change')
    expect(graph.instanceIndex).toEqual(before)
    expect(undo.canUndo).toBe(false)
  })

  test('partial failures roll back without adding history', () => {
    const { figma, editor, undo, rectangle, tool } = setup()
    const def: ToolDef = {
      ...tool('set_opacity'),
      description: 'failure seam',
      execute: () => {
        rectangle.opacity = 0.25
        throw new Error('Failed')
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow('Failed')
    expect(rectangle.opacity).toBe(1)
    expect(undo.canUndo).toBe(false)
  })

  test.each([
    'create node',
    'delete node',
    'create variable',
    'delete variable',
    'reparent',
    'delete collection'
  ])('rolls back forbidden %s and preserves graph bookkeeping', (operation) => {
    const { graph, figma, editor, undo, rectangle, tool } = setup()
    const collection = graph.createCollection('Values')
    const variable = graph.createVariable('Spacing', 'FLOAT', collection.id, 8)
    const component = figma.createComponent()
    const instance = component.createInstance()
    const nodes = structuredClone(graph.nodes)
    const variables = structuredClone(graph.variables)
    const collections = structuredClone(graph.variableCollections)
    const index = structuredClone(graph.instanceIndex)
    const modes = structuredClone(graph.activeMode)
    const original = graph.getNode(instance.id)
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        rectangle.opacity = 0.25
        switch (operation) {
          case 'create node':
            component.createInstance()
            break
          case 'delete node':
            graph.deleteNode(instance.id)
            break
          case 'create variable':
            graph.createVariable('New', 'FLOAT', collection.id, 4)
            break
          case 'delete variable':
            graph.removeVariable(variable.id)
            break
          case 'reparent':
            graph.reparentNode(rectangle.id, component.id)
            break
          case 'delete collection':
            graph.removeCollection(collection.id)
            break
        }
        throw new Error('Original failure')
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow('Original failure')
    expect(graph.nodes).toEqual(nodes)
    expect(graph.variables).toEqual(variables)
    expect(graph.variableCollections).toEqual(collections)
    expect(graph.instanceIndex).toEqual(index)
    expect(graph.activeMode).toEqual(modes)
    expect(graph.getNode(instance.id)).toBe(original)
    expect(undo.canUndo).toBe(false)
  })

  test('rejects a structural edit even when the callback reports success', () => {
    const { graph, figma, editor, undo, tool } = setup()
    const nodes = structuredClone(graph.nodes)
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        figma.createRectangle()
        return { ok: true }
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow('must not create or remove')
    expect(graph.nodes).toEqual(nodes)
    expect(undo.canUndo).toBe(false)
  })

  test('error results roll back; no-op operations do not create history', () => {
    const { figma, editor, undo, rectangle, tool } = setup()
    executeAtomicTool(editor, figma, tool('set_opacity'), { id: rectangle.id, value: 1 })
    expect(undo.canUndo).toBe(false)
    expect(() =>
      executeAtomicTool(editor, figma, tool('set_opacity'), { id: 'missing', value: 0 })
    ).toThrow()
    expect(undo.canUndo).toBe(false)
  })

  test('aborted and closed/replaced targets are rejected before mutation', () => {
    const { figma, editor, rectangle, tool } = setup()
    const signal = AbortSignal.abort()
    const args = { id: rectangle.id, value: 0.5 }
    expect(() => executeAtomicTool(editor, figma, tool('set_opacity'), args, { signal })).toThrow()
    expect(() =>
      executeAtomicTool(editor, figma, tool('set_opacity'), args, { isLive: () => false })
    ).toThrow('no longer open')
    editor.graph = new SceneGraph()
    expect(() => executeAtomicTool(editor, figma, tool('set_opacity'), args)).toThrow(
      'no longer open'
    )
    expect(rectangle.opacity).toBe(1)
  })

  test('back-to-back calls produce separate undo entries', async () => {
    const { figma, editor, undo, rectangle, tool } = setup()
    await Promise.all(
      [0.5, 0.25].map(async (value) =>
        executeAtomicTool(editor, figma, tool('set_opacity'), { id: rectangle.id, value })
      )
    )
    expect(rectangle.opacity).toBe(0.25)
    undo.undo()
    expect(rectangle.opacity).toBe(0.5)
    undo.undo()
    expect(rectangle.opacity).toBe(1)
  })

  test.each(['throw', 'error result'] as const)(
    'an edit across two pages rolls back whole on %s',
    (failure) => {
      const { graph, figma, editor, undo, rectangle, tool, recorded, onRecorded } = setup()
      const { rect } = withOtherPage(graph)
      const first = node(graph, rectangle.id)
      const def: ToolDef = {
        ...tool('set_opacity'),
        execute: () => {
          graph.updateNode(rect.id, { opacity: 0.25 })
          graph.updateNode(first.id, { opacity: 0.75 })
          if (failure === 'throw') throw new Error('Failed')
          return { error: 'Failed' }
        }
      }
      expect(() => executeAtomicTool(editor, figma, def, {}, { onRecorded })).toThrow('Failed')
      expect(rect.opacity).toBe(1)
      expect(first.opacity).toBe(1)
      expect(graph.getNode(rect.id)).toBe(rect)
      expect(graph.getNode(first.id)).toBe(first)
      expect(undo.canUndo).toBe(false)
      expect(recorded).toHaveLength(1)
      expect(recorded[0].updated).toEqual([])
    }
  )

  test('a document far above 10000 layers takes a one-property edit', () => {
    const { graph, figma, editor, undo, rectangle, tool, recorded, onRecorded } = setup()
    for (const pageId of [figma.currentPage.id, graph.addPage('Second').id]) {
      for (let f = 0; f < 2_600; f++) {
        const frame = graph.createNode('FRAME', pageId)
        for (let r = 0; r < 9; r++) graph.createNode('RECTANGLE', frame.id)
      }
    }
    expect(graph.nodes.size).toBeGreaterThan(50_000)
    executeAtomicTool(
      editor,
      figma,
      tool('set_opacity'),
      { id: rectangle.id, value: 0.5 },
      { onRecorded }
    )
    expect(rectangle.opacity).toBe(0.5)
    expect(recorded[0].updated).toHaveLength(1)
    undo.undo()
    expect(rectangle.opacity).toBe(1)
  })

  test('a node event the graph was not told of beforehand fails and rolls back', () => {
    const { graph, figma, editor, undo, rectangle, tool } = setup()
    const other = graph.createNode('RECTANGLE', figma.currentPage.id)
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        rectangle.opacity = 0.25
        graph.emitter.emit('node:updated', other.id, {})
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow(
      `Atomic tools must report layer changes to the scene graph (SceneGraph.willChangeNode): ${other.id}`
    )
    expect(rectangle.opacity).toBe(1)
    expect(undo.canUndo).toBe(false)
  })

  test("binding a layer inside an instance on another page restores the instance's overrides", () => {
    const { graph, figma, editor, undo, tool } = setup()
    const page = graph.addPage('Components')
    const component = graph.createNode('COMPONENT', page.id)
    graph.createNode('RECTANGLE', component.id)
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('Missing instance')
    const layer = instance.childIds[0]
    const collection = graph.createCollection('Values')
    const variable = graph.createVariable('Opacity', 'FLOAT', collection.id, 0.5)
    const overrides = structuredClone(instance.instanceOverrides)
    const args = { node_id: layer, field: 'opacity', variable_id: variable.id }

    executeAtomicTool(editor, figma, tool('bind_variable'), args)
    expect(instance.instanceOverrides).not.toEqual(overrides)
    const bound = structuredClone(instance.instanceOverrides)
    undo.undo()
    expect(graph.getNode(instance.id)).toBe(instance)
    expect(instance.instanceOverrides).toEqual(overrides)
    undo.redo()
    expect(instance.instanceOverrides).toEqual(bound)
    undo.undo()

    const failing: ToolDef = {
      ...tool('bind_variable'),
      execute: (api, input) => {
        tool('bind_variable').execute(api, input)
        throw new Error('Failed')
      }
    }
    expect(() => executeAtomicTool(editor, figma, failing, args)).toThrow('Failed')
    expect(instance.instanceOverrides).toEqual(overrides)
    expect(node(graph, layer).boundVariables).toEqual({})
  })

  test('a layer added to the graph without telling it is rejected and removed', () => {
    const { graph, figma, editor, undo, rectangle, tool } = setup()
    const keys = [...graph.nodes.keys()]
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        graph.nodes.set('silent:1', {
          ...structuredClone(node(graph, rectangle.id)),
          id: 'silent:1'
        })
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow('must not create or remove')
    expect([...graph.nodes.keys()]).toEqual(keys)
    expect(undo.canUndo).toBe(false)
  })

  test('an edit may change at most 10000 layers', () => {
    const { graph, figma, editor, undo, tool } = setup()
    const ids = Array.from(
      { length: 10_001 },
      () => graph.createNode('RECTANGLE', figma.currentPage.id).id
    )
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        for (const id of ids) graph.updateNode(id, { opacity: 0.5 })
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).toThrow(
      'This edit changes 10001 layers; one atomic agent edit may change at most 10000. Change fewer layers per call.'
    )
    expect(ids.every((id) => node(graph, id).opacity === 1)).toBe(true)
    expect(undo.canUndo).toBe(false)
  })

  test('writing the values layers already have does not count toward the limit', () => {
    const { graph, figma, editor, undo, tool } = setup()
    const ids = Array.from(
      { length: 10_001 },
      () => graph.createNode('RECTANGLE', figma.currentPage.id).id
    )
    const def: ToolDef = {
      ...tool('set_opacity'),
      execute: () => {
        for (const id of ids) graph.updateNode(id, { opacity: 1 })
      }
    }
    expect(() => executeAtomicTool(editor, figma, def, {})).not.toThrow()
    expect(undo.canUndo).toBe(false)
  })

  test('binding a paint colour on a layer bound to the whole list keeps that binding on undo and rollback', () => {
    const { graph, figma, editor, undo, rectangle, tool } = setup()
    const collection = graph.createCollection('Colors')
    const color = graph.createVariable('Brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
    tool('set_fill').execute(figma, { id: rectangle.id, color: '#ff0000' })
    graph.updateNode(rectangle.id, { boundVariables: { fills: color.id } })
    const layer = node(graph, rectangle.id)
    const args = { node_id: rectangle.id, field: 'fills/0/color', variable_id: color.id }

    executeAtomicTool(editor, figma, tool('bind_variable'), args)
    expect(layer.boundVariables).toEqual({ 'fills/0/color': color.id })
    undo.undo()
    expect(layer.boundVariables).toEqual({ fills: color.id })

    const failing: ToolDef = {
      ...tool('bind_variable'),
      execute: (api, input) => {
        tool('bind_variable').execute(api, input)
        throw new Error('Failed')
      }
    }
    expect(() => executeAtomicTool(editor, figma, failing, args)).toThrow('Failed')
    expect(layer.boundVariables).toEqual({ fills: color.id })
  })

  test('moving a nested instance in an unclaimed slot restores both instances on undo and rollback', () => {
    const { graph, figma, editor, undo, tool } = setup()
    const pageId = figma.currentPage.id
    const propertyId = 'panel:content'
    const panel = graph.createNode('COMPONENT', pageId, {
      name: 'Panel',
      componentPropertyDefinitions: [
        { id: propertyId, name: 'Content', type: 'SLOT', defaultValue: '' }
      ]
    })
    const slotFrame = graph.createNode('FRAME', panel.id, {
      name: 'Content',
      componentPropertyReferences: [{ propertyId, field: 'SLOT_CONTENT' }]
    })
    const card = graph.createNode('COMPONENT', pageId, { name: 'Card' })
    graph.createNode('RECTANGLE', card.id, { name: 'Inner' })
    graph.createInstance(card.id, slotFrame.id)
    const instance = graph.createInstance(panel.id, pageId)
    if (!instance) throw new Error('Missing instance')
    const slot = graph.getChildren(instance.id)[0]
    const nested = graph.getChildren(slot.id).find((child) => child.type === 'INSTANCE')
    const inner = nested && graph.getChildren(nested.id)[0]
    if (!nested || !inner) throw new Error('Missing nested instance')
    setInstanceOverride(instance.instanceOverrides, instance.id, inner.id, 'name', 'Renamed')
    // Claiming drops this override from the outer instance before it reports the nested one.
    setInstanceOverride(instance.instanceOverrides, instance.id, nested.id, 'name', 'Nested')
    const before = {
      instance: structuredClone(instance.instanceOverrides),
      nested: structuredClone(nested.instanceOverrides)
    }
    const expectRestored = () => {
      expect(instance.instanceOverrides).toEqual(before.instance)
      expect(nested.instanceOverrides).toEqual(before.nested)
    }
    const args = { id: nested.id, x: 40 }

    executeAtomicTool(editor, figma, tool('update_node'), args)
    expect(nested.x).toBe(40)
    expect(nested.instanceOverrides).not.toEqual(before.nested)
    undo.undo()
    expectRestored()

    const failing: ToolDef = {
      ...tool('update_node'),
      execute: (api, input) => {
        tool('update_node').execute(api, input)
        throw new Error('Failed')
      }
    }
    expect(() => executeAtomicTool(editor, figma, failing, args)).toThrow('Failed')
    expectRestored()
    expect(nested.x).not.toBe(40)
  })
})
