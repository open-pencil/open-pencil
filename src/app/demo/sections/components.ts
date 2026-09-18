import {
  Component,
  ComponentSet,
  Ellipse,
  Frame,
  Instance,
  Rectangle,
  Text,
  linearGradient,
  renderTree
} from '@open-pencil/core/design-jsx'
import type { TreeNode } from '@open-pencil/core/design-jsx'
import type { ComponentPropertyDefinition, SceneGraph, Vector } from '@open-pencil/scene-graph'

import { createArtworkTile, createExampleColumn } from './example'

const INK = '#172554'
const MUTED = '#536487'
const ACCENT = '#4F46E5'
const TILE = '#EEF2FF'
const SURFACE = '#FFFFFF'
const BORDER = '#DCE3F5'

const text = { font: 'Inter', color: INK }
const label = { ...text, size: 12, color: MUTED }
const caption = { ...label, size: 10 }

export const COMPONENT_PROPERTIES = {
  buttonLabel: {
    id: 'demo-button-label',
    name: 'Label',
    type: 'TEXT',
    defaultValue: 'Get started'
  },
  cardTitle: {
    id: 'demo-card-title',
    name: 'Title',
    type: 'TEXT',
    defaultValue: 'Analytics overview'
  },
  cardDescription: {
    id: 'demo-card-description',
    name: 'Description',
    type: 'TEXT',
    defaultValue: 'Track your key metrics and performance indicators in real time.'
  },
  badgeLabel: {
    id: 'demo-badge-label',
    name: 'Label',
    type: 'TEXT',
    defaultValue: 'Live'
  },
  badgeDot: {
    id: 'demo-badge-dot',
    name: 'Show dot',
    type: 'BOOLEAN',
    defaultValue: 'true'
  }
} satisfies Record<string, ComponentPropertyDefinition>

interface ComponentExample {
  title: string
  caption: string
}

const EXAMPLE_GROUPS: readonly { title: string; examples: readonly ComponentExample[] }[] = [
  {
    title: '01 / ACTIONS · ONE BUTTON, TWO VARIANTS',
    examples: [
      { title: 'Primary', caption: 'Filled with the accent variable.' },
      { title: 'Secondary', caption: 'Outline treatment for lower emphasis.' }
    ]
  },
  {
    title: '02 / IDENTITY · AVATAR, BADGE, TAG',
    examples: [
      { title: 'Avatar', caption: 'Gradient identity mark.' },
      { title: 'Badge', caption: 'Status label with a live dot.' },
      { title: 'Tag', caption: 'Quiet category chip.' }
    ]
  },
  {
    title: '03 / SURFACES · CARD AND INPUT',
    examples: [
      { title: 'Card', caption: 'Titled surface with a progress bar.' },
      { title: 'Input', caption: 'Search field with a placeholder.' }
    ]
  }
]

