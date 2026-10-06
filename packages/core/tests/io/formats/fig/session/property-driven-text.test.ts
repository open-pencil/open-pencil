import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession, materializeFigArchive } from '@open-pencil/fig'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

/**
 * The component lives on one page and the instance that assigns its properties on another, so
 * loading the second page alone has to interpret the assignments and keep them: the resumed
 * load synchronises each component it places, which used to reset them to the defaults.
 */
async function archiveWithCrossPageAssignment() {
  const source = new SceneGraph()
  const library = source.getPages()[0]
  source.updateNode(library.id, { name: 'Library' })
  const iconA = source.createNode('COMPONENT', library.id, { name: 'IconA' })
  const iconB = source.createNode('COMPONENT', library.id, { name: 'IconB' })
  const item = source.createNode('COMPONENT', library.id, {
    name: 'NavItem',
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
      { id: '207:2', name: 'Badge', type: 'BOOLEAN', defaultValue: 'true' },
      { id: '207:3', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: iconA.id }
    ]
  })
  source.createNode('TEXT', item.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '207:1', field: 'TEXT' }]
  })
  source.createNode('RECTANGLE', item.id, {
    name: 'Badge',
    visible: true,
    componentPropertyReferences: [{ propertyId: '207:2', field: 'VISIBLE' }]
  })
  const icon = expectDefined(source.createInstance(iconA.id, item.id), 'icon')
  source.updateNode(icon.id, {
    name: 'Icon',
    componentPropertyReferences: [{ propertyId: '207:3', field: 'INSTANCE_SWAP' }]
  })
  const page = source.addPage('Dashboard')
  const instance = expectDefined(source.createInstance(item.id, page.id), 'instance')
  source.updateNode(instance.id, {
    componentPropertyAssignments: { '207:1': 'Assigned', '207:2': 'false', '207:3': iconB.id }
  })
  const bytes = await exportFigFile(source)
  return { archive: bytes.buffer as ArrayBuffer, swappedTo: iconB.name }
}

function childNamed(graph: SceneGraph, parent: SceneNode, name: string): SceneNode {
  const child = graph.getChildren(parent.id).find((candidate) => candidate.name === name)
  if (!child) throw new Error(`Missing child ${name}`)
  return child
}

/**
 * What the three property-driven fields read as on the placed instance. The swapped child is
 * found by type, because a whole-document read renames it after the component it swapped to.
 */
function drivenFields(graph: SceneGraph) {
  const page = graph.getPages().find((candidate) => candidate.name === 'Dashboard')
  if (!page) throw new Error('Missing page')
  const instance = graph.getChildren(page.id)[0]
  const icon = graph.getChildren(instance.id).find((child) => child.type === 'INSTANCE')
  if (!icon) throw new Error('Missing swapped child')
  return {
    text: childNamed(graph, instance, 'Label').text,
    visible: childNamed(graph, instance, 'Badge').visible,
    swappedTo: icon.componentId ? graph.getNode(icon.componentId)?.name : undefined
  }
}

test('a page loaded on its own keeps the fields its instance assigns', async () => {
  await initCodec()
  const { archive, swappedTo } = await archiveWithCrossPageAssignment()
  const session = createFigDocumentSession(archive)
  const placed = session.pages.find((page) => page.name === 'Dashboard')
  if (!placed) throw new Error('Missing source page')
  session.loadPage(placed.id)
  expect(drivenFields(session.graph)).toEqual({ text: 'Assigned', visible: false, swappedTo })
})

test('the whole document reads the same fields', async () => {
  await initCodec()
  const { archive, swappedTo } = await archiveWithCrossPageAssignment()
  const { graph } = materializeFigArchive(archive)
  expect(drivenFields(graph)).toEqual({ text: 'Assigned', visible: false, swappedTo })
})
