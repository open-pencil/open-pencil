import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { outlineColorInMode } from '@lawha/core/canvas'
import { SceneGraph } from '@lawha/scene-graph'
import { figJamColor, figJamSectionColorFields, figJamSectionTitleColors } from '@lawha/scene-graph/figjam'

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
