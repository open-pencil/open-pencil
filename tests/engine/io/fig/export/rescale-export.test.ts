import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { SymbolData } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { setInstanceOverride } from '@open-pencil/scene-graph'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'
import { expectDefined } from '#tests/helpers/assert'

for (const scale of [0.5, 2]) {
  for (const literalClaim of [false, true]) {
    test(`rescaling an imported owner by ${scale} exports current coordinates (literal claim: ${literalClaim})`, async () => {
      const { graph, sources } = materializeDocument(
        fixture.nodeChanges as NodeChange[],
        fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
        { derivedBounds: true }
      )
      const root = expectDefined(graph.getNode(expectDefined(sources.get('293733:8'))))
      const nested = expectDefined(graph.getChildren(root.id)[0])
      const api = new FigmaAPI(graph)
      api.bindVariable(root.id, 'paddingRight', '293742:7')
      api.bindVariable(nested.id, 'paddingRight', '293742:7')
      if (literalClaim) {
        createEditor({ graph }).updateNodeWithUndo(root.id, { paddingLeft: 12 })
        setInstanceOverride(root.instanceOverrides, root.id, root.id, 'paddingLeft', 12)
      }
      api.getNodeById(root.id).rescale(scale)
      expect([
        root.width,
        root.height,
        root.paddingRight,
        nested.width,
        nested.paddingLeft,
        nested.paddingRight
      ]).toEqual([
        (literalClaim ? 35 : 33) * scale,
        7 * scale,
        6 * scale,
        17 * scale,
        6 * scale,
        6 * scale
      ])
      graph.updateNode(root.id, { name: 'Rescaled owner' })
      await initCodec()
      const bytes = await exportFigFile(graph)
      const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
      const exported = expectDefined(
        parsed.nodeChanges.find((node) => node.name === 'Rescaled owner')
      )
      const symbol = exported.symbolData as SymbolData
      expect(
        symbol.symbolOverrides?.filter((entry) => entry.size).map((entry) => entry.guidPath?.guids)
      ).toEqual([[symbol.symbolID]])
      const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
        derivedBounds: true
      }).graph
      const restored = expectDefined(
        reopened.getAllNodes().find((node) => node.name === 'Rescaled owner')
      )
      const child = expectDefined(reopened.getChildren(restored.id)[0])
      expect([
        restored.width,
        restored.height,
        restored.paddingRight,
        child.width,
        child.paddingLeft,
        child.paddingRight
      ]).toEqual([
        (literalClaim ? 35 : 33) * scale,
        7 * scale,
        6 * scale,
        17 * scale,
        6 * scale,
        6 * scale
      ])
      expect(restored.paddingLeft).toBe((literalClaim ? 12 : 10) * scale)
      expect(restored.componentScale).toBe(scale * 0.5)
      expect(child.variableBindingScales.paddingLeft).toBe(scale * 0.5)
      const variable = expectDefined(reopened.variables.get(child.boundVariables.paddingLeft))
      new FigmaAPI(reopened).setVariableValue(
        variable.id,
        reopened.getNodeVariableModeId(child.id, variable.collectionId),
        16
      )
      expect(child.paddingLeft).toBe(8 * scale)
      expect(restored.width).toBe((literalClaim ? 41 : 39) * scale)
    })
  }
}
