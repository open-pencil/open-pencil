import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

describe('getTopLevelFrame', () => {
  test('is the container a layer sits in at the top of its page or section', () => {
    const figma = createAPI()
    const named = <T extends { name: string }>(node: T, name: string) => {
      node.name = name
      return node
    }
    const top = named(figma.createFrame(), 'top')
    const nested = figma.createFrame()
    top.appendChild(nested)
    const leaf = figma.createRectangle()
    nested.appendChild(leaf)
    expect(leaf.getTopLevelFrame()?.name).toBe('top')
    expect(top.getTopLevelFrame()?.name).toBe('top')

    const group = named(figma.group([figma.createRectangle()], figma.currentPage), 'group')
    expect(group.children[0]?.getTopLevelFrame()?.name).toBe('group')

    const section = named(figma.createSection(), 'section')
    const inner = named(figma.createFrame(), 'inner')
    section.appendChild(inner)
    const loose = figma.createRectangle()
    section.appendChild(loose)
    expect(inner.getTopLevelFrame()?.name).toBe('inner')
    expect(loose.getTopLevelFrame()?.name).toBe('section')
    expect(section.getTopLevelFrame()?.name).toBe('section')
  })

  test('is undefined for a shape or boolean directly on a page, and for a page', () => {
    const figma = createAPI()
    expect(figma.createRectangle().getTopLevelFrame()).toBeUndefined()
    const boolean = figma.union([figma.createRectangle(), figma.createEllipse()], figma.currentPage)
    expect(boolean.getTopLevelFrame()).toBeUndefined()
    expect(figma.currentPage.getTopLevelFrame()).toBeUndefined()
  })
})

describe('documentColorProfile', () => {
  test('is the document’s colour space, on the document alone', () => {
    const figma = createAPI()
    expect(figma.root.documentColorProfile).toBe('SRGB')
    figma.graph.documentColorSpace = 'display-p3'
    expect(figma.root.documentColorProfile).toBe('DISPLAY_P3')
    expect('documentColorProfile' in figma.currentPage).toBe(false)
  })
})
