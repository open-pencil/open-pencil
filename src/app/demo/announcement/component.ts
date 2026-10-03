import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, Frame, Instance, Rectangle, Text } from '@open-pencil/design-jsx'
import type { ComponentPropertyDefinition, SceneGraph } from '@open-pencil/scene-graph'

import { ANNOUNCEMENT } from './content'
import type { AnnouncementTokens } from './tokens'

export const ANNOUNCEMENT_PROPERTIES = {
  title: {
    id: 'announcement-title',
    name: 'Headline',
    type: 'TEXT',
    defaultValue: ANNOUNCEMENT.title
  },
  description: {
    id: 'announcement-description',
    name: 'Description',
    type: 'TEXT',
    defaultValue: ANNOUNCEMENT.description
  },
  details: {
    id: 'announcement-details',
    name: 'Details',
    type: 'TEXT',
    defaultValue: ANNOUNCEMENT.details
  },
  showDetails: {
    id: 'announcement-show-details',
    name: 'Show details',
    type: 'BOOLEAN',
    defaultValue: 'true'
  }
} satisfies Record<string, ComponentPropertyDefinition>

interface AnnouncementSourceParents {
  graphicParentId: string
  componentParentId: string
}

export async function createAnnouncementComponent(
  graph: SceneGraph,
  parents: AnnouncementSourceParents,
  tokens: AnnouncementTokens
) {
  const graphic = await renderTree(
    graph,
    Component({
      name: 'Announcement / motif',
      grid: true,
      columns: '1fr 1fr',
      rows: '1fr 1fr',
      gap: 6,
      w: 56,
      h: 56,
      children: [1, 0.35, 0.35, 1].map((opacity) =>
        Rectangle({ w: 'fill', h: 'fill', rounded: 3, bg: tokens.accent, opacity })
      )
    }),
    { parentId: parents.graphicParentId }
  )
  const text = { font: 'Inter', color: tokens.ink }
  const component = await renderTree(
    graph,
    Component({
      name: 'Announcement',
      properties: Object.values(ANNOUNCEMENT_PROPERTIES),
      flex: 'row',
      w: 600,
      h: 'hug',
      p: tokens.padding,
      gap: tokens.padding,
      bg: tokens.surface,
      rounded: 16,
      children: [
        Instance({ name: 'Shared motif', of: graphic.id }),
        Frame({
          name: 'Content',
          flex: 'col',
          w: 'fill',
          h: 'hug',
          gap: tokens.gap,
          children: [
            Text({
              ...text,
              name: 'Headline',
              w: 'fill',
              size: 28,
              weight: 600,
              children: ANNOUNCEMENT.title,
              propertyRefs: [{ propertyId: ANNOUNCEMENT_PROPERTIES.title.id, field: 'TEXT' }]
            }),
            Text({
              ...text,
              name: 'Description',
              w: 'fill',
              size: 14,
              lineHeight: 22,
              children: ANNOUNCEMENT.description,
              propertyRefs: [{ propertyId: ANNOUNCEMENT_PROPERTIES.description.id, field: 'TEXT' }]
            }),
            Text({
              ...text,
              name: 'Details',
              w: 'fill',
              size: 10,
              lineHeight: 16,
              color: tokens.muted,
              children: ANNOUNCEMENT.details,
              propertyRefs: [
                { propertyId: ANNOUNCEMENT_PROPERTIES.details.id, field: 'TEXT' },
                { propertyId: ANNOUNCEMENT_PROPERTIES.showDetails.id, field: 'VISIBLE' }
              ]
            })
          ]
        })
      ]
    }),
    { parentId: parents.componentParentId }
  )
  return { componentId: component.id, graphicId: graphic.id }
}
