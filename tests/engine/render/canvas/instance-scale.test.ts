import { expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { rescaleNodeTree } from '@open-pencil/scene-graph'

import declared from '#tests/fixtures/nested-binding-ownership-records.json'
import fixture from '#tests/fixtures/nested-layout-scale.json'
import { expectDefined } from '#tests/helpers/assert'
import { inheritedNestedBindingRecords } from '#tests/helpers/fig/nested-binding'

for (const edit of [
  'direct',
  'variable',
  'declared',
  'authored',
  'component',
  'expression',
  'rescale',
  'definition'
] as const) {
  test(`${edit} nested scale edit matches the independent Figma raster`, async () => {
    const captured = edit !== 'direct' && edit !== 'variable'
    const records = captured
      ? declared.nodeChanges
      : [{ guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' }, ...fixture.before]
    const { graph, sources } = materializeDocument(
      ['expression', 'definition'].includes(edit)
        ? inheritedNestedBindingRecords()
        : (records as NodeChange[]),
      (captured ? declared : fixture).blobs.map((value) => Uint8Array.fromBase64(value)),
      { derivedBounds: true }
    )
    const rootId = expectDefined(
      sources.get(captured ? '293733:8' : fixture.ids.instance),
      'instance'
    )
    const width = {
      direct: 300,
      variable: 300,
      declared: 268,
      authored: 264,
      component: 264,
      expression: 300,
      rescale: 132,
      definition: 180
    }[edit]
    const height = {
      direct: 56,
      variable: 56,
      declared: 56,
      authored: 56,
      component: 64,
      expression: 56,
      rescale: 28,
      definition: 56
    }[edit]
    const nested = expectDefined(graph.getChildren(rootId)[0], 'nested instance')
    const editor = createEditor({ graph })
    if (!captured) editor.updateNodeWithUndo(rootId, { paddingLeft: 13 })
    if (edit === 'definition') {
      rescaleNodeTree(graph, rootId, 0.5)
      const outer = expectDefined(sources.get('1:4'), 'outer component')
      rescaleNodeTree(graph, graph.getChildren(outer)[0].id, 2)
      await Promise.resolve()
      expect(nested.paddingLeft).toBe(5)
    } else if (['authored', 'component', 'rescale'].includes(edit)) {
      editor.bindVariable(rootId, 'paddingRight', '293742:7')
      editor.bindVariable(nested.id, 'paddingRight', '293742:7')
      expect(nested.paddingRight).toBe(6)
      if (edit === 'rescale') rescaleNodeTree(graph, rootId, 0.5)
      if (edit === 'component') {
        editor.updateNodeWithUndo(expectDefined(sources.get('1:2'), 'component'), { paddingTop: 8 })
        await Promise.resolve()
        expect(nested.paddingTop).toBe(2)
      }
    } else if (edit === 'declared' || edit === 'expression') {
      const values =
        edit === 'expression'
          ? { first: 60, second: 40, afterFirst: 15, afterSecond: 10 }
          : { first: 16, second: 12, afterFirst: 8, afterSecond: 6 }
      const variable = expectDefined(
        graph.variables.get(nested.boundVariables.paddingLeft),
        'declared variable'
      )
      const mode = graph.getNodeVariableModeId(nested.id, variable.collectionId)
      editor.updateVariableValue(variable.id, mode, values.first)
      expect(nested.paddingLeft).toBe(values.afterFirst)
      editor.updateVariableValue(variable.id, mode, values.second)
      expect(nested.paddingLeft).toBe(values.afterSecond)
    } else if (edit === 'direct') editor.updateNodeWithUndo(nested.id, { paddingLeft: 7 })
    else {
      const collection = graph.createCollection('Spacing')
      const variable = graph.createVariable('Padding', 'FLOAT', collection.id, 10)
      graph.updateNode(nested.id, {
        boundVariables: { paddingLeft: variable.id },
        variableBindingScales: { paddingLeft: 0.25 }
      })
      editor.updateVariableValue(variable.id, collection.defaultModeId, 28)
    }

    const ck = await initCanvasKit()
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [rootId], {
          scale: 8,
          format: 'PNG',
          trimTransparent: false
        }),
        'rendered PNG'
      )
      const expectedBytes = new Uint8Array(
        await Bun.file(
          new URL(
            {
              direct: '../../../fixtures/nested-layout-scale-figma.png',
              variable: '../../../fixtures/nested-layout-scale-figma.png',
              declared: '../../../fixtures/nested-binding-ownership-figma.png',
              authored: '../../../fixtures/nested-binding-authoring-figma.png',
              component: '../../../fixtures/nested-component-scale-figma.png',
              expression: '../../../fixtures/nested-binding-expression-figma.png',
              rescale: '../../../fixtures/nested-owner-rescale-figma.png',
              definition: '../../../fixtures/nested-definition-rescale-figma.png'
            }[edit],
            import.meta.url
          )
        ).arrayBuffer()
      )
      const pixels = (bytes: Uint8Array) => {
        const image = expectDefined(ck.MakeImageFromEncoded(bytes), 'decoded PNG')
        try {
          expect([image.width(), image.height()]).toEqual([width, height])
          return expectDefined(
            image.readPixels(0, 0, {
              width,
              height,
              alphaType: ck.AlphaType.Unpremul,
              colorType: ck.ColorType.RGBA_8888,
              colorSpace: ck.ColorSpace.SRGB
            }),
            'decoded pixels'
          )
        } finally {
          image.delete()
        }
      }
      expect(pixels(png)).toEqual(pixels(expectedBytes))
    } finally {
      renderer.destroy()
    }
  })
}
