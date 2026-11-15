import { describe, expect, test } from 'bun:test'

import { asSchema, tool } from 'ai'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, toolsToAI } from '@open-pencil/core/tools'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

const TILE_COUNT = 220

function getJSXTool() {
  return expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'get_jsx'),
    'get_jsx tool'
  )
}

function largeBoard() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const board = graph.createNode('FRAME', figma.currentPageId, {
    name: 'Board',
    width: 800,
    height: 800
  })
  for (let index = 0; index < TILE_COUNT; index++) {
    graph.createNode('RECTANGLE', board.id, {
      name: `Tile ${index}`,
      x: (index % 20) * 40,
      y: Math.floor(index / 20) * 40,
      width: 32,
      height: 32
    })
  }
  return { figma, boardId: board.id }
}

const GROUP_COUNT = 20
const TILES_PER_GROUP = 12

/** A board of groups of tiles, longer than the cap, whose groups alone fit it. */
function groupedBoard() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const board = graph.createNode('FRAME', figma.currentPageId, {
    name: 'Board',
    width: 800,
    height: 800
  })
  for (let group = 0; group < GROUP_COUNT; group++) {
    const frame = graph.createNode('FRAME', board.id, { name: `Group ${group}`, width: 400 })
    for (let tile = 0; tile < TILES_PER_GROUP; tile++) {
      graph.createNode('RECTANGLE', frame.id, {
        name: `Tile ${tile}`,
        x: tile * 40,
        width: 32,
        height: 32
      })
    }
  }
  return { graph, figma, boardId: board.id }
}

function renderTool() {
  return expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'render'),
    'render tool'
  )
}

interface JSXResult {
  jsx: string
  depth?: number
  truncated?: boolean
  totalLength?: number
  note?: string
}

