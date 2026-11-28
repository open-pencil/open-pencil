import { createEditor } from '@open-pencil/core'
import { SceneGraph, type Variable } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import {
  defaultTokenImportOptions,
  exportDesignTokens,
  planTokenImport,
  readDesignTokens,
  type DesignTokenSourceFile
} from '#core/io/formats/design-tokens'

export const blue = { r: 0, g: 0.4, b: 0.8, a: 1 }
export const white = { r: 1, g: 1, b: 1, a: 1 }

export function designSystem() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const primitives = graph.createCollection('Primitives')
  const brand = graph.createVariable('Blue/500', 'COLOR', primitives.id, blue)
  const theme = graph.createCollection('Theme')
  graph.renameMode(theme.id, theme.defaultModeId, 'Light')
  const dark = graph.createMode(theme.id, 'Dark') ?? ''
  const accent = graph.createVariable('Accent', 'COLOR', theme.id, { aliasId: brand.id })
  accent.valuesByMode[dark] = white
  const gutter = graph.createVariable('Space/Gutter', 'FLOAT', theme.id, 24)
  gutter.unit = 'rem'
  gutter.expressions = { [theme.defaultModeId]: { css: 'clamp(1rem, 4vw, 1.5rem)', resolved: 24 } }
  graph.createVariable('Flags/Rounded', 'BOOLEAN', theme.id, true)
  const fast = graph.createVariable('Motion/Fast', 'FLOAT', theme.id, 150)
  fast.unit = 'ms'
  const family = graph.createVariable('Font/Body', 'STRING', theme.id, 'Inter')
  family.scopes = ['FONT_FAMILY']
  const heading = graph.createNode('TEXT', page, {
    name: 'Heading/H1',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 32,
    lineHeight: pixelLength(40),
    sharedStyleType: 'TEXT',
    internalOnly: true,
    boundVariables: { fontFamily: family.id }
  })
  heading.source.id = 'style:heading'
  return graph
}

export function exported(graph: SceneGraph): DesignTokenSourceFile[] {
  return exportDesignTokens(graph).files.map((file) => ({
    path: file.path,
    text: JSON.stringify(file.content)
  }))
}

export function editorImporting(graph: SceneGraph, files: DesignTokenSourceFile[]) {
  const editor = createEditor({ graph })
  const bundle = readDesignTokens(files)
  const plan = planTokenImport(graph, bundle, defaultTokenImportOptions(graph, bundle))
  return { editor, plan, result: editor.importDesignTokens(plan) }
}

export function importInto(graph: SceneGraph, files: DesignTokenSourceFile[]) {
  const { editor, plan, result } = editorImporting(graph, files)
  editor.dispose()
  return { plan, result }
}

export function variableNamed(graph: SceneGraph, name: string): Variable {
  const found = [...graph.variables.values()].find((variable) => variable.name === name)
  if (!found) throw new Error(`missing ${name}`)
  return found
}
