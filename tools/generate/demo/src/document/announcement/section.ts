import { renderTree } from '@open-pencil/core/design-jsx'
import { Frame, Instance, Text } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { ANNOUNCEMENT_PROPERTIES, createAnnouncementComponent } from './component'
import { EDITING_PROMPT } from './content'
import { createAnnouncementTokens } from './tokens'

export async function createAnnouncementSection(graph: SceneGraph, parentId: string) {
  const tokens = createAnnouncementTokens(graph)
  const label = { font: 'Inter', size: 12, color: '#536487' }
  const root = await renderTree(
    graph,
    Frame({
      name: 'Announcement system',
      flex: 'col',
      w: 'hug',
      h: 'hug',
      gap: 32,
      p: 32,
      bg: '#FFFFFF',
      children: Text({
        font: 'Inter',
        size: 20,
        weight: 600,
        color: '#172554',
        children: 'One announcement. Different spaces.'
      })
    }),
    { parentId }
  )
  const examples = await renderTree(
    graph,
    Frame({ name: 'Linked examples', flex: 'row', w: 'hug', h: 'hug', gap: 32 }),
    { parentId: root.id }
  )
  const sources = await renderTree(
    graph,
    Frame({
      name: 'Editable sources',
      flex: 'col',
      w: 'hug',
      h: 'hug',
      gap: 16,
      children: Text({ ...label, children: 'EDIT THE SOURCES BELOW · WATCH THE EXAMPLES ABOVE' })
    }),
    { parentId: root.id }
  )
  const sourceRow = await renderTree(
    graph,
    Frame({ name: 'Source components', flex: 'row', w: 'hug', h: 'hug', gap: 24 }),
    { parentId: sources.id }
  )
  const graphicSource = await renderTree(
    graph,
    Frame({
      name: 'Shared motif source',
      flex: 'col',
      w: 192,
      h: 'hug',
      gap: 16,
      children: [
        Text({ ...label, color: '#9747FF', children: '01 / SHARED MOTIF' }),
        Text({
          ...label,
          w: 'fill',
          lineHeight: 18,
          children: 'Edit these shapes. Every announcement uses this component.'
        })
      ]
    }),
    { parentId: sourceRow.id }
  )
  const announcementSource = await renderTree(
    graph,
    Frame({
      name: 'Main announcement source',
      flex: 'col',
      w: 600,
      h: 'hug',
      gap: 16,
      children: [
        Text({ ...label, color: '#9747FF', children: '02 / MAIN ANNOUNCEMENT' }),
        Text({
          ...label,
          w: 'fill',
          lineHeight: 18,
          children: 'Edit the headline or description here to update both linked examples.'
        })
      ]
    }),
    { parentId: sourceRow.id }
  )
  const { componentId, graphicId } = await createAnnouncementComponent(
    graph,
    {
      graphicParentId: graphicSource.id,
      componentParentId: announcementSource.id
    },
    tokens
  )
  const instanceIds: string[] = []
  for (const example of [
    { label: 'WIDE / ALL DETAILS', width: 600, showDetails: 'true' },
    { label: 'NARROW / DETAILS HIDDEN', width: 360, showDetails: 'false' }
  ]) {
    const slot = await renderTree(
      graph,
      Frame({
        name: example.label,
        flex: 'col',
        w: example.width,
        h: 'hug',
        gap: 16,
        children: Text({ ...label, children: example.label })
      }),
      { parentId: examples.id }
    )
    const instance = await renderTree(
      graph,
      Instance({
        of: componentId,
        w: 'fill',
        properties: { [ANNOUNCEMENT_PROPERTIES.showDetails.id]: example.showDetails }
      }),
      { parentId: slot.id }
    )
    instanceIds.push(instance.id)
  }
  await renderTree(
    graph,
    Text({
      ...label,
      name: 'Editing instructions',
      w: 900,
      lineHeight: 18,
      children: EDITING_PROMPT
    }),
    { parentId: root.id }
  )
  return { rootId: root.id, componentId, graphicId, instanceIds }
}