describe('get_jsx', () => {
  test('outlines JSX over its cap to the depth that fits, saying how to read the rest', async () => {
    const { graph, figma, boardId } = groupedBoard()
    const result = (await getJSXTool().execute(figma, { id: boardId })) as JSXResult
    expect(result.jsx.length).toBeLessThanOrEqual(12_000)
    expect(result.truncated).toBe(true)
    expect(result.depth).toBe(1)
    expect(expectDefined(result.totalLength, 'totalLength')).toBeGreaterThan(12_000)
    const group = graph.getChildren(boardId)[0]
    expect(result.jsx).toContain(`{/* ${TILES_PER_GROUP} layers kept, id ${group.id} */}`)
    expect(result.note).toContain('get_jsx on the id in its comment')
  })

  test('renders an outline back in place, keeping the children it left out', async () => {
    const { graph, figma, boardId } = groupedBoard()
    const firstGroup = graph.getChildren(boardId)[0]
    const tileIds = graph.getChildren(firstGroup.id).map((tile) => tile.id)
    const outline = (await getJSXTool().execute(figma, { id: boardId })) as JSXResult
    const edited = outline.jsx.replace('name="Board"', 'name="Board" opacity={0.5}')

    await renderTool().execute(figma, { jsx: edited, replace_id: boardId })

    const board = getNodeOrThrow(graph, boardId)
    expect(board.opacity).toBe(0.5)
    expect(board.childIds).toHaveLength(GROUP_COUNT)
    expect(graph.getChildren(boardId)[0].id).toBe(firstGroup.id)
    expect(getNodeOrThrow(graph, firstGroup.id).childIds).toEqual(tileIds)
  })

  test('refuses keepChildren with nothing to keep children from, leaving no layers', async () => {
    const { graph, figma, boardId } = groupedBoard()
    const outline = (await getJSXTool().execute(figma, { id: boardId })) as JSXResult
    const before = graph.getChildren(figma.currentPageId).length

    await expect(renderTool().execute(figma, { jsx: outline.jsx })).rejects.toThrow('replace_id')
    expect(graph.getChildren(figma.currentPageId)).toHaveLength(before)
  })

  test('outlines a layer whose children alone are over the cap to itself', async () => {
    const { figma, boardId } = largeBoard()
    const result = (await getJSXTool().execute(figma, { id: boardId })) as JSXResult
    expect(result.depth).toBe(0)
    expect(result.jsx).toContain(`{/* ${TILE_COUNT} layers kept, id ${boardId} */}`)
    expect(result.note).toContain('get_node depth 1')
  })

  test('returns a layer without children whole, however long, since nothing can be left out', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const note = graph.createNode('TEXT', figma.currentPageId, {
      name: 'Note',
      text: 'word '.repeat(4000)
    })
    const result = (await getJSXTool().execute(figma, { id: note.id })) as JSXResult
    expect(result.jsx.length).toBeGreaterThan(12_000)
    expect(result.truncated).toBeUndefined()
  })

  test('an outline keeps a connector joined to a layer it leaves out', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const [board] = await renderJSX(
      graph,
      `<Frame name="Board" w={400} h={200}>
        <Frame name="Body" w={100} h={100}><Rectangle name="Target" w={40} h={40} /></Frame>
        <Rectangle name="Outside" x={300} w={40} h={40} />
        <Connector from="Target" to="Outside" />
      </Frame>`
    )
    const byName = (name: string) =>
      expectDefined(
        [...graph.getAllNodes()].find((node) => node.name === name),
        name
      )
    const target = byName('Target')
    const outline = sceneNodeToJSX(board.id, graph, { maxDepth: 1 })
    expect(outline).toContain(`from={{ id: "${target.id}" }}`)

    await renderTool().execute(figma, { jsx: outline, replace_id: board.id })

    const connector = expectDefined(
      graph.getChildren(board.id).find((node) => node.type === 'CONNECTOR'),
      'connector'
    )
    expect(connector.connectorStart?.nodeId).toBe(target.id)
    expect(connector.connectorEnd?.nodeId).toBe(byName('Outside').id)
  })

  test('a connector kept in a layer follows a layer the render rebuilds', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const [board] = await renderJSX(
      graph,
      `<Frame name="Board" w={400} h={200}>
        <Frame name="Body" w={200} h={100}>
          <Rectangle name="Inner" w={40} h={40} />
          <Connector from="Inner" to="Icon" />
        </Frame>
        <Vector name="Icon" x={300} d="M0 0 L20 20" stroke="#000" />
      </Frame>`
    )
    const vectorBefore = expectDefined(
      [...graph.getAllNodes()].find((node) => node.name === 'Icon'),
      'icon'
    ).id
    const outline = sceneNodeToJSX(board.id, graph, { maxDepth: 1 })
    expect(outline).toContain('keepChildren')

    await renderTool().execute(figma, { jsx: outline, replace_id: board.id })

    const nodes = [...graph.getAllNodes()]
    const icon = expectDefined(
      nodes.find((node) => node.name === 'Icon'),
      'icon'
    )
    const connector = expectDefined(
      nodes.find((node) => node.type === 'CONNECTOR'),
      'connector'
    )
    // A vector is drawn again from its path, so it is a new layer.
    expect(icon.id).not.toBe(vectorBefore)
    expect(connector.connectorEnd?.nodeId).toBe(icon.id)
  })

  test.each([0, 1])(
    'a component rendered from its outline at depth %i keeps its properties and their ids',
    async (maxDepth) => {
      const graph = new SceneGraph()
      const figma = new FigmaAPI(graph)
      const [card] = await renderJSX(
        graph,
        `<Component name="Card" w={200} h={100}>
          <Frame name="Body" w={100} h={50}><Text name="Title" text={property('Title', 'Hi')} /></Frame>
          <Text name="Sub" text={property('Sub', 'x')} />
        </Component>`
      )
      const before = getNodeOrThrow(graph, card.id).componentPropertyDefinitions.map(
        ({ id, name }) => ({ id, name })
      )
      const title = expectDefined(
        [...graph.getAllNodes()].find((node) => node.name === 'Title'),
        'title'
      )
      const outline = sceneNodeToJSX(card.id, graph, { maxDepth })
      expect(outline).toContain('keepChildren')

      await renderTool().execute(figma, { jsx: outline, replace_id: card.id })

      const after = getNodeOrThrow(graph, card.id).componentPropertyDefinitions
      expect(after.map(({ id, name }) => ({ id, name }))).toEqual(before)
      const titleProperty = expectDefined(
        before.find((definition) => definition.name === 'Title'),
        'Title property'
      )
      expect(getNodeOrThrow(graph, title.id).componentPropertyReferences).toEqual([
        { propertyId: titleProperty.id, field: 'TEXT' }
      ])
    }
  )

  test('gives the complete JSX for a path, which renders back every layer', async () => {
    const { figma, boardId } = largeBoard()
    const result = (await getJSXTool().execute(figma, {
      id: boardId,
      path: 'board.jsx'
    })) as JSXResult
    expect(result.jsx.length).toBeGreaterThan(12_000)
    expect(result.truncated).toBeUndefined()

    const graph = new SceneGraph()
    const [board] = await renderJSX(graph, result.jsx)
    expect(getNodeOrThrow(graph, board.id).childIds).toHaveLength(TILE_COUNT)
  })

  test('returns JSX under the cap whole, without a note', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const card = graph.createNode('FRAME', figma.currentPageId, { name: 'Card', width: 10 })
    expect(await getJSXTool().execute(figma, { id: card.id })).toEqual({
      id: card.id,
      name: 'Card',
      jsx: '<Frame name="Card" w={10} h={100} />'
    })
  })

  test('refuses an empty path, as the MCP server does', async () => {
    const { figma, boardId } = largeBoard()
    expect(() => getJSXTool().execute(figma, { id: boardId, path: '' })).toThrow(
      'Invalid arguments'
    )
  })

  test('AI chat, which writes no files, is not offered a path', async () => {
    const { figma } = largeBoard()
    const tools = toolsToAI(ALL_TOOLS, { getFigma: () => figma }, { tool })
    const { inputSchema } = expectDefined(tools.get_jsx, 'AI get_jsx')
    const { jsonSchema } = asSchema(inputSchema)
    expect(await jsonSchema).toMatchObject({ properties: { id: { type: 'string' } } })
    expect(await jsonSchema).not.toHaveProperty('properties.path')
  })
})
