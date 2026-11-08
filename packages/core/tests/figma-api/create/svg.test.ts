import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Recorded with the same calls in Figma desktop 126.
describe('figma.createNodeFromSvg', () => {
  test('adds the layers to the current page at its origin without selecting them', () => {
    const figma = new FigmaAPI(new SceneGraph())

    const frame = figma.createNodeFromSvg(
      '<svg width="10" height="10"><rect id="dot" width="10" height="10"/></svg>'
    )

    expect(frame.type).toBe('FRAME')
    expect(frame.parent?.id).toBe(figma.currentPage.id)
    expect([frame.x, frame.y]).toEqual([0, 0])
    expect(frame.children.map((child) => child.name)).toEqual(['dot'])
    expect(figma.currentPage.selection).toEqual([])
  })

  test('returns an empty frame for markup that draws nothing', () => {
    const figma = new FigmaAPI(new SceneGraph())

    const frame = figma.createNodeFromSvg('<svg viewBox="0 0 10 10"></svg>')

    expect(frame.type).toBe('FRAME')
    expect(frame.children).toHaveLength(0)
  })

  test('returns a group for unsized markup', () => {
    const figma = new FigmaAPI(new SceneGraph())

    const group = figma.createNodeFromSvg('<svg><text>only text</text></svg>')

    // Figma's typings say FrameNode, but it returns a group here too.
    expect<string>(group.type).toBe('GROUP')
    expect(group.children.map((child) => child.type)).toEqual(['TEXT'])
  })

  test('throws for markup that is not SVG', () => {
    const figma = new FigmaAPI(new SceneGraph())
    for (const markup of [
      '',
      'not svg',
      '<svg viewBox="0 0 10 10"><rect width="10" height="10"/>'
    ]) {
      expect(() => figma.createNodeFromSvg(markup)).toThrow(
        'in createNodeFromSvg: Failed to convert SVG file'
      )
    }
  })
})
