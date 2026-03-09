import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph, matchByXPath, queryByXPath } from '@open-pencil/core'

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

describe('queryByXPath', () => {
  test('finds nodes by type', async () => {
    const { graph, figma } = setup()
    figma.createRectangle()
    figma.createRectangle()
    figma.createText()

    const results = await queryByXPath(graph, '//RECTANGLE')
    expect(results.length).toBe(2)
    expect(results.every((n) => n.type === 'RECTANGLE')).toBe(true)
  })

  test('filters by attribute comparison', async () => {
    const { graph, figma } = setup()
    const small = figma.createRectangle()
    small.resize(50, 50)
    small.name = 'Small'

    const big = figma.createRectangle()
    big.resize(300, 300)
    big.name = 'Big'

    const results = await queryByXPath(graph, '//RECTANGLE[@width < 200]')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Small')
  })

  test('handles descendant axis //FRAME//TEXT', async () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.resize(400, 400)
    frame.name = 'Container'

    const text = figma.createText()
    text.name = 'Inside'
    frame.appendChild(text)

    const outsideText = figma.createText()
    outsideText.name = 'Outside'

    const results = await queryByXPath(graph, '//FRAME//TEXT')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Inside')
  })

  test('respects limit option', async () => {
    const { graph, figma } = setup()
    for (let i = 0; i < 10; i++) {
      const r = figma.createRectangle()
      r.name = `Rect ${i}`
    }

    const results = await queryByXPath(graph, '//RECTANGLE', { limit: 3 })
    expect(results.length).toBe(3)
  })

  test('filters by page option', async () => {
    const { graph, figma } = setup()
    const rect1 = figma.createRectangle()
    rect1.name = 'Page1Rect'
    const page1Name = figma.currentPage.name

    const page2 = figma.createPage()
    page2.name = 'Page 2'
    figma.currentPage = page2
    const rect2 = figma.createRectangle()
    rect2.name = 'Page2Rect'

    const page1Results = await queryByXPath(graph, '//RECTANGLE', { page: page1Name })
    expect(page1Results.length).toBe(1)
    expect(page1Results[0].name).toBe('Page1Rect')

    const page2Results = await queryByXPath(graph, '//RECTANGLE', { page: 'Page 2' })
    expect(page2Results.length).toBe(1)
    expect(page2Results[0].name).toBe('Page2Rect')
  })

  test('returns empty for no matches', async () => {
    const { graph, figma } = setup()
    figma.createRectangle()

    const results = await queryByXPath(graph, '//ELLIPSE')
    expect(results.length).toBe(0)
  })

  test('handles invalid selector gracefully (throws)', async () => {
    const { graph } = setup()
    expect(queryByXPath(graph, '///invalid[[[[')).rejects.toThrow()
  })
})

describe('matchByXPath', () => {
  test('returns true for matching node', async () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)
    rect.name = 'TestRect'

    const sceneNode = graph.getNode(rect.id)!
    const result = await matchByXPath(graph, '@name = "TestRect"', sceneNode)
    expect(result).toBe(true)
  })

  test('returns false for non-matching node', async () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)
    rect.name = 'Other'

    const sceneNode = graph.getNode(rect.id)!
    const result = await matchByXPath(graph, '@name = "TestRect"', sceneNode)
    expect(result).toBe(false)
  })
})
