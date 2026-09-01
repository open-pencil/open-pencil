import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('INSTANCE_SWAP component property round trip', () => {
  test('defaultValue, preferredValues, and componentId survive a save/reload cycle', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const iconA = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/A',
      componentKey: 'icon-a-key'
    })
    const iconB = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/B',
      componentKey: 'icon-b-key'
    })
    const button = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      componentPropertyDefinitions: [
        {
          id: 'prop:iconswap01',
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          defaultValue: iconA.id,
          preferredValues: [iconA.id, iconB.id]
        }
      ]
    })
    const slot = graph.createInstance(iconA.id, button.id)
    if (!slot) throw new Error('failed to create slot instance')
    graph.updateNode(slot.id, {
      componentPropertyReferences: [{ propertyId: 'prop:iconswap01', field: 'INSTANCE_SWAP' }],
      componentPropertyAssignments: { 'prop:iconswap01': iconB.id }
    })

    const exported = await exportFigFile(graph)
    const reloaded = await parseFigFile(exported.buffer as ArrayBuffer)

    const reloadedButton = reloaded
      .getAllNodes()
      .find((n) => n.type === 'COMPONENT' && n.name === 'Button')
    expect(reloadedButton).toBeDefined()

    const def = reloadedButton?.componentPropertyDefinitions[0]
    expect(def?.type).toBe('INSTANCE_SWAP')

    const defaultTarget = def?.defaultValue ? reloaded.getNode(def.defaultValue) : undefined
    expect(defaultTarget?.name).toBe('Icon/A')

    const preferredValues = new Set(def?.preferredValues)
    expect(preferredValues).toEqual(new Set(['icon-a-key', 'icon-b-key']))

    const reloadedSlot = reloadedButton ? reloaded.getChildren(reloadedButton.id)[0] : undefined
    expect(reloadedSlot?.type).toBe('INSTANCE')
    const slotComponent = reloadedSlot?.componentId
      ? reloaded.getNode(reloadedSlot.componentId)
      : undefined
    expect(slotComponent?.name).toBe('Icon/A')

    const assignment = reloadedSlot?.componentPropertyAssignments[def?.id ?? '']
    const assignmentTarget = assignment ? reloaded.getNode(assignment) : undefined
    expect(assignmentTarget?.name).toBe('Icon/B')
  })
})
