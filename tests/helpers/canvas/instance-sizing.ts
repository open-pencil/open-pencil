import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, Frame, Instance, Text, property } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

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
