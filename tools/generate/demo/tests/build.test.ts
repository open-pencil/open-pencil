import { describe, expect, test } from 'bun:test'

import { measuringRenderer, withMeasuredText } from '#demo/build'
import { createControlsSection } from '#demo/document/controls/section'

import { exportFigFile, readFigFile } from '@open-pencil/core/io'
import { populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { missingBindings, readBehaviour, SceneGraph } from '@open-pencil/scene-graph'

describe('demo controls', () => {
  test('keep complete behaviours through the .fig the demo opens', async () => {
    const { ck, renderer } = await measuringRenderer()
    const built = await withMeasuredText(renderer, async () => {
      const graph = new SceneGraph()
      const [page] = graph.getPages()
      await createControlsSection(graph, page.id)
      computeAllLayouts(graph, page.id)
      return graph
    })
    const bytes = await exportFigFile(built, ck, renderer)
    const graph = await readFigFile(new File([bytes.slice()], 'Demo.fig'))
    populateAllFigPages(graph)

    const controls = [...graph.getAllNodes()].flatMap((node) => {
      const behaviour = node.type === 'INSTANCE' ? null : readBehaviour(node)
      return behaviour
        ? [{ kind: behaviour.kind, missing: missingBindings(graph, node, behaviour) }]
        : []
    })
    expect(controls.map((control) => control.kind).sort()).toEqual([
      'button',
      'checkbox',
      'slider',
      'switch',
      'tabs',
      'textField'
    ])
    for (const control of controls) expect(control.missing).toEqual([])
  })
})
