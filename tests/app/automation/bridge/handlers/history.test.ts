import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { createTab } from '@/app/tabs'

import { request, useAutomationHandlerGlobals } from '#tests/helpers/automation/handlers'

useAutomationHandlerGlobals()

describe('undo and redo', () => {
  test('step through automation changes and report their labels', async () => {
    const tab = createTab()
    const store = tab.store
    const node = store.createShape('RECTANGLE', 0, 0, 100, 100)
    await request('tool', {
      document_id: tab.id,
      name: 'update_node',
      args: { id: node, opacity: 0.5 }
    })

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toEqual({ applied: true, label: 'Agent: update_node' })
    expect(store.graph.getNode(node)?.opacity).toBe(1)

    const redone = await request('redo', { document_id: tab.id })
    expect(redone.result).toEqual({ applied: true, label: 'Agent: update_node' })
    expect(store.graph.getNode(node)?.opacity).toBe(0.5)
  })

  test('refuse to undo or redo a change made in the editor', async () => {
    const tab = createTab()
    const store = tab.store
    const node = store.createShape('RECTANGLE', 0, 0, 100, 100)
    store.updateNodeWithUndo(node, { opacity: 0.5 }, 'Set opacity')

    await expect(request('undo', { document_id: tab.id })).rejects.toThrow(
      'The last change ("Set opacity") was made in the editor'
    )
    expect(store.graph.getNode(node)?.opacity).toBe(0.5)

    store.undoAction()
    await expect(request('redo', { document_id: tab.id })).rejects.toThrow(
      'The last undone change ("Set opacity") was made in the editor'
    )
    expect(store.graph.getNode(node)?.opacity).toBe(1)
  })

  test('wait while the pen draws, whose last point becomes a step when undo runs', async () => {
    const tab = createTab()
    const store = tab.store
    const node = store.createShape('RECTANGLE', 0, 0, 100, 100)
    await request('tool', {
      document_id: tab.id,
      name: 'update_node',
      args: { id: node, opacity: 0.5 }
    })
    store.setTool('PEN')
    store.penAddVertex(0, 0)
    store.penAddVertex(100, 0)

    await expect(request('undo', { document_id: tab.id })).rejects.toThrow(
      'A path is being drawn with the pen'
    )
    expect(store.state.penState?.vertices).toHaveLength(2)
    expect(store.graph.getNode(node)?.opacity).toBe(0.5)
  })

  test('report nothing to redo on a fresh history', async () => {
    const tab = createTab()
    const response = await request('redo', { document_id: tab.id })
    expect(response.result).toEqual({ applied: false, label: null })
  })

  test('undo reverts a layer an automation tool created', async () => {
    const tab = createTab()
    const created = await request('tool', {
      document_id: tab.id,
      name: 'create_shape',
      args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 40, name: 'Card' }
    })
    const id = String(created.result.id)
    expect(tab.store.graph.getNode(id)).toBeDefined()

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toMatchObject({ applied: true, label: 'Agent: create_shape' })
    expect(tab.store.graph.getNode(id)).toBeUndefined()
  })

  test('undo and redo of a deletion leave the layers it did not touch alone', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const kept = tab.store.createShape('RECTANGLE', 0, 0, 40, 40)
    const deleted = tab.store.createShape('RECTANGLE', 60, 0, 40, 40)
    const keptNode = graph.getNode(kept)
    const pageId = tab.store.state.currentPageId
    const order = [...(graph.getNode(pageId)?.childIds ?? [])]
    await request('tool', { document_id: tab.id, name: 'delete_nodes', args: { ids: [deleted] } })

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(deleted)?.x).toBe(60)
    expect(graph.getNode(pageId)?.childIds).toEqual(order)
    expect(graph.getNode(kept)).toBe(keptNode)

    await request('redo', { document_id: tab.id })
    expect(graph.getNode(deleted)).toBeUndefined()
    expect(graph.getNode(kept)).toBe(keptNode)
  })

  test('undo reverts a render into a frame on another page', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const frame = graph.createNode('FRAME', otherPage.id, { width: 200, height: 200 })
    const rendered = await request('tool', {
      document_id: tab.id,
      name: 'render',
      args: {
        parent_id: frame.id,
        jsx: '<Frame name="Rendered" w={40} h={40} />'
      }
    })
    const id = String(rendered.result.id)
    expect(graph.getNode(id)?.parentId).toBe(frame.id)

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(id)).toBeUndefined()
    expect(graph.getNode(frame.id)?.childIds).toEqual([])
  })

  test('undo reverts a render that replaces a layer on another page', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const frame = graph.createNode('FRAME', otherPage.id, { width: 200, height: 200 })
    const placeholder = graph.createNode('RECTANGLE', frame.id, { width: 40, height: 40 })
    // replace_id decides where the layer goes, so its page records the change.
    const rendered = await request('tool', {
      document_id: tab.id,
      name: 'render',
      args: {
        jsx: '<Frame name="Rendered" w={40} h={40} />',
        replace_id: placeholder.id,
        parent_id: tab.store.state.currentPageId
      }
    })
    const id = String(rendered.result.id)
    expect(graph.getNode(id)?.parentId).toBe(frame.id)

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(id)).toBeUndefined()
    expect(graph.getNode(frame.id)?.childIds).toEqual([placeholder.id])
  })

  test('undo reverts a script’s edits to other pages, pages, and variables', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const card = graph.createNode('FRAME', otherPage.id, { name: 'Card', width: 200, height: 200 })
    const pages = graph.getPages().map((page) => page.id)
    await request('eval', {
      document_id: tab.id,
      code: `
        const other = figma.root.children.find((page) => page.name === 'Other')
        other.findOne((node) => node.name === 'Card').name = 'Renamed'
        other.name = 'Renamed page'
        figma.createPage().name = 'Added'
        const colors = figma.variables.createVariableCollection('Colors')
        figma.variables.createVariable('Brand', colors, 'COLOR')
      `
    })
    expect(graph.getNode(card.id)?.name).toBe('Renamed')
    expect(graph.variables.size).toBe(1)

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toMatchObject({ applied: true, label: 'Agent: eval' })
    expect(graph.getNode(card.id)?.name).toBe('Card')
    expect(graph.getNode(otherPage.id)?.name).toBe('Other')
    expect(graph.getPages().map((page) => page.id)).toEqual(pages)
    expect(graph.variables.size).toBe(0)
    expect(graph.variableCollections.size).toBe(0)

    await request('redo', { document_id: tab.id })
    expect(graph.getNode(card.id)?.name).toBe('Renamed')
    expect(graph.getPages().map((page) => page.name)).toEqual(['Page 1', 'Renamed page', 'Added'])
    expect(graph.variables.size).toBe(1)
  })

  test('a read-only eval leaves the history unchanged', async () => {
    const tab = createTab()
    await request('eval', { document_id: tab.id, code: 'return figma.currentPage.name' })
    expect(tab.store.undo.canUndo).toBe(false)
  })
})

// The stdio MCP server sends render JSX as written; these are what #830 lost on that path.
