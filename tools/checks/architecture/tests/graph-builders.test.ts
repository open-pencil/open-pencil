import { describe, expect, test } from 'bun:test'

import { graphBuilderImports } from '../src/steiger-rules/graph-builders'

describe('graph builders in front ends', () => {
  test('finds format packages building layers that Core would lay out', () => {
    const content = [
      "import { browserHTMLToSceneGraph, serializeHTML } from '@lawha/dom-css/browser'",
      "import { parsePenFile as parse } from '@lawha/pen'",
      "import { renderTree } from '@lawha/design-jsx'"
    ].join('\n')
    expect(graphBuilderImports('src/app/document/io/dom.ts', content)).toEqual([
      { specifier: '@lawha/dom-css/browser', name: 'browserHTMLToSceneGraph', line: 1 },
      { specifier: '@lawha/pen', name: 'parsePenFile', line: 2 },
      { specifier: '@lawha/design-jsx', name: 'renderTree', line: 3 }
    ])
  })

  test('reports the line in a Vue file', () => {
    const content = `<template>\n  <div />\n</template>\n<script setup lang="ts">\nimport { htmlToSceneGraph } from '@lawha/dom-css'\n</script>\n`
    expect(graphBuilderImports('packages/vue/src/Panel.vue', content)).toEqual([
      { specifier: '@lawha/dom-css', name: 'htmlToSceneGraph', line: 5 }
    ])
  })

  test('allows Core, styling helpers, types, and the format packages themselves', () => {
    expect(
      graphBuilderImports(
        'src/app/code/dom-preview.ts',
        [
          "import { sceneGraphFromStyledHTML } from '@lawha/core/io/formats/html/layers'",
          "import { browserHTMLToDesignDocument } from '@lawha/dom-css/browser'",
          "import { renderTree } from '@lawha/core/design-jsx'",
          "import { type renderJSX } from '@lawha/design-jsx'"
        ].join('\n')
      )
    ).toEqual([])
    expect(
      graphBuilderImports(
        'packages/core/src/io/formats/html/import.ts',
        "import { designDocumentToSceneGraph } from '@lawha/dom-css'"
      )
    ).toEqual([])
  })
})
