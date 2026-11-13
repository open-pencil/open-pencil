import { describe, expect, test } from 'bun:test'

import { symbolDataOf } from '#fig/instance-overrides/types'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { expectDefined } from '@open-pencil/test-support/assert'

describe('exporting an instance’s claims on its layers', () => {
  test('merges edited text into an existing override path', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    const sourceText = graph.createNode('TEXT', component.id, {
      overrideKey: '2:20',
      text: 'Default'
    })
    const created = graph.createInstance(component.id, page.id)
    expect(created).toBeDefined()
    const instance = expectDefined(created, 'instance')
    const targetText = graph.getChildren(instance.id)[0]
    expect(targetText).toBeDefined()
    const originalOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
      textData: { characters: 'Stale' },
      opacity: 0.5
    }
    graph.updateNode(instance.id, {
      instanceOverrides: {
        self: new Map(),
        descendants: new Map([[targetText.id, new Map([['text', 'Edited']])]])
      },
      source: {
        ...instance.source,
        fig: {
          ...instance.source.fig,
          symbolOverrides: [originalOverride]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(sourceText.overrideKey).toBe('2:20')
    // Figma writes a text claim with its lines, as the layer's own record has them.
    expect(symbolDataOf(change)?.symbolOverrides).toEqual([
      {
        ...originalOverride,
        textData: {
          characters: 'Edited',
          lines: [
            {
              indentationLevel: 0,
              isFirstLineOfList: false,
              lineType: 'PLAIN',
              listStartOffset: 0,
              sourceDirectionality: 'AUTO',
              styleId: 0
            }
          ]
        }
      }
    ])
  })

  test('writes styled ranges with the characters of a text claim, as Figma does', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    graph.createNode('TEXT', component.id, {
      overrideKey: '2:20',
      text: 'Hello world',
      fontSize: 12
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const [text] = graph.getChildren(instance.id)
    // Recorded by a script that restyles the first word only; the characters are unchanged.
    graph.updateNode(text.id, { styleRuns: [{ start: 0, length: 5, style: { fontSize: 30 } }] })
    graph.updateNode(instance.id, {
      instanceOverrides: {
        self: new Map(),
        descendants: new Map([[text.id, new Map<string, unknown>([['styleRuns', text.styleRuns]])]])
      }
    })

    const [change] = sceneNodeToKiwi(
      instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const [claim] = symbolDataOf(change)?.symbolOverrides ?? []
    // The first word takes style 1; the rest keep the layer's own style, 0.
    expect(claim.textData).toMatchObject({
      characters: 'Hello world',
      characterStyleIDs: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      styleOverrideTable: [expect.objectContaining({ styleID: 1, fontSize: 30 })]
    })
  })

  test('writes style overrides as the layer’s own record claims them, in the component’s scale', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    graph.createNode('RECTANGLE', component.id, { overrideKey: '2:20', strokeWeight: 2 })
    graph.createNode('TEXT', component.id, {
      overrideKey: '2:21',
      text: 'A',
      lineHeight: pixelLength(30)
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const [rect, text] = graph.getChildren(instance.id)
    // Placed at twice the component's size, as a scaled instance is.
    graph.updateNode(instance.id, { componentScale: 2 })
    graph.updateNode(rect.id, { strokeWeight: 8, strokeAlign: 'CENTER', cornerSmoothing: 0.6 })
    graph.updateNode(text.id, { lineHeight: null, letterSpacing: pixelLength(4) })
    graph.updateNode(instance.id, {
      instanceOverrides: {
        self: new Map(),
        descendants: new Map([
          [
            rect.id,
            new Map<string, unknown>([
              ['strokeWeight', 8],
              ['strokeAlign', 'CENTER'],
              ['cornerSmoothing', 0.6]
            ])
          ],
          [
            text.id,
            new Map<string, unknown>([
              ['lineHeight', null],
              ['letterSpacing', pixelLength(4)]
            ])
          ]
        ])
      },
      source: {
        ...instance.source,
        fig: {
          ...instance.source.fig,
          // A stale claim read from the file, replaced by the edit.
          symbolOverrides: [
            { guidPath: { guids: [{ sessionID: 2, localID: 20 }] }, strokeWeight: 1 }
          ]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(symbolDataOf(change)?.symbolOverrides).toEqual([
      {
        guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
        strokeWeight: 4,
        // Figma reads a missing alignment as centred, so the claim spells it out.
        strokeAlign: 'CENTER',
        cornerSmoothing: 0.6
      },
      {
        guidPath: { guids: [{ sessionID: 2, localID: 21 }] },
        lineHeight: { value: 100, units: 'PERCENT' },
        letterSpacing: { value: 2, units: 'PIXELS' }
      }
    ])
  })
})
