import { describe, expect, it } from 'bun:test'

import { renderJSX, sceneNodeToJSX } from '@open-pencil/core'

import { getNodeOrThrow, childIdAt } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

describe('text props round-trip', () => {
  it('lineHeight renders and exports', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" lineHeight={24}>Hello</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.lineHeight).toBe(24)
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('lineHeight={24}')
  })

  it('letterSpacing renders and exports', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" letterSpacing={2}>Spaced</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.letterSpacing).toBe(2)
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('letterSpacing={2}')
  })

  it('textDecoration renders and exports', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" textDecoration="underline">Link</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.textDecoration).toBe('UNDERLINE')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('textDecoration="underline"')
  })

  it('textCase renders and exports', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" textCase="upper">label</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.textCase).toBe('UPPER')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('textCase="upper"')
  })

  it('maxLines renders with truncation', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" maxLines={2}>Long text here</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.maxLines).toBe(2)
    expect(n.textTruncation).toBe('ENDING')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('maxLines={2}')
  })

  it('truncate without maxLines', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000" truncate>Overflow</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.textTruncation).toBe('ENDING')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('truncate')
  })

  it('defaults omit text props', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Text color="#000">Plain</Text>')
    const n = getNodeOrThrow(g, result.id)
    expect(n.lineHeight).toBeNull()
    expect(n.letterSpacing).toBe(0)
    expect(n.textDecoration).toBe('NONE')
    expect(n.textCase).toBe('ORIGINAL')
    expect(n.maxLines).toBeNull()
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).not.toContain('lineHeight')
    expect(jsx).not.toContain('letterSpacing')
    expect(jsx).not.toContain('textDecoration')
    expect(jsx).not.toContain('textCase')
    expect(jsx).not.toContain('maxLines')
    expect(jsx).not.toContain('truncate')
  })

  it('text w="fill" in flex="col" exports as w="fill" not w={computed}', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `
      <Frame name="Card" flex="col" w={300} p={20}>
        <Text name="Title" size={22} weight="bold" color="#111" w="fill">Hello World</Text>
      </Frame>
    `
    )
    const card = getNodeOrThrow(g, result.id)
    const title = getNodeOrThrow(g, childIdAt(card, 0))
    expect(title.layoutAlignSelf).toBe('STRETCH')
    expect(title.textAutoResize).toBe('HEIGHT')
    const jsx = sceneNodeToJSX(title.id, g)
    expect(jsx).toContain('w="fill"')
    expect(jsx).not.toMatch(/w=\{/)
  })

  it('text grow={1} in flex="row" exports as grow not w={computed}', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `
      <Frame name="Row" flex="row" w={300}>
        <Text name="Label" color="#999" w={60}>Label</Text>
        <Text name="Value" color="#111" w="fill">Some value text</Text>
      </Frame>
    `
    )
    const row = getNodeOrThrow(g, result.id)
    const value = getNodeOrThrow(g, childIdAt(row, 1))
    expect(value.layoutGrow).toBe(1)
    const jsx = sceneNodeToJSX(value.id, g)
    expect(jsx).toContain('grow={1}')
    expect(jsx).not.toMatch(/\bw=\{\d+\}/)
  })
})
