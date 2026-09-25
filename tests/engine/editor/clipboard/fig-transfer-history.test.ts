import { expect, test } from 'bun:test'

import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeFigFragment } from '@open-pencil/fig'
import { CommittedGraphEventError } from '@open-pencil/scene-graph'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'
import { expectDefined } from '#tests/helpers/assert'

for (const failObserver of [false, true]) {
  for (const replaceSelection of [false, true]) {
    test(`FIG paste owns nested definitions and variables through history (replace=${replaceSelection}, observer=${failObserver})`, async () => {
      await initCodec()
      const fragment = materializeFigFragment(
        fixture.nodeChanges,
        fixture.blobs.map((value) => Uint8Array.fromBase64(value))
      )
      const root = expectDefined(
        fragment.graph.getNode(expectDefined(fragment.sources.get('293733:8')))
      )
      const html = expectDefined(await buildFigmaClipboardHTML([root], fragment.graph))
      const editor = createEditor()
      const target = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        x: 100,
        y: 100,
        width: 40,
        height: 40
      })
      editor.select([target.id])
      const before = [...editor.graph.nodes.keys()]
      let unsubscribe: (() => void) | undefined
      if (failObserver)
        unsubscribe = editor.graph.onNodeEvents({
          created: () => {
            throw new Error('Observer failure')
          }
        })
      const paste = editor.pasteFromHTML(html, undefined, { replaceSelection })
      if (failObserver) await expect(paste).rejects.toBeInstanceOf(CommittedGraphEventError)
      else await paste
      unsubscribe?.()
      const ids = [...editor.state.selectedIds]
      expect(ids).toHaveLength(1)
      const placed = expectDefined(editor.graph.getNode(ids[0]))
      const nested = editor.graph.getChildren(placed.id)[0]
      expect(nested.paddingLeft).toBe(6)
      expect(editor.graph.getNode(placed.componentId ?? '')).toBeDefined()
      expect(editor.graph.variables.has(nested.boundVariables.paddingLeft)).toBe(true)
      expect(editor.graph.getNode(target.id) === undefined).toBe(replaceSelection)
      const position = { x: placed.x, y: placed.y }
      editor.undo.undo()
      expect(new Set(editor.graph.nodes.keys())).toEqual(new Set(before))
      expect(editor.graph.variables.size).toBe(0)
      expect(editor.graph.variableCollections.size).toBe(0)
      editor.undo.redo()
      expect(editor.graph.getNode(placed.id)).toMatchObject(position)
      expect(editor.graph.getNode(placed.componentId ?? '')).toBeDefined()
      expect(editor.graph.variables.has(nested.boundVariables.paddingLeft)).toBe(true)
      if (replaceSelection && !failObserver) {
        editor.undo.undo()
        editor.graph.createNodeWithId(placed.id, 'RECTANGLE', editor.state.currentPageId)
        expect(() => editor.undo.redo()).toThrow('Transfer identity collision')
        expect(editor.graph.getNode(target.id)).toBeDefined()
      }
    })
  }
}
