import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Scripts written for Figma's dynamic-page mode switch pages with `setCurrentPageAsync` and load
// a page before reading its layers. Every page of a document here is already loaded.
describe('dynamic-page loading in the plugin API', () => {
  test('setCurrentPageAsync switches the page new layers go on', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const page = figma.createPage()
    await figma.setCurrentPageAsync(page)
    expect(figma.currentPage.id).toBe(page.id)
    expect(figma.createRectangle().parent?.id).toBe(page.id)
  })

  test('setCurrentPageAsync switches only to a page', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const page = figma.currentPage
    await expect(figma.setCurrentPageAsync(figma.createFrame())).rejects.toThrow(
      'setCurrentPageAsync() can only switch to pages'
    )
    expect(figma.currentPage.id).toBe(page.id)
  })

  test('loading a page resolves and leaves its layers readable', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const rectangle = figma.createRectangle()
    await figma.currentPage.loadAsync()
    expect(figma.currentPage.children.map((child) => child.id)).toEqual([rectangle.id])
  })

  test('only a page loads', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    await expect(figma.createFrame().loadAsync()).rejects.toThrow(
      'loadAsync() can only be called on pages'
    )
  })
})
