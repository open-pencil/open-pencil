import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createSticky } from '@open-pencil/scene-graph/generated'

function stickyNote() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const sticky = createSticky(graph, page.id, { text: 'Hello', author: 'Ada Lovelace' })
  const api = new FigmaAPI(graph)
  const node = api.getNodeById(sticky.id)
  if (!node) throw new Error('Missing sticky note')
  return { api, node }
}

// Values and shapes as live Figma reports them for a StickyNode in FigJam.
describe('sticky notes in the Plugin API', () => {
  test('a note reports its type, text, and author, and has no children', () => {
    const { node } = stickyNote()
    expect(node.type).toBe('STICKY')
    expect(node.text?.characters).toBe('Hello')
    expect(node.text?.fontSize).toBe(16)
    expect(node.authorName).toBe('Ada Lovelace')
    expect(node.authorVisible).toBe(true)
    expect(node.isWideWidth).toBe(false)
    expect(node.children).toEqual([])
  })

  test('findAll does not reach into a note', () => {
    const { api } = stickyNote()
    expect(api.currentPage.findAll().map((found) => found.type)).toEqual(['STICKY'])
  })

  test('toJSON lists no children for a note, as children does', () => {
    const { node } = stickyNote()
    expect(node.toJSON()).not.toHaveProperty('children')
  })

  test('a layer cannot be added to a note', () => {
    const { api, node } = stickyNote()
    const rect = api.createRectangle()
    expect(() => node.appendChild(rect)).toThrow('Cannot move node')
    expect(() => node.insertChild(0, rect)).toThrow('Cannot move node')
  })

  test('hiding the author and making the note wide', () => {
    const { node } = stickyNote()
    node.authorVisible = false
    node.isWideWidth = true
    expect(node.authorVisible).toBe(false)
    expect([node.isWideWidth, node.width]).toEqual([true, 416])
  })

  test('rescale scales the note and its text, as in Figma', () => {
    const { node } = stickyNote()
    node.rescale(1.5)
    expect([node.width, node.height, node.text?.fontSize]).toEqual([360, 360, 24])
  })

  test('other layers have no sticky members', () => {
    const { api } = stickyNote()
    const frame = api.createFrame()
    expect([frame.text, frame.authorVisible, frame.isWideWidth]).toEqual([
      undefined,
      undefined,
      undefined
    ])
  })
})
