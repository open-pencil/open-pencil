/** @jsxImportSource @open-pencil/design-jsx */
/**
 * The tour's callout: one card per page with a step number, what to try, and the shortcut.
 * It is a component with text properties, so its instances are the first thing a visitor who
 * clicks one sees in the panel.
 */
import { Component, Frame, Instance, Text, property, type TreeNode } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { createComponentPropertyId } from '@open-pencil/scene-graph/components'
import { createSlotProperty, updateSlotProperty } from '@open-pencil/scene-graph/slots'

import { previewButton } from './chrome'
import { renderTree } from './icons'
import type { Theme } from './theme'

export const TIP_PROPERTIES = {
  step: property('Step', '1'),
  title: property('Title', 'Try this'),
  body: property('Body', 'Select something on the canvas and look at the panel on the right.'),
  keys: property('Shortcut', '⌥ ⌘ ↩'),
  showKeys: property('Show shortcut', true)
}

export const TIP_WIDTH = 320
/** The slot a tip shows where to click in: a piece of the app's chrome with the target ringed. */
export const WHERE_SLOT_NAME = 'Where'

/** The Tip main component on the page, with its Where slot defined. */
export async function createTipComponent(
  graph: SceneGraph,
  theme: Theme,
  pageId: string
): Promise<{ id: string; whereSlotId: string }> {
  const { id } = await renderTree(graph, tipComponent(theme), { parentId: pageId, x: 0, y: 0 })
  const where = graph.getChildren(id).find((child) => child.name === WHERE_SLOT_NAME)
  const whereSlotId = createComponentPropertyId()
  if (!where || !createSlotProperty(graph, where.id, whereSlotId)) {
    throw new Error('The tip has no Where frame to make a slot of')
  }
  updateSlotProperty(graph, id, whereSlotId, {
    description: 'Where to click: a piece of the app with the target ringed.',
    slotSettings: { maxChildren: 1 }
  })
  return { id, whereSlotId }
}

function tipComponent(theme: Theme): TreeNode {
  const { vars } = theme
  return (
    <Component
      name="Tip"
      flex="col"
      w={TIP_WIDTH}
      h="hug"
      p={20}
      gap={12}
      rounded={16}
      bg={vars.surface}
      stroke={vars.line}
    >
      <Frame name="Heading" flex="row" w="fill" h="hug" gap={12} items="center">
        <Frame
          name="Step"
          flex="row"
          w={28}
          h={28}
          rounded={14}
          justify="center"
          items="center"
          bg={vars.accent}
        >
          <Text
            name="Number"
            font="Inter"
            size={13}
            weight={700}
            color={vars.onAccent}
            text={TIP_PROPERTIES.step}
          />
        </Frame>
        <Text
          name="Title"
          font="Inter"
          size={15}
          weight={600}
          color={vars.text}
          text={TIP_PROPERTIES.title}
        />
      </Frame>
      <Text
        name="Body"
        font="Inter"
        size={13}
        lineHeight={20}
        w="fill"
        color={vars.muted}
        text={TIP_PROPERTIES.body}
      />
      <Frame name={WHERE_SLOT_NAME} flex="col" w="fill" h="hug" items="start">
        {previewButton(theme)}
      </Frame>
      <Frame
        name="Shortcut"
        flex="row"
        w="hug"
        h="hug"
        px={10}
        py={6}
        rounded={8}
        bg={vars.raised}
        visible={TIP_PROPERTIES.showKeys}
      >
        <Text
          name="Keys"
          font="Inter"
          size={12}
          weight={600}
          color={vars.text}
          text={TIP_PROPERTIES.keys}
        />
      </Frame>
    </Component>
  )
}

export interface Tip {
  step: number
  title: string
  body: string
  /** The shortcut to show, if the step has one. */
  keys?: string
  /** The piece of the app to show in the Where slot, with its target ringed. */
  where?: TreeNode
}

export function tipInstance(componentId: string, tip: Tip): TreeNode {
  return (
    <Instance
      of={componentId}
      name={`Tip ${tip.step}`}
      properties={{
        [TIP_PROPERTIES.step.name]: String(tip.step),
        [TIP_PROPERTIES.title.name]: tip.title,
        [TIP_PROPERTIES.body.name]: tip.body,
        [TIP_PROPERTIES.keys.name]: tip.keys ?? '',
        [TIP_PROPERTIES.showKeys.name]: tip.keys ? 'true' : 'false'
      }}
    />
  )
}
