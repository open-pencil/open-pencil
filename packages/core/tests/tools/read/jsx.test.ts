import { describe, expect, test } from 'bun:test'

import { asSchema, tool } from 'ai'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, toolsToAI } from '@open-pencil/core/tools'
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

interface JSXResult {
  jsx: string
  truncated?: boolean
  totalLength?: number
  note?: string
}

describe('get_jsx', () => {
  test('returns JSX cut at its cap, saying so and how to get all of it', async () => {
    const { figma, boardId } = largeBoard()
    const result = (await getJSXTool().execute(figma, { id: boardId })) as JSXResult
    expect(result.jsx).toHaveLength(12_000)
    expect(result.truncated).toBe(true)
    expect(expectDefined(result.totalLength, 'totalLength')).toBeGreaterThan(12_000)
    expect(result.note).toBe(`JSX cut at 12000 of ${result.totalLength} characters.`)
  })

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
