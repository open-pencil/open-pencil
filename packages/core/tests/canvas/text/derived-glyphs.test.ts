import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { drawDerivedText } from '#core/canvas/text/derived'
import { getCanvasKit } from '#core/canvaskit'

/** A unit square in the saved glyph command format: move, three lines, and the end. */
function squareCommandsBlob(): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const corners = [
    [1, 0, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 0, 1]
  ]
  for (const [index, [command, x, y]] of corners.entries()) {
    blob[index * 9] = command
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  }
  return blob
}

test('decodes each saved glyph once, however often its text is recorded', async () => {
  const ck = await getCanvasKit()
  const graph = new SceneGraph()
  const text = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'AB',
    width: 40,
    height: 20,
    fontSize: 10,
    derivedTextGlyphs: [
      { commandsBlob: squareCommandsBlob(), x: 0, y: 10, fontSize: 10, firstCharacter: 0 },
      { commandsBlob: squareCommandsBlob(), x: 20, y: 10, fontSize: 10, firstCharacter: 1 }
    ]
  })
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
  const recorder = new ck.PictureRecorder()
  try {
    const record = () => {
      drawDerivedText(renderer, recorder.beginRecording(ck.LTRBRect(0, 0, 40, 20)), text)
      recorder.finishRecordingAsPicture().delete()
    }
    record()
    const decoded = [...renderer.derivedGlyphPathCache.values()]
    expect(decoded).toHaveLength(2)
    record()
    // Recording the text again draws the outlines decoded the first time.
    expect([...renderer.derivedGlyphPathCache.values()]).toEqual(decoded)
  } finally {
    recorder.delete()
    renderer.destroy()
  }
})
