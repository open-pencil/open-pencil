import * as v from 'valibot'

import { computeBounds } from '@open-pencil/scene-graph/geometry'

import { defineTool } from '#core/tools/schema'

export const listPages = defineTool({
  name: 'list_pages',
  description: 'List all pages in the document.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: (figma) => {
    const pages = figma.root.children
    return {
      current: figma.currentPage.name,
      pages: pages.map((page) => ({ id: page.id, name: page.name }))
    }
  }
})

export const switchPage = defineTool({
  name: 'switch_page',

  description: 'Switch to a different page by name or ID.',
  execution: { kind: 'async', mutation: 'view' },
  input: v.strictObject({
    page: v.pipe(v.string(), v.description('Page name or ID'))
  }),
  execute: async (figma, { page }) => {
    const target =
      figma.root.children.find((candidate) => candidate.name === page) ?? figma.getNodeById(page)
    if (!target || figma.graph.getNode(target.id)?.type !== 'CANVAS')
      return { error: `Page "${page}" not found` }
    // A page not yet visited has its layers loaded first, so the calls after see them.
    await figma.setCurrentPageAsync(target)
    return { page: target.name, id: target.id }
  }
})

export const getCurrentPage = defineTool({
  name: 'get_current_page',
  description: 'Get the current page name and ID.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: (figma) => {
    return { id: figma.currentPage.id, name: figma.currentPage.name }
  }
})

export const pageBounds = defineTool({
  name: 'page_bounds',
  description: 'Get bounding box of all objects on the current page.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({}),
  execute: (figma) => {
    return computeBounds(figma.currentPage.children.map((child) => child.absoluteBoundingBox))
  }
})
