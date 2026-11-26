import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, Frame, Instance, Text, property } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from './paints'

export async function createInstanceSizingScene(graph: SceneGraph, parentId: string) {
  const library = graph.addPage('Sizing component')
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      flex: 'col',
      w: 280,
      h: 'hug',
      p: 16,
      bg: '#FFFFFF',
      rounded: 10,
      children: Text({
        name: 'Message',
        w: 'fill',
        font: 'Inter',
        size: 14,
        lineHeight: 20,
        color: '#252A31',
        text: property('Message', 'A short note.')
      })
    }),
    { parentId: library.id }
  )
  const board = await renderTree(
    graph,
    Frame({
      name: 'Instance sizing',
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 32,
      p: 32,
      bg: '#E9E7E2',
      children: [280, 220].map((width) =>
        Frame({
          name: `Container ${width}`,
          flex: 'col',
          w: width,
          h: 'hug',
          gap: 12,
          children: [
            Text({ children: `${width}px container`, font: 'Inter', size: 12, color: '#626975' }),
            Instance({
              of: component.id,
              w: 'fill',
              properties: {
                Message:
                  'The blue feels right. Give the date a little more room at the bottom, and keep the quieter version for the print edition.'
              }
            })
          ]
        })
      )
    }),
    { parentId }
  )
  graph.syncInstances(component.id)
  return { boardId: board.id, componentId: component.id }
}

/** A component's inherited rectangle and a locked layer from outside the instance. */
export function createInstanceResizeScene(graph: SceneGraph, pageId: string) {
  const component = graph.createNode('COMPONENT', pageId, {
    name: 'Card',
    x: 40,
    y: 72,
    width: 120,
    height: 100
  })
  graph.createNode('RECTANGLE', component.id, {
    x: 16,
    y: 16,
    width: 40,
    height: 20,
    fills: [solid(0.33, 0.52, 0.8)]
  })
  const instance = graph.createInstance(component.id, pageId, { x: 216, y: 90 })
  if (!instance) throw new Error('Instance not created')
  const [inherited] = graph.getChildren(instance.id)
  const locked = graph.createNode('RECTANGLE', pageId, {
    name: 'Locked Rectangle',
    x: 350,
    y: 130,
    width: 60,
    height: 55,
    locked: true,
    fills: [solid(0.69, 0.66, 0.88)]
  })
  return { inherited: inherited.id, instance: instance.id, locked: locked.id }
}
