import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: text metrics', () => {
  it('imports fontWeight from fontName.style via styleToWeight', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Medium',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'Hello' },
        fontSize: 14,
        fontName: { family: 'PT Root UI', style: 'Medium', postscript: 'PTRootUI-Medium' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'Bold',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 20 },
        textData: { characters: 'World' },
        fontSize: 14,
        fontName: { family: 'Inter', style: 'Bold', postscript: 'Inter-Bold' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'Italic',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'Italic' },
        fontSize: 14,
        fontName: { family: 'Inter', style: 'Bold Italic', postscript: 'Inter-BoldItalic' }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).fontWeight).toBe(500)
    expect(getNodeOrThrow(graph, created[1]).fontWeight).toBe(700)
    expect(getNodeOrThrow(graph, created[2]).fontWeight).toBe(700)
    expect(getNodeOrThrow(graph, created[2]).italic).toBe(true)
  })

  it('converts letterSpacing object to pixels', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'PixelSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'A' },
        fontSize: 20,
        letterSpacing: { value: 2, units: 'PIXELS' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'PercentSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 20 },
        textData: { characters: 'B' },
        fontSize: 20,
        letterSpacing: { value: 10, units: 'PERCENT' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'NoSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'C' },
        fontSize: 20
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).letterSpacing).toBe(2)
    expect(getNodeOrThrow(graph, created[1]).letterSpacing).toBe(2) // 10% of 20px
    expect(getNodeOrThrow(graph, created[2]).letterSpacing).toBe(0)
  })

  it('converts RAW lineHeight to pixels', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'RawLH',
        size: { x: 100, y: 36 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'A' },
        fontSize: 24,
        lineHeight: { value: 1.5, units: 'RAW' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'PixelLH',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'B' },
        fontSize: 16,
        lineHeight: { value: 20, units: 'PIXELS' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'PercentLH',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 80 },
        textData: { characters: 'C' },
        fontSize: 20,
        lineHeight: { value: 120, units: 'PERCENT' }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).lineHeight).toBe(36) // 24 * 1.5
    expect(getNodeOrThrow(graph, created[1]).lineHeight).toBe(20)
    expect(getNodeOrThrow(graph, created[2]).lineHeight).toBe(24) // 120% of 20
  })

  it('converts letterSpacing and lineHeight in style overrides', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Styled',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        fontSize: 16,
        textData: {
          characters: 'Hello World',
          characterStyleIDs: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
          styleOverrideTable: [
            {
              styleID: 1,
              fontName: { family: 'Inter', style: 'Bold' },
              fontSize: 20,
              lineHeight: { value: 1.5, units: 'RAW' },
              letterSpacing: { value: -2, units: 'PERCENT' }
            }
          ]
        }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const node = getNodeOrThrow(graph, created[0])
    expect(node.styleRuns).toHaveLength(1)
    expect(node.styleRuns[0].style.lineHeight).toBe(30) // 20 * 1.5
    expect(node.styleRuns[0].style.letterSpacing).toBeCloseTo(-0.4) // 20 * -2/100
  })

  it('imports textAutoResize from clipboard data', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'AutoHeight',
        size: { x: 200, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'Hello' },
        fontSize: 16,
        textAutoResize: 'HEIGHT'
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'AutoBoth',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 30 },
        textData: { characters: 'World' },
        fontSize: 16,
        textAutoResize: 'WIDTH_AND_HEIGHT'
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'Fixed',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 60 },
        textData: { characters: 'Fixed' },
        fontSize: 16
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).textAutoResize).toBe('HEIGHT')
    expect(getNodeOrThrow(graph, created[1]).textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(getNodeOrThrow(graph, created[2]).textAutoResize).toBe('NONE')
  })
})
