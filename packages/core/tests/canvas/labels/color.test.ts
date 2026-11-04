import { describe, expect, test } from 'bun:test'
import { expectDefined } from '@open-pencil/test-support/assert'
import { outlineColorInMode, canvasLabelForeground } from '@open-pencil/core/canvas'
import { SceneGraph } from '@open-pencil/scene-graph'
import { figJamColor, figJamSectionColorFields, figJamSectionTitleColors } from '@open-pencil/scene-graph/figjam'

describe('section title colours', () => {
  // A board titles a section in the outline it draws, which a variable sets per mode.
  test("take the outline's colour in the section's active mode", () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Theme')
    const light = collection.defaultModeId
    const dark = expectDefined(graph.createMode(collection.id, 'Dark'), 'dark mode')
    const outline = graph.createVariable('Outline', 'COLOR', collection.id, figJamColor('red'))
    outline.valuesByMode[dark] = figJamColor('yellow')
    const section = graph.createNode('SECTION', page.id, {
      ...figJamSectionColorFields({ strokes: [] }, 'red'),
      boundVariables: { 'strokes/0/color': outline.id }
    })
    const titleIn = (modeId: string) => {
      graph.updateNode(section.id, { variableModes: { [collection.id]: modeId } })
      const node = expectDefined(graph.getNode(section.id), 'section')
      return figJamSectionTitleColors(node, (stroke, index) =>
        outlineColorInMode(graph, node, stroke, index)
      )?.lightText
    }
    // Red takes white text, yellow black, though the stored outline stays red.
    expect(titleIn(light)).toBe(true)
    expect(titleIn(dark)).toBe(false)
  })
})

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }

describe('canvas label contrast', () => {
  test('chooses the higher-contrast foreground for opaque midtones', () => {
    expect(canvasLabelForeground({ r: 0.49, g: 0.49, b: 0.49, a: 1 })).toEqual(BLACK)
  })

  test('composites translucent fills over the canvas before choosing contrast', () => {
    const translucentBlack = { r: 0, g: 0, b: 0, a: 0.2 }

    expect(canvasLabelForeground(translucentBlack, WHITE)).toEqual(BLACK)
    expect(canvasLabelForeground(translucentBlack, BLACK)).toEqual(WHITE)
  })
})
