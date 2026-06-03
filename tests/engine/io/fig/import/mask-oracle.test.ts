import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'
import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph, type MaskType } from '#core/scene-graph'

interface MaskOracleEntry {
  isMask: boolean
  maskType: MaskType
}

interface MaskOracle {
  masks: MaskOracleEntry[]
  nested: { children: MaskOracleEntry[] }
  maskIsOutline: { pluginApiReadable: boolean; note: string }
}

function readOracle(): MaskOracle {
  return JSON.parse(readFileSync('tests/fixtures/figma-oracles/masks.json', 'utf8')) as MaskOracle
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
