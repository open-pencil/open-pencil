import { describe, expect, test } from 'bun:test'

import { buildDemoDocument } from '#demo/build'

import { readFigFile } from '@open-pencil/core/io'
import { populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { missingBindings, readBehaviour } from '@open-pencil/scene-graph'

describe('demo document', () => {
  test('opens as four pages whose controls keep complete behaviours', async () => {
    const bytes = await buildDemoDocument()
    const graph = await readFigFile(new File([bytes.slice()], 'Demo.fig'))
    populateAllFigPages(graph)

    expect(graph.getPages().map((page) => page.name)).toEqual([
      '01 · Components & variables',
      '02 · Typography',
      '03 · Paint & effects',
      '04 · Controls'
    ])
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
