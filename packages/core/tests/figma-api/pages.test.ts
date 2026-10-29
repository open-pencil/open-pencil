import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createAPI } from '#core-tests/helpers/figma-api'

describe('document & pages', () => {
  test('root has pages as children', () => {
    const api = createAPI()
    expect(api.root.children.length).toBeGreaterThan(0)
    expect(api.root.children[0].type).toBe('CANVAS')
  })

  test('currentPage is first page', () => {
    const api = createAPI()
    expect(api.currentPage.type).toBe('CANVAS')
    expect(api.currentPage.name).toBe('Page 1')
  })

  test('createPage adds a new page', () => {
    const api = createAPI()
    const page = api.createPage()
    expect(page.type).toBe('CANVAS')
    expect(api.root.children.length).toBe(2)
  })

  test('currentPage can be switched', () => {
    const api = createAPI()
    const page2 = api.createPage()
    page2.name = 'Page 2'
    api.currentPage = page2
    expect(api.currentPage.name).toBe('Page 2')
  })

  test('getNodeById returns proxy', () => {
    const api = createAPI()
    const frame = api.createFrame()
    const found = api.getNodeById(frame.id)
    expect(expectDefined(found, 'found frame').id).toBe(frame.id)
  })

  test('getNodeById returns null for unknown id', () => {
    const api = createAPI()
    expect(api.getNodeById('nonexistent')).toBeNull()
  })
})

// Scripts written for Figma's dynamic-page mode switch pages with `setCurrentPageAsync` and load
// a page before reading its layers. Every page of a document here is already loaded. Errors and
// members recorded in Figma 126.
describe('dynamic-page loading in the plugin API', () => {
  test('setCurrentPageAsync switches the page new layers go on', async () => {
    const figma = createAPI()
    const page = figma.createPage()
    await figma.setCurrentPageAsync(page)
    expect(figma.currentPage.id).toBe(page.id)
    expect(figma.createRectangle().parent?.id).toBe(page.id)
  })

  test('setCurrentPageAsync switches only to a page', async () => {
    const figma = createAPI()
    const page = figma.currentPage
    await expect(figma.setCurrentPageAsync(figma.createFrame())).rejects.toThrow(
      'figma.setCurrentPageAsync expects a PageNode'
    )
    expect(() => figma.setCurrentPageAsync(null as never)).toThrow(
      'in setCurrentPageAsync: Expected node, got null'
    )
    expect(figma.currentPage.id).toBe(page.id)
  })

  test('loading a page resolves and leaves its layers readable', async () => {
    const figma = createAPI()
    const rectangle = figma.createRectangle()
    await figma.currentPage.loadAsync()
    expect(figma.currentPage.children.map((child) => child.id)).toEqual([rectangle.id])
  })

  test('only a page has loadAsync', () => {
    const figma = createAPI()
    expect('loadAsync' in figma.currentPage).toBe(true)
    expect('loadAsync' in figma.createFrame()).toBe(false)
    expect('loadAsync' in figma.root).toBe(false)
  })
})
