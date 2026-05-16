import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph, matchByXPath, nodeToXPath, queryByXPath } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

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

describe('nodeToXPath', () => {
  test('returns null for missing node', () => {
    const { graph } = setup()
    expect(nodeToXPath(graph, 'nonexistent')).toBeNull()
  })

  test('uses name predicate for unique name among siblings', () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.name = 'Header'
    const text = figma.createText()
    text.name = 'Title'

    const xpath = nodeToXPath(graph, rect.id)
    expect(xpath).toBe("//RECTANGLE[@name='Header']")
  })

  test('includes name even when sole child of that type', () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.name = 'Card'
    const text = figma.createText()
    text.name = 'Label'
    frame.appendChild(text)

    const xpath = nodeToXPath(graph, text.id)
    expect(xpath).toBe("//FRAME[@name='Card']/TEXT[@name='Label']")
  })

  test('uses positional predicate for duplicate names', () => {
    const { graph, figma } = setup()
    const r1 = figma.createRectangle()
    r1.name = 'Item'
    const r2 = figma.createRectangle()
    r2.name = 'Item'

    const xpath1 = nodeToXPath(graph, r1.id)
    const xpath2 = nodeToXPath(graph, r2.id)
    expect(xpath1).toBe('//RECTANGLE[1]')
    expect(xpath2).toBe('//RECTANGLE[2]')
  })

  test('builds multi-level path', () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.name = 'Container'
    const inner = figma.createFrame()
    inner.name = 'Row'
    frame.appendChild(inner)
    const text = figma.createText()
    text.name = 'Label'
    inner.appendChild(text)

    const xpath = nodeToXPath(graph, text.id)
    expect(xpath).toBe("//FRAME[@name='Container']/FRAME[@name='Row']/TEXT[@name='Label']")
  })

  test('round-trips with queryByXPath', async () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.name = 'Sidebar'
    const btn = figma.createRectangle()
    btn.name = 'Button'
    frame.appendChild(btn)

    const xpath = expectDefined(nodeToXPath(graph, btn.id), 'button XPath')
    const results = await queryByXPath(graph, xpath)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(btn.id)
  })

  test('handles names with single quotes', () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.name = "it's a test"

    const xpath = nodeToXPath(graph, rect.id)
    expect(xpath).toBe('//RECTANGLE[@name="it\'s a test"]')
  })
})

describe('matchByXPath', () => {
  test('returns true for matching node', async () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)
    rect.name = 'TestRect'

    const sceneNode = expectDefined(graph.getNode(rect.id), 'matching rectangle')
    const result = await matchByXPath(graph, '@name = "TestRect"', sceneNode)
    expect(result).toBe(true)
  })

  test('returns false for non-matching node', async () => {
    const { graph, figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)
    rect.name = 'Other'

    const sceneNode = expectDefined(graph.getNode(rect.id), 'non-matching rectangle')
    const result = await matchByXPath(graph, '@name = "TestRect"', sceneNode)
    expect(result).toBe(false)
  })
})
