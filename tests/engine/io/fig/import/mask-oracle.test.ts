import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type MaskType } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

const MASK_TYPE_VALUES = ['ALPHA', 'VECTOR', 'LUMINANCE'] as const satisfies readonly MaskType[]

const MaskOracleEntry = v.object({ isMask: v.boolean(), maskType: v.picklist(MASK_TYPE_VALUES) })

const MaskOracleJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    masks: v.array(MaskOracleEntry),
    nested: v.object({ children: v.array(MaskOracleEntry) }),
    maskIsOutline: v.object({ pluginApiReadable: v.boolean(), note: v.string() })
  })
)

function readOracle() {
  return v.parse(MaskOracleJSON, readFileSync('tests/fixtures/figma-oracles/masks.json', 'utf8'))
}

describe('Figma mask oracle', () => {
  test('imports live Figma mask types from schema fields', () => {
    const oracle = readOracle()

    for (const mask of oracle.masks) {
      const props = nodeChangeToProps(
        { type: 'RECTANGLE', mask: mask.isMask, maskType: mask.maskType } as NodeChange,
        []
      )

      expect(props.isMask).toBe(true)
      expect(props.maskType).toBe(mask.maskType)
    }
  })

  test('exports live Figma mask types to schema fields', () => {
    const oracle = readOracle()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    for (const [index, mask] of oracle.masks.entries()) {
      const node = graph.createNode('RECTANGLE', page.id, {
        isMask: mask.isMask,
        maskType: mask.maskType
      })
      const changes = sceneNodeToKiwi(
        node,
        { sessionID: 1, localID: index + 1 },
        index,
        { value: index + 2 },
        graph,
        []
      )

      expect(changes[0].mask).toBe(true)
      expect(changes[0].maskType).toBe(mask.maskType)
    }
  })

  test('records nested live Figma mask stack order and maskIsOutline API gap', () => {
    const oracle = readOracle()

    expect(oracle.nested.children.map(({ isMask, maskType }) => ({ isMask, maskType }))).toEqual([
      { isMask: true, maskType: 'LUMINANCE' },
      { isMask: false, maskType: 'ALPHA' }
    ])
    expect(oracle.maskIsOutline.pluginApiReadable).toBe(false)
  })
})
