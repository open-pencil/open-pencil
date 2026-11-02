import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createEditor } from '@open-pencil/core/editor'
import { parseFigBuffer } from '@open-pencil/fig'
import {
  componentPropertyDefinitions,
  createComponentPropertyId
} from '@open-pencil/scene-graph/components'

import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

interface OverrideRecord {
  name?: string
  symbolData?: { symbolOverrides?: Array<{ componentPropAssignments?: unknown[] }> }
}

function find(graph: SceneGraph, root: string, name: string): SceneNode {
  const visit = (id: string): SceneNode | undefined => {
    for (const child of graph.getChildren(id)) {
      if (child.name === name) return child
      const found = visit(child.id)
      if (found) return found
    }
    return undefined
  }
  return expectDefined(visit(root))
}

const firstPage = (graph: SceneGraph) => expectDefined(graph.getPages().at(0)).id

async function reopen(graph: SceneGraph) {
  // Without its archive the export encodes every record, which is what this checks.
  releaseFigPopulationWorker(graph)
  const bytes = await exportFigFile(graph)
  return {
    reopened: await parseFigFile(bytes.slice().buffer),
    records: parseFigBuffer(bytes.slice().buffer).nodeChanges as OverrideRecord[]
  }
}

/** The values a record's overrides give the instances it holds. */
function nestedAssignmentCount(records: OverrideRecord[], name: string): number {
  const record = expectDefined(records.find((item) => item.name === name))
  return (record.symbolData?.symbolOverrides ?? []).filter(
    (override) => (override.componentPropAssignments?.length ?? 0) > 0
  ).length
}

beforeAll(async () => {
  await initCodec()
})

describe('a copy of a component that holds an instance with properties', () => {
  /** A Button with a Label and a Shown icon, held by a Card, and a copy of the Card. */
  function authored(edit: (editor: ReturnType<typeof createEditor>, button: SceneNode) => void) {
    const editor = createEditor()
    const { graph } = editor
    const page = editor.state.currentPageId
    const label = createComponentPropertyId()
    const shown = createComponentPropertyId()
    const button = graph.createNode('COMPONENT', page, {
      name: 'Button',
      componentPropertyDefinitions: [
        { id: label, name: 'Label', type: 'TEXT', defaultValue: 'Continue' },
        { id: shown, name: 'Shown', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    graph.createNode('TEXT', button.id, {
      name: 'Text',
      text: 'Continue',
      componentPropertyReferences: [{ propertyId: label, field: 'TEXT' }]
    })
    graph.createNode('FRAME', button.id, {
      name: 'Icon',
      width: 10,
      height: 10,
      componentPropertyReferences: [{ propertyId: shown, field: 'VISIBLE' }]
    })
    const card = graph.createNode('COMPONENT', page, { name: 'Card', width: 300, height: 200 })
    const action = expectDefined(graph.createInstance(button.id, card.id))
    graph.updateNode(action.id, { name: 'Action', isExposedInstance: true })
    const copy = expectDefined(graph.createInstance(card.id, page))
    copy.name = 'Copy'
    edit(editor, find(graph, copy.id, 'Action'))
    return graph
  }

  function propertyId(graph: SceneGraph, instance: SceneNode, name: string): string {
    return expectDefined(
      componentPropertyDefinitions(graph, instance).find((item) => item.name === name)
    ).id
  }

  test('keeps the text and boolean values the copy gives its Action after reopening', async () => {
    const graph = authored((editor, action) => {
      editor.setInstanceComponentProperty(action.id, propertyId(editor.graph, action, 'Label'), 'Save')
      editor.setInstanceComponentProperty(action.id, propertyId(editor.graph, action, 'Shown'), 'false')
    })
    const { reopened } = await reopen(graph)
    const copy = find(reopened, firstPage(reopened), 'Copy')
    const action = find(reopened, copy.id, 'Action')
    expect(find(reopened, action.id, 'Text').text).toBe('Save')
    expect(find(reopened, action.id, 'Icon').visible).toBe(false)
    expect(action.componentPropertyAssignments).toEqual({
      [propertyId(reopened, action, 'Label')]: 'Save',
      [propertyId(reopened, action, 'Shown')]: 'false'
    })
    // The Card's own Action keeps the Button's defaults.
    const card = find(reopened, firstPage(reopened), 'Card')
    expect(find(reopened, find(reopened, card.id, 'Action').id, 'Text').text).toBe('Continue')
  })

  test('writes no values for a copy that left its Action as it was', async () => {
    const { records } = await reopen(authored(() => undefined))
    expect(nestedAssignmentCount(records, 'Copy')).toBe(0)
  })
})
