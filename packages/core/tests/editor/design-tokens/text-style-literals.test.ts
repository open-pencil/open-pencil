import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'

import {
  defaultTokenImportOptions,
  exportDesignTokens,
  planTokenImport,
  readDesignTokens
} from '#core/io/formats/design-tokens'

function documentWithHeading(fontSize: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const theme = graph.createCollection('Theme')
  const dark = graph.createMode(theme.id, 'Dark') ?? ''
  const size = graph.createVariable('Type/H1', 'FLOAT', theme.id, 32)
  size.valuesByMode[dark] = 40
  const heading = graph.createNode('TEXT', page, {
    name: 'Heading',
    fontFamily: 'Inter',
    fontSize,
    sharedStyleType: 'TEXT',
    internalOnly: true
  })
  heading.source.id = 'style:heading'
  return { graph, page, theme, dark, size, heading }
}

function tokensOf(graph: SceneGraph) {
  return exportDesignTokens(graph).files.map((file) => ({
    path: file.path,
    text: JSON.stringify(file.content)
  }))
}

test('a text style field a token writes as a literal lets its variable go', () => {
  const target = documentWithHeading(32)
  target.graph.bindVariable(target.heading.id, 'fontSize', target.size.id)
  const [style] = getSharedStyles(target.graph, 'text')
  const frame = target.graph.createNode('FRAME', target.page, {
    variableModes: { [target.theme.id]: target.dark }
  })
  const layer = target.graph.createNode('TEXT', frame.id, {
    text: 'Title',
    fontFamily: 'Inter',
    fontSize: 40,
    textStyleId: style.id
  })
  const files = tokensOf(documentWithHeading(24).graph)
  const editor = createEditor({ graph: target.graph })
  const bundle = readDesignTokens(files)

  try {
    editor.importDesignTokens(
      planTokenImport(target.graph, bundle, defaultTokenImportOptions(target.graph, bundle))
    )

    expect(target.graph.getNode(target.heading.id)?.boundVariables.fontSize).toBeUndefined()
    expect(target.graph.getNode(layer.id)).toMatchObject({ fontSize: 24, textStyleId: style.id })
  } finally {
    editor.dispose()
  }
})
