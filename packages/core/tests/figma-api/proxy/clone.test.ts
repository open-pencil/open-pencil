import { describe, expect, test } from 'bun:test'

import { expectFills } from '#core-tests/helpers/assert'
import { createAPI, solidFill } from '#core-tests/helpers/figma-api'

describe('clone', () => {
  test('clone creates a deep copy', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Original'
    frame.fills = [solidFill({ r: 1, g: 0, b: 0, a: 1 })]
    const child = api.createRectangle()
    child.name = 'Child'
    frame.appendChild(child)

    const cloned = frame.clone()
    expect(cloned.id).not.toBe(frame.id)
    expect(cloned.name).toBe('Original')
    expect(expectFills(cloned.fills)[0]).toMatchObject({ color: { r: 1 } })
    expect(cloned.children.length).toBe(1)
    expect(cloned.children[0].name).toBe('Child')
    expect(cloned.children[0].id).not.toBe(child.id)
  })
})