export async function createComponentsSection(
  graph: SceneGraph,
  parentId: string,
  options: Partial<Vector> = {}
) {
  const root = await renderTree(
    graph,
    Frame({
      name: 'Components',
      flex: 'col',
      w: 1056,
      h: 'hug',
      p: 32,
      gap: 32,
      bg: SURFACE,
      children: [
        Text({
          ...text,
          size: 20,
          weight: 600,
          children: 'One library. Every screen stays in sync.'
        })
      ]
    }),
    { parentId, ...options }
  )

  // Instance slots come first so the sources below can fill them afterwards.
  const slots: Record<string, string> = {}
  for (const group of EXAMPLE_GROUPS) {
    const groupFrame = await renderTree(
      graph,
      Frame({
        name: group.title,
        flex: 'col',
        w: 'fill',
        h: 'hug',
        gap: 16,
        children: [Text({ ...label, children: group.title })]
      }),
      { parentId: root.id }
    )
    const row = await renderTree(
      graph,
      Frame({ name: 'Linked instances', flex: 'row', w: 'fill', h: 'hug', gap: 24 }),
      { parentId: groupFrame.id }
    )
    for (const example of group.examples) {
      const column = await renderTree(
        graph,
        createExampleColumn({
          title: example.title,
          caption: example.caption,
          artwork: createArtworkTile(`${example.title} / artwork`, { padding: 24, center: true })
        }),
        { parentId: row.id }
      )
      const artworkId = graph.getNode(column.id)?.childIds[0]
      if (!artworkId) throw new Error(`Missing component example artwork for ${example.title}`)
      slots[example.title] = artworkId
    }
  }

  const sources = await renderTree(
    graph,
    Frame({
      name: '04 / SOURCES · EDIT THESE TO UPDATE EVERY EXAMPLE',
      flex: 'col',
      w: 'fill',
      h: 'hug',
      gap: 16,
      children: [Text({ ...label, children: '04 / SOURCES · EDIT THESE TO UPDATE EVERY EXAMPLE' })]
    }),
    { parentId: root.id }
  )
  const sourceRow = async (name: string) => {
    const row = await renderTree(
      graph,
      Frame({ name, flex: 'row', w: 'fill', h: 'hug', gap: 24, items: 'start' }),
      { parentId: sources.id }
    )
    return row.id
  }
  const controlsRow = await sourceRow('Component sources / controls')
  const surfacesRow = await sourceRow('Component sources / identity and surfaces')
  const sourceTile = async (name: string, hint: string, rowId: string) => {
    const tile = await renderTree(
      graph,
      Frame({
        name,
        flex: 'col',
        w: 'fill',
        h: 'hug',
        p: 20,
        gap: 12,
        items: 'center',
        rounded: 12,
        bg: TILE,
        children: [
          Frame({
            name: `${name} / source`,
            flex: 'row',
            w: 'fill',
            h: 'hug',
            p: 16,
            justify: 'center',
            items: 'center'
          }),
          Text({ ...caption, children: hint })
        ]
      }),
      { parentId: rowId }
    )
    const artworkId = graph.getNode(tile.id)?.childIds[0]
    if (!artworkId) throw new Error(`Missing source artwork for ${name}`)
    return artworkId
  }

  const buttonVariant = (variant: string, fill: string, color: string, outline: boolean) =>
    Component({
      name: `Variant=${variant}`,
      properties: [COMPONENT_PROPERTIES.buttonLabel],
      flex: 'row',
      px: 20,
      py: 10,
      rounded: 8,
      justify: 'center',
      items: 'center',
      bg: fill,
      stroke: outline ? BORDER : undefined,
      strokeWidth: outline ? 1 : undefined,
      children: [
        Text({
          ...text,
          name: 'Label',
          size: 14,
          weight: 600,
          color,
          children: COMPONENT_PROPERTIES.buttonLabel.defaultValue,
          propertyRefs: [{ propertyId: COMPONENT_PROPERTIES.buttonLabel.id, field: 'TEXT' }]
        })
      ]
    })
  const buttonSet = await renderTree(
    graph,
    ComponentSet({
      name: 'Button',
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 16,
      children: [
        buttonVariant('Primary', ACCENT, SURFACE, false),
        buttonVariant('Secondary', SURFACE, INK, true)
      ]
    }),
    { parentId: await sourceTile('Button variants', 'Two variants of one set.', controlsRow) }
  )
  const variantIds = graph.getNode(buttonSet.id)?.childIds ?? []

  const avatar = await renderTree(
    graph,
    Component({
      name: 'Avatar',
      flex: 'row',
      w: 48,
      h: 48,
      justify: 'center',
      items: 'center',
      rounded: 24,
      fills: [
        linearGradient([
          ['#7C3AED', 0],
          ['#3B82F6', 1]
        ])
      ]
    }),
    { parentId: await sourceTile('Avatar', 'Gradient identity mark.', controlsRow) }
  )

  const badge = await renderTree(
    graph,
    Component({
      name: 'Badge',
      properties: [COMPONENT_PROPERTIES.badgeDot, COMPONENT_PROPERTIES.badgeLabel],
      flex: 'row',
      gap: 4,
      px: 8,
      py: 4,
      rounded: 12,
      justify: 'center',
      items: 'center',
      bg: '#ECFDF5',
      children: [
        Ellipse({
          name: 'Dot',
          w: 6,
          h: 6,
          bg: '#22C55E',
          propertyRefs: [{ propertyId: COMPONENT_PROPERTIES.badgeDot.id, field: 'VISIBLE' }]
        }),
        Text({
          ...text,
          name: 'Label',
          size: 11,
          weight: 600,
          color: '#16A34A',
          children: COMPONENT_PROPERTIES.badgeLabel.defaultValue,
          propertyRefs: [{ propertyId: COMPONENT_PROPERTIES.badgeLabel.id, field: 'TEXT' }]
        })
      ]
    }),
    { parentId: await sourceTile('Badge', 'Label plus a toggleable dot.', controlsRow) }
  )

  const tag = await renderTree(
    graph,
    Component({
      name: 'Tag',
      flex: 'row',
      px: 12,
      py: 4,
      rounded: 14,
      justify: 'center',
      items: 'center',
      bg: TILE,
      children: [Text({ ...text, size: 12, weight: 500, color: ACCENT, children: 'Design' })]
    }),
    { parentId: await sourceTile('Tag', 'Quiet category chip.', surfacesRow) }
  )

  const card = await renderTree(
    graph,
    Component({
      name: 'Card',
      properties: [COMPONENT_PROPERTIES.cardTitle, COMPONENT_PROPERTIES.cardDescription],
      flex: 'col',
      w: 280,
      h: 'hug',
      p: 20,
      gap: 8,
      rounded: 12,
      bg: SURFACE,
      stroke: BORDER,
      strokeWidth: 1,
      children: [
        Text({
          ...text,
          name: 'Title',
          w: 'fill',
          size: 16,
          weight: 600,
          children: COMPONENT_PROPERTIES.cardTitle.defaultValue,
          propertyRefs: [{ propertyId: COMPONENT_PROPERTIES.cardTitle.id, field: 'TEXT' }]
        }),
        Text({
          ...text,
          name: 'Description',
          w: 'fill',
          size: 13,
          lineHeight: 18,
          color: MUTED,
          children: COMPONENT_PROPERTIES.cardDescription.defaultValue,
          propertyRefs: [{ propertyId: COMPONENT_PROPERTIES.cardDescription.id, field: 'TEXT' }]
        }),
        Rectangle({ name: 'Progress track', w: 'fill', h: 8, rounded: 4, bg: '#EEF0F6' }),
        Rectangle({
          name: 'Progress',
          w: 168,
          h: 8,
          rounded: 4,
          fills: [
            linearGradient([
              ['#3B82F6', 0],
              ['#14B8A6', 1]
            ])
          ]
        })
      ]
    }),
    { parentId: await sourceTile('Card', 'Titled surface with progress.', surfacesRow) }
  )

  const input = await renderTree(
    graph,
    Component({
      name: 'Input',
      flex: 'row',
      w: 240,
      px: 12,
      py: 10,
      rounded: 8,
      items: 'center',
      bg: SURFACE,
      stroke: BORDER,
      strokeWidth: 1,
      children: [
        Text({
          ...text,
          name: 'Placeholder',
          w: 'fill',
          size: 14,
          color: MUTED,
          children: 'Search…'
        })
      ]
    }),
    { parentId: await sourceTile('Input', 'Search field with placeholder.', surfacesRow) }
  )

  const place = async (name: string, node: TreeNode) => {
    const artworkId = slots[name]
    if (!artworkId) throw new Error(`Missing component example slot for ${name}`)
    return renderTree(graph, node, { parentId: artworkId })
  }

  const primaryId = variantIds[0]
  const secondaryId = variantIds[1]
  if (!primaryId || !secondaryId) throw new Error('Button variants were not created')
  await place('Primary', Instance({ of: primaryId }))
  await place(
    'Secondary',
    Instance({
      of: secondaryId,
      properties: { [COMPONENT_PROPERTIES.buttonLabel.id]: 'Cancel' }
    })
  )
  await place('Avatar', Instance({ of: avatar.id }))
  await place(
    'Badge',
    Instance({
      of: badge.id,
      properties: { [COMPONENT_PROPERTIES.badgeLabel.id]: 'Live' }
    })
  )
  await place('Tag', Instance({ of: tag.id }))
  await place(
    'Card',
    Instance({
      of: card.id,
      properties: {
        [COMPONENT_PROPERTIES.cardTitle.id]: 'Analytics overview',
        [COMPONENT_PROPERTIES.cardDescription.id]: 'Every value here is a component property.'
      }
    })
  )
  await place('Input', Instance({ of: input.id }))

  await renderTree(
    graph,
    Text({
      ...label,
      w: 'fill',
      lineHeight: 18,
      children:
        'Edit any source below and every linked instance above updates. Text and visibility stay editable per instance.'
    }),
    { parentId: root.id }
  )

  return { rootId: root.id }
}
