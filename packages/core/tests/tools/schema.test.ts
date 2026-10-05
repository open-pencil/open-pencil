import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { defineTool } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const tool = defineTool({
  name: 'place_box',
  description: 'Places a box',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    kind: v.picklist(['FRAME', 'RECTANGLE']),
    width: v.pipe(v.number(), v.minValue(1))
  }),
  execute: (_figma, args) => args
})

describe('tool arguments', () => {
  test('name the tool and list every problem with its argument', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(() => tool.execute(figma, { kind: 'CIRCLE', width: 0 })).toThrow(
      [
        'Invalid arguments for place_box:',
        '× Invalid type: Expected ("FRAME" | "RECTANGLE") but received "CIRCLE"',
        '  → at kind',
        '× Invalid value: Expected >=1 but received 0',
        '  → at width'
      ].join('\n')
    )
  })

  test('pass valid arguments through', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(tool.execute(figma, { kind: 'FRAME', width: 10 })).toEqual({ kind: 'FRAME', width: 10 })
  })
})
