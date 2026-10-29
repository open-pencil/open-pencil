import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import {
  readStatusWorkflow,
  STATUS_WORKFLOW_PRESETS,
  writeStatusWorkflow
} from '@open-pencil/scene-graph/statuses'

describe('.fig round trip of statuses', () => {
  test('keeps the workflow and every status, Figma-shown or not', async () => {
    await initCodec()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    writeStatusWorkflow(editor.graph, STATUS_WORKFLOW_PRESETS.review)
    const section = editor.graph.createNode('SECTION', pageId, {
      name: 'Checkout',
      status: 'approved'
    })
    editor.graph.createNode('FRAME', section.id, { name: 'Cart', status: 'ready-for-dev' })

    const reopened = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
    const byName = (name: string) => [...reopened.nodes.values()].find((node) => node.name === name)
    expect(readStatusWorkflow(reopened)).toEqual(STATUS_WORKFLOW_PRESETS.review)
    expect(byName('Checkout')?.status).toBe('approved')
    expect(byName('Cart')?.status).toBe('ready-for-dev')
  })
})
