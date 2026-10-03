import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

function setupToolTest() {
  const graph = new SceneGraph()
  return { graph, figma: new FigmaAPI(graph) }
}

function getTool(name: string) {
  return expectDefined(
    ALL_TOOLS.find((tool) => tool.name === name),
    `tool ${name}`
  )
}

type OverviewResult = {
  selectedCount: number
  selectedIds?: string[]
  selection: Array<{
    id: string
    childCount: number
    children?: Array<{ id: string; children?: Array<{ id: string }> }>
  }>
  imageError?: string
  base64?: string
}

type DetailResult = {
  requestedIds: string[]
  returnedNodeCount: number
  nodes: Array<{ id: string; children?: Array<{ id: string; children?: Array<{ id: string }> }> }>
}

function select(figma: ReturnType<typeof setupToolTest>['figma'], nodes: FigmaNodeProxy[]) {
  figma.currentPage.selection = nodes
}

describe('selection context tools', () => {
  test('returns a PNG and a compact tree through depth 2', async () => {
    const { figma } = setupToolTest()
    const root = figma.createFrame()
    const child = figma.createFrame()
    const grandchild = figma.createFrame()
    const hiddenDepth = figma.createRectangle()
    root.appendChild(child)
    child.appendChild(grandchild)
    grandchild.appendChild(hiddenDepth)
    select(figma, [root])
    const exportCalls: string[][] = []
    figma.exportImage = async (ids) => {
      exportCalls.push(ids)
      return new Uint8Array([1, 2, 3])
    }

    const result = (await getTool('see_user_selection').execute(figma, {})) as OverviewResult

    expect(result.selectedCount).toBe(1)
    expect(result.selectedIds).toEqual([root.id])
    expect(result.selection[0]?.children?.[0]?.id).toBe(child.id)
    expect(result.selection[0]?.children?.[0]?.children?.[0]?.id).toBe(grandchild.id)
    expect(result.selection[0]?.children?.[0]?.children?.[0]?.id).not.toBe(hiddenDepth.id)
    expect(result.base64).toBe('AQID')
    expect(exportCalls).toEqual([[root.id]])
  })

  test('keeps compact metadata when image export is unavailable', async () => {
    const { figma } = setupToolTest()
    const root = figma.createFrame()
    select(figma, [root])

    const result = (await getTool('see_user_selection').execute(figma, {})) as OverviewResult

    expect(result.selection[0]?.id).toBe(root.id)
    expect(result.imageError).toContain('not available')
  })

  test('does not render a selected descendant twice', async () => {
    const { figma } = setupToolTest()
    const root = figma.createFrame()
    const child = figma.createRectangle()
    root.appendChild(child)
    select(figma, [root, child])
    const exportCalls: string[][] = []
    figma.exportImage = async (ids) => {
      exportCalls.push(ids)
      return new Uint8Array([1])
    }

    await getTool('see_user_selection').execute(figma, {})

    expect(exportCalls).toEqual([[root.id]])
  })

  test('requires detail IDs to remain inside the current selection', () => {
    const { figma } = setupToolTest()
    const selected = figma.createFrame()
    const outside = figma.createRectangle()
    select(figma, [selected])

    expect(() =>
      getTool('get_user_selection_details').execute(figma, {
        ids: [selected.id, outside.id],
        depth: 1,
        include: ['geometry']
      })
    ).toThrow('unavailable in the current user selection')
  })

  test('deduplicates overlapping roots while traversing details', () => {
    const { figma } = setupToolTest()
    const root = figma.createFrame()
    const child = figma.createFrame()
    const grandchild = figma.createRectangle()
    root.appendChild(child)
    child.appendChild(grandchild)
    select(figma, [root])

    const result = getTool('get_user_selection_details').execute(figma, {
      ids: [root.id, child.id, root.id],
      depth: 2,
      include: ['layout']
    }) as DetailResult

    expect(result.requestedIds).toEqual([root.id, child.id])
    expect(result.returnedNodeCount).toBe(3)
    expect(result.nodes.map((node) => node.id)).toEqual([root.id])
    expect(result.nodes[0]?.children?.[0]?.id).toBe(child.id)
    expect(result.nodes[0]?.children?.[0]?.children?.[0]?.id).toBe(grandchild.id)
  })
})
