import { describe, expect, it } from 'bun:test'

import {
  renderJSX,
  renderTree,
  stageJSXPreview,
  type RenderPlacementInput
} from '@open-pencil/core/design-jsx'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { createStreamingJSXParser } from '@open-pencil/design-jsx'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '../helpers/assert'

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

type LayoutTree = Pick<
  SceneNode,
  'type' | 'name' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'clipsContent'
> & { children: LayoutTree[] }

function layoutTree(graph: SceneGraph, id: string): LayoutTree {
  const node = getNodeOrThrow(graph, id)
  const { type, name, x, y, width, height, rotation, clipsContent } = node
  return {
    type,
    name,
    x,
    y,
    width,
    height,
    rotation,
    clipsContent,
    children: node.childIds.map((childId) => layoutTree(graph, childId))
  }
}

async function fixture(hug = false) {
  const { graph, figma } = setupToolTest()
  const [board] = await renderJSX(
    graph,
    `<Frame name="Board" x={70} y={90} w=${hug ? '"hug"' : '{360}'} h=${hug ? '"hug"' : '{240}'} flex="col" p={20}>
      <Frame name="Row" w="${hug ? 'hug' : 'fill'}" h={100} flex="row" p={16} gap={12}>
        <Rect name="Left" w={40} h={40}/><Rect name="Right" w={50} h={40}/>
      </Frame>
    </Frame>`
  )
  const row = expectDefined(
    [...graph.getAllNodes()].find((node) => node.name === 'Row'),
    'row'
  )
  const left = expectDefined(
    [...graph.getAllNodes()].find((node) => node.name === 'Left'),
    'left'
  )
  return { graph, figma, boardId: board.id, rowId: row.id, leftId: left.id }
}

async function compareToFinal(
  setup: Awaited<ReturnType<typeof fixture>>,
  jsx: string,
  input: RenderPlacementInput
) {
  const { graph, figma } = setup
  const original = structuredClone([...graph.nodes])
  const tree = expectDefined(createStreamingJSXParser().append(jsx).tree, 'preview tree')
  const staged = expectDefined(
    await stageJSXPreview(graph, tree, input, figma.currentPageId),
    'staged preview'
  )
  expect([...graph.nodes]).toEqual(original)
  const expected = staged.nodeIds.map((id) => layoutTree(staged.graph, id))
  await getTool('render').execute(figma, { ...input, jsx })
  const page = getNodeOrThrow(graph, figma.currentPageId)
  const actual = page.childIds
    .filter((id) => expected.some((node) => node.name === graph.getNode(id)?.name))
    .map((id) => layoutTree(graph, id))
  expect(actual).toEqual(expected)
  return staged
}

describe('shared render/preview placement', () => {
  it('lays out an appended Fill child against real siblings and padding', async () => {
    const setup = await fixture()
    const staged = await compareToFinal(setup, '<Rect name="New" w="fill" h="fill"/>', {
      parent_id: setup.rowId
    })
    expect(staged.replaceId).toBe(setup.boardId)
    const row = getNodeOrThrow(setup.graph, setup.rowId)
    const added = getNodeOrThrow(setup.graph, row.childIds[2])
    expect(added.x).toBe(130)
    expect(added.width).toBe(174)
    expect(added.height).toBe(68)
  })

  it('uses insertion order before computing Fill dimensions', async () => {
    const setup = await fixture()
    await compareToFinal(setup, '<Rect name="New" w="fill" h={60}/>', {
      parent_id: setup.rowId,
      insert_index: 1
    })
    const row = getNodeOrThrow(setup.graph, setup.rowId)
    expect(row.childIds.map((id) => setup.graph.getNode(id)?.name)).toEqual([
      'Left',
      'New',
      'Right'
    ])
  })

  it('replaces a child without retaining the old child in layout calculations', async () => {
    const setup = await fixture()
    await compareToFinal(setup, '<Rect name="New" w="fill" h="fill"/>', {
      replace_id: setup.leftId
    })
    expect(setup.graph.getNode(setup.leftId)).toBeUndefined()
    const row = getNodeOrThrow(setup.graph, setup.rowId)
    expect(row.childIds.map((id) => setup.graph.getNode(id)?.name)).toEqual(['New', 'Right'])
  })

  it('recomputes Hug ancestors rather than positioning a detached child', async () => {
    const setup = await fixture(true)
    const before = getNodeOrThrow(setup.graph, setup.boardId).width
    await compareToFinal(setup, '<Rect name="New" w={140} h={80}/>', {
      parent_id: setup.rowId,
      insert_index: 1
    })
    expect(getNodeOrThrow(setup.graph, setup.boardId).width).toBeGreaterThan(before)
  })

  it('preserves replacement coordinates unless explicitly overridden by tool arguments', async () => {
    const setup = await fixture()
    await compareToFinal(setup, '<Frame name="Replacement" x={999} y={999} w={200} h={160}/>', {
      replace_id: setup.boardId,
      x: 30
    })
    const replacement = expectDefined(
      [...setup.graph.getAllNodes()].find((node) => node.name === 'Replacement'),
      'replacement'
    )
    expect({ x: replacement.x, y: replacement.y }).toEqual({ x: 30, y: 90 })
  })

  it('preserves rotated, clipped ancestors in the staged subtree', async () => {
    const setup = await fixture()
    setup.graph.updateNode(setup.boardId, { rotation: 20, clipsContent: true })
    await compareToFinal(setup, '<Rect name="New" w={300} h={180}/>', { parent_id: setup.rowId })
  })

  it('reports a top-level insertion slot and inserts fragment roots contiguously', async () => {
    const setup = await fixture()
    const staged = await compareToFinal(
      setup,
      '<><Rect name="A" w={40} h={40}/><Rect name="B" w={60} h={60}/></>',
      { insert_index: 0 }
    )
    expect(staged.replaceId).toBeUndefined()
    expect(staged.insertIndex).toBe(0)
    const page = getNodeOrThrow(setup.graph, setup.figma.currentPageId)
    expect(page.childIds.map((id) => setup.graph.getNode(id)?.name)).toEqual(['A', 'B', 'Board'])
  })

  it('rejects nonexistent targets before mutating the document', async () => {
    const setup = await fixture()
    const before = structuredClone([...setup.graph.nodes])
    await expect(
      getTool('render').execute(setup.figma, { jsx: '<Rect/>', replace_id: 'missing' })
    ).rejects.toThrow('replacement target')
    expect([...setup.graph.nodes]).toEqual(before)
  })
})

describe('streamed previews', () => {
  it('feeds progressive snapshots into the existing renderer on isolated graphs', async () => {
    const parser = createStreamingJSXParser()
    const chunks = [
      '<Frame w={400} h={200}>',
      '<Rect w={20} h={30} />',
      '<Rect w={40} h={50} /></Frame>'
    ]
    for (const [index, chunk] of chunks.entries()) {
      const tree = expectDefined(parser.append(chunk).tree, 'preview tree')
      const graph = new SceneGraph()
      const result = await renderTree(graph, tree)
      const frame = getNodeOrThrow(graph, result.id)
      expect(frame.width).toBe(400)
      expect(frame.height).toBe(200)
      expect(frame.childIds).toHaveLength(index)
    }
  })
})
