import { describe, expect, test } from 'bun:test'

import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'

import { createAPI } from '../helpers'

describe('vector paths', () => {
  test('exposes imported geometry as Figma SVG paths', () => {
    const api = createAPI()
    const vector = api.createVector()
    api.graph.updateNode(vector.id, {
      fillGeometry: [
        {
          windingRule: 'EVENODD',
          commandsBlob: encodePathCommandsBlob([
            { type: 'M', x: 0, y: 0 },
            { type: 'L', x: 10, y: 10 },
            { type: 'Z' }
          ])
        }
      ]
    })

    expect(vector.vectorPaths).toEqual([{ windingRule: 'EVENODD', data: 'M0 0L10 -10Z' }])
    expect(Object.isFrozen(vector.vectorPaths)).toBe(true)
    expect(Object.isFrozen(vector.vectorPaths[0])).toBe(true)
  })
})
