import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  type BehaviourKind,
  type Fill,
  type SceneNode
} from '@open-pencil/scene-graph'

const fill: Fill = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1, visible: true }

type Layer = { name: string; x?: number; y?: number; width: number; height: number; children?: Layer[] }

/**
 * A main component built from frames, each top-level frame made a slot and bound to the part of
 * the same lowercase name, with an instance at (300, 100).
 */
async function control(kind: BehaviourKind, layers: Layer[]) {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', pageId, {
    name: kind,
    width: 200,
    height: 40
  })
  const build = (parent: SceneNode, layer: Layer): SceneNode => {
    const { children = [], ...props } = layer
    const node = editor.graph.createNode('FRAME', parent.id, { ...props, fills: [fill] })
    for (const child of children) build(node, child)
    return node
  }
  const parts: Record<string, string> = {}
  for (const layer of layers) {
    const id = editor.convertToSlot(build(component, layer).id)
    if (id) parts[layer.name.toLowerCase()] = id
  }
  editor.setBehaviour(component.id, { ...emptyBehaviour(kind), parts })
  const instance = editor.graph.createInstance(component.id, pageId, { x: 300, y: 100 })
  if (!instance) throw new Error('No instance')
  // Component sync reaches the instance on a microtask.
  await Promise.resolve()
  editor.startPlay()
  const copied = (name: string) => {
    const graph = editor.state.play?.substitutes.get(instance.id)?.graph
    if (!graph) return undefined
    const find = (node: SceneNode): SceneNode | undefined =>
      node.name === name ? node : graph.getChildren(node.id).map(find).find(Boolean)
    const root = graph.getNode(instance.id)
    return root && find(root)
  }
  return { editor, instance, copied }
}

describe('preview interactions', () => {
  test('a slider jumps to a press on the track and follows a drag', async () => {
    const { editor, copied } = await control('slider', [
      { name: 'Track', width: 200, height: 8 },
      { name: 'Range', width: 0, height: 8 },
      { name: 'Thumb', width: 20, height: 20 }
    ])

    // The thumb's centre travels from 310 to 490 across the 200-wide track.
    expect(editor.playPointerDown(400, 104)).toBe(true)
    expect(copied('Thumb')?.x).toBe(90)
    expect(copied('Range')?.width).toBe(100)

    editor.playPointerMove(600, 104)
    expect(copied('Thumb')?.x).toBe(180)
    editor.playPointerUp()
    editor.playPointerMove(310, 104)
    expect(copied('Thumb')?.x).toBe(180)

    // The press focused the slider: arrows step it, Shift by ten steps, Home to the start.
    expect(editor.playKey('ArrowLeft')).toBe(true)
    expect(copied('Thumb')?.x).toBeCloseTo(178.2)
    editor.playKey('ArrowLeft', true)
    expect(copied('Thumb')?.x).toBeCloseTo(160.2)
    editor.playKey('Home')
    expect(copied('Thumb')?.x).toBe(0)
  })

  test('pressing a tab trigger shows the content at the same position', async () => {
    const { editor, copied } = await control('tabs', [
      {
        name: 'Trigger',
        width: 100,
        height: 20,
        children: [
          { name: 'First', width: 40, height: 20 },
          { name: 'Second', x: 50, width: 40, height: 20 }
        ]
      },
      {
        name: 'Content',
        y: 20,
        width: 100,
        height: 20,
        children: [
          { name: 'First panel', width: 100, height: 20 },
          { name: 'Second panel', width: 100, height: 20 }
        ]
      }
    ])

    expect(editor.playPointerDown(360, 110)).toBe(true)
    expect(copied('First panel')?.visible).toBe(false)
    expect(copied('Second panel')?.visible).toBe(true)

    // Arrows move along the tabs and wrap around.
    expect(editor.playKey('ArrowRight')).toBe(true)
    expect(copied('First panel')?.visible).toBe(true)
    expect(copied('Second panel')?.visible).toBe(false)
    editor.playKey('ArrowLeft')
    expect(copied('Second panel')?.visible).toBe(true)
  })
})
