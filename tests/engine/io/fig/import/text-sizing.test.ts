import { describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/core'
import { importNodeChanges } from '@open-pencil/core/kiwi'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { getNodeOrThrow } from '#tests/helpers/assert'

function guid(localID: number): NonNullable<NodeChange['guid']> {
  return { sessionID: 0, localID }
}

function documentNode(): NodeChange {
  return { guid: guid(0), type: 'DOCUMENT', name: 'Document' }
}

function canvasNode(): NodeChange {
  return {
    guid: guid(1),
    type: 'CANVAS',
    name: 'Page 1',
    parentIndex: { guid: guid(0), position: '!' }
  }
}

function stackFrame(localID: number): NodeChange {
  return {
    guid: guid(localID),
    type: 'FRAME',
    name: 'Button',
    parentIndex: { guid: guid(1), position: '!' },
    size: { x: 88, y: 32 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    stackMode: 'HORIZONTAL',
    stackCounterSizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE',
    stackHorizontalPadding: 16,
    stackVerticalPadding: 5
  }
}

function textNode(
  localID: number,
  parentID: number,
  options: { size?: Vector; derivedSize?: Vector } = {}
): NodeChange {
  const size = options.size ?? { x: 56, y: 22 }
  return {
    guid: guid(localID),
    type: 'TEXT',
    name: '↘︎ Text',
    parentIndex: { guid: guid(parentID), position: '!' },
    size,
    transform: { m00: 1, m01: 0, m02: 16, m10: 0, m11: 1, m12: 5 },
    textAutoResize: 'NONE',
    textUserLayoutVersion: 4,
    textExplicitLayoutVersion: 1,
    textData: { characters: '主要按钮', lines: [{ lineType: 'PLAIN' }] },
    fontSize: 14,
    fontName: { family: 'PingFang SC', style: 'Medium', postscript: '' },
    lineHeight: { value: 22, units: 'PIXELS' },
    textAlignHorizontal: 'CENTER',
    textAlignVertical: 'TOP',
    derivedTextData: {
      layoutSize: options.derivedSize ?? size,
      baselines: [
        {
          position: { x: 0, y: 22 },
          width: 56,
          lineHeight: 22,
          lineAscent: 19.2,
          firstCharacter: 0,
          endCharacter: 3
        }
      ]
    }
  }
}

describe('FIG text sizing import', () => {
  test('imports Figma auto-layout text matching derived layout as auto-size', () => {
    const graph = importNodeChanges([documentNode(), canvasNode(), stackFrame(2), textNode(3, 2)])

    const text = graph.getAllNodes().find((node) => node.type === 'TEXT')
    if (!text) throw new Error('Expected text node')

    expect(getNodeOrThrow(graph, text.id).textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(getNodeOrThrow(graph, text.id).width).toBe(56)
    expect(getNodeOrThrow(graph, text.id).height).toBe(22)
  })

  test('keeps fixed text outside auto-layout fixed', () => {
    const graph = importNodeChanges([documentNode(), canvasNode(), textNode(3, 1)])

    const text = graph.getAllNodes().find((node) => node.type === 'TEXT')
    if (!text) throw new Error('Expected text node')

    expect(getNodeOrThrow(graph, text.id).textAutoResize).toBe('NONE')
  })

  test('keeps explicit larger text boxes inside auto-layout fixed', () => {
    const graph = importNodeChanges([
      documentNode(),
      canvasNode(),
      stackFrame(2),
      textNode(3, 2, { size: { x: 120, y: 48 }, derivedSize: { x: 56, y: 22 } })
    ])

    const text = graph.getAllNodes().find((node) => node.type === 'TEXT')
    if (!text) throw new Error('Expected text node')

    expect(getNodeOrThrow(graph, text.id).textAutoResize).toBe('NONE')
  })
})
