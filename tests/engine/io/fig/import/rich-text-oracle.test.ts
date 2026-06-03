import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { NodeChange, Paint } from '#core/kiwi/fig/codec'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'
import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph } from '#core/scene-graph'

interface OracleColor {
  r: number
  g: number
  b: number
}

interface OracleDecorationColor {
  value: {
    color: OracleColor
    opacity: number
  }
}

interface OracleRange {
  start: number
  end: number
  textDecoration: string
  textDecorationStyle: string
  textDecorationThickness: { unit: string; value: number }
  textDecorationColor: OracleDecorationColor
}

interface RichTextOracle {
  characters: string
  leadingTrim: string
  textDecorationOffset: { unit: string; value: number }
  textDecorationSkipInk: boolean
  ranges: OracleRange[]
}

function readOracle(): RichTextOracle {
  return JSON.parse(
    readFileSync('tests/fixtures/figma-oracles/rich-text-decoration.json', 'utf8')
  ) as RichTextOracle
}

function oracleColorToPaint(color: OracleDecorationColor): Paint {
  return {
    type: 'SOLID',
    visible: true,
    opacity: color.value.opacity,
    blendMode: 'NORMAL',
    color: { ...color.value.color, a: 1 }
  }
}

function styleIdsForOracle(oracle: RichTextOracle): number[] {
  const ids = Array.from({ length: oracle.characters.length }, () => 0)
  const secondRange = oracle.ranges[1]
  if (!secondRange) return ids
  for (let index = secondRange.start; index < secondRange.end; index++) ids[index] = 1
  return ids
}

describe('Figma rich text oracle', () => {
  test('maps captured Figma text decoration API values to import props', () => {
    const oracle = readOracle()
    const firstRange = oracle.ranges[0]
    const secondRange = oracle.ranges[1]
    expect(firstRange).toBeDefined()
    expect(secondRange).toBeDefined()
    if (!firstRange || !secondRange) return

    const nodeChange: NodeChange = {
      type: 'TEXT',
      textData: {
        characters: oracle.characters,
        characterStyleIDs: styleIdsForOracle(oracle),
        styleOverrideTable: [
          {
            styleID: 1,
            textDecoration: secondRange.textDecoration,
            textDecorationStyle: secondRange.textDecorationStyle,
            textDecorationThickness: {
              value: secondRange.textDecorationThickness.value,
              units: 'PIXELS'
            },
            textUnderlineOffset: { value: oracle.textDecorationOffset.value, units: 'PIXELS' },
            textDecorationSkipInk: oracle.textDecorationSkipInk,
            textDecorationFillPaints: [oracleColorToPaint(secondRange.textDecorationColor)]
          }
        ]
      },
      fontSize: 32,
      textDecoration: firstRange.textDecoration,
      textDecorationStyle: firstRange.textDecorationStyle,
      textDecorationThickness: {
        value: firstRange.textDecorationThickness.value,
        units: 'PIXELS'
      },
      textUnderlineOffset: { value: oracle.textDecorationOffset.value, units: 'PIXELS' },
      textDecorationSkipInk: oracle.textDecorationSkipInk,
      textDecorationFillPaints: [oracleColorToPaint(firstRange.textDecorationColor)],
      leadingTrim: oracle.leadingTrim
    }

    const props = nodeChangeToProps(nodeChange, [])

    expect(props.text).toBe(oracle.characters)
    expect(props.textDecoration).toBe('UNDERLINE')
    expect(props.textDecorationStyle).toBe('WAVY')
    expect(props.textDecorationThickness).toBe(2)
    expect(props.textDecorationFills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(props.textUnderlineOffset).toBe(5)
    expect(props.textDecorationSkipInk).toBe(false)
    expect(props.leadingTrim).toBe('CAP_HEIGHT')
    expect(props.styleRuns).toEqual([
      {
        start: secondRange.start,
        length: secondRange.end - secondRange.start,
        style: {
          textDecoration: 'UNDERLINE',
          textDecorationStyle: 'DOTTED',
          textDecorationThickness: 3,
          textDecorationSkipInk: false,
          textUnderlineOffset: 5,
          textDecorationFills: [
            {
              type: 'SOLID',
              visible: true,
              opacity: 1,
              blendMode: 'NORMAL',
              color: { r: 0, g: 0.25, b: 1, a: 1 }
            }
          ]
        }
      }
    ])
  })

  test('exports captured Figma text decoration offset and skip-ink fields', () => {
    const oracle = readOracle()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: oracle.characters,
      textDecoration: 'UNDERLINE',
      textUnderlineOffset: oracle.textDecorationOffset.value,
      textDecorationSkipInk: oracle.textDecorationSkipInk
    })

    const changes = sceneNodeToKiwi(text, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes[0].textUnderlineOffset).toEqual({ value: 5, units: 'PIXELS' })
    expect(changes[0].textDecorationSkipInk).toBe(false)
  })
})
