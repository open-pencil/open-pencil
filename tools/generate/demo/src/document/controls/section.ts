import { renderTree } from '@open-pencil/core/design-jsx'
import { Frame, Instance, Text } from '@open-pencil/design-jsx'
import type { TreeNode } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { BUTTON, CHECKBOX, CONTROL_COLORS, SLIDER, SWITCH, TABS, TEXT_FIELD } from './components'

const { ink, muted, line, surface, tile } = CONTROL_COLORS
const ORIGIN = 60
const GAP = 48

const text = (size: number, color: string, children: string, extra: object = {}) =>
  Text({ font: 'Inter', size, color, children, ...extra })

/** A labelled row of the settings card: what the control sets, then the control. */
function settingRow(title: string, caption: string, control: TreeNode): TreeNode {
  return Frame({
    name: title,
    flex: 'row',
    w: 'fill',
    h: 'hug',
    gap: 24,
    items: 'center',
    children: [
      Frame({
        name: 'Label',
        flex: 'col',
        w: 'fill',
        h: 'hug',
        gap: 2,
        children: [text(13, ink, title, { weight: 600 }), text(12, muted, caption, { w: 'fill' })]
      }),
      control
    ]
  })
}

/** Renders one control onto the board and returns its main component or set. */
async function renderControl(graph: SceneGraph, boardId: string, control: TreeNode) {
  const result = await renderTree(graph, control, { parentId: boardId })
  const node = graph.getNode(result.id)
  if (!node) throw new Error('The control did not render')
  return node
}

/** The variant of a set named `name`, or the component itself when it is not a set. */
function variant(graph: SceneGraph, id: string, name: string): string {
  return graph.getChildren(id).find((child) => child.name === name)?.id ?? id
}

/**
 * The Controls page: main components that behave as Reka UI controls, and a settings card
 * built from their instances, which preview runs as live components.
 */
export async function createControlsSection(graph: SceneGraph, pageId: string) {
  const header = await renderTree(
    graph,
    Frame({
      name: 'About this page',
      flex: 'col',
      w: 1056,
      h: 'hug',
      gap: 8,
      children: [
        text(20, ink, 'Components that work.', { weight: 600 }),
        text(
          13,
          muted,
          'Each main component has a behaviour from the Behaviour section: a switch, a slider, tabs, a text field. Press ⌥⌘↩ (View › Preview) and the card on the right runs as real Reka UI components; nothing you do there changes the document.',
          { w: 'fill', lineHeight: 20 }
        )
      ]
    }),
    { parentId: pageId }
  )
  graph.updateNode(header.id, { x: ORIGIN, y: ORIGIN })

  const board = await renderTree(
    graph,
    Frame({
      name: 'Components',
      flex: 'col',
      w: 480,
      h: 'hug',
      gap: 24,
      p: 32,
      rounded: 16,
      bg: tile,
      children: [text(12, muted, 'MAIN COMPONENTS', { weight: 600 })]
    }),
    { parentId: pageId }
  )
  const top = ORIGIN + (graph.getNode(header.id)?.height ?? 0) + GAP
  graph.updateNode(board.id, { x: ORIGIN, y: top })

  const button = await renderControl(graph, board.id, BUTTON)
  const toggle = await renderControl(graph, board.id, SWITCH)
  const checkbox = await renderControl(graph, board.id, CHECKBOX)
  const slider = await renderControl(graph, board.id, SLIDER)
  const field = await renderControl(graph, board.id, TEXT_FIELD)
  const tabs = await renderControl(graph, board.id, TABS)

  const card = await renderTree(
    graph,
    Frame({
      name: 'Account settings',
      flex: 'col',
      w: 520,
      h: 'hug',
      gap: 24,
      p: 32,
      rounded: 16,
      bg: surface,
      stroke: line,
      children: [
        text(18, ink, 'Account settings', { weight: 600 }),
        Instance({ of: tabs.id }),
        settingRow(
          'Email alerts',
          'Hear about mentions and replies.',
          Instance({ of: variant(graph, toggle.id, 'State=On') })
        ),
        settingRow(
          'Weekly digest',
          'A Monday summary of your projects.',
          Instance({ of: variant(graph, checkbox.id, 'Checked=Off') })
        ),
        settingRow('Volume', 'Notification sounds.', Instance({ of: slider.id })),
        settingRow('Email', 'Where alerts go.', Instance({ of: field.id })),
        Instance({ of: variant(graph, button.id, 'Interaction=Default') })
      ]
    }),
    { parentId: pageId }
  )
  graph.updateNode(card.id, { x: ORIGIN + 480 + GAP, y: top })

  return { rootIds: [header.id, board.id, card.id] }
}
