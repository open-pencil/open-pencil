import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  createEditor,
  type Editor,
  type PenPressEvent,
  type PenReleaseEvent
} from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

let editor: Editor

beforeEach(() => {
  editor = createEditor()
  editor.setTool('PEN')
})

afterEach(() => editor.dispose())

const points = () => editor.state.penState?.vertices.map(({ x, y }) => [x, y]) ?? null
const vectors = () =>
  editor.graph.getChildren(editor.state.currentPageId).filter((node) => node.type === 'VECTOR')

/** Presses and releases the pen as the canvas does, with a drag in between if given. */
function click(x: number, y: number, drag?: [number, number]) {
  const pressed = editor.penPress({ x, y })
  if (pressed && drag) editor.penSetDragTangent(...drag)
  editor.penRelease()
  return pressed
}

function listen() {
  const pressed: PenPressEvent[] = []
  const released: PenReleaseEvent[] = []
  editor.onEditorEvent('pen:pressed', (event) => pressed.push(event))
  editor.onEditorEvent('pen:released', (event) => released.push(event))
  return { pressed, released }
}

describe('pen gestures', () => {
  test('say what each press does, where, before it acts', () => {
    const { pressed } = listen()
    let seen: unknown = 'unset'
    editor.onEditorEvent('pen:pressed', () => (seen = points()))
    click(0, 0)
    expect(seen).toBeNull()
    click(100, 0)
    click(100, 2)
    click(1, 1)
    expect(pressed.map(({ at, kind }) => [kind, at.x, at.y])).toEqual([
      ['start', 0, 0],
      ['point', 100, 0],
      ['redo-handle', 100, 0],
      ['close', 0, 0]
    ])
  })

  test('a refused press does nothing and leaves no step', () => {
    click(0, 0)
    editor.onEditorEvent('pen:pressed', ({ kind }) => {
      if (kind === 'point') editor.cancelGesture()
    })
    expect(click(50, 50)).toBeNull()
    expect(points()).toEqual([[0, 0]])
    editor.undoAction()
    expect(editor.state.penState).toBeNull()
  })

  test('a release says which segment it finished; refused, the point goes back and redo stays', () => {
    const { released } = listen()
    click(0, 0)
    click(100, 0)
    editor.undoAction()
    editor.onEditorEvent('pen:released', ({ kind }) => {
      if (kind === 'point') editor.cancelGesture()
    })
    click(0, 100, [20, 0])

    expect(released.at(-1)).toEqual({
      kind: 'point',
      at: { x: 0, y: 100 },
      segment: {
        p0: { x: 0, y: 0 },
        cp1: { x: 0, y: 0 },
        cp2: { x: -20, y: 100 },
        p3: { x: 0, y: 100 }
      }
    })
    expect(points()).toEqual([[0, 0]])
    editor.redoAction()
    expect(points()).toEqual([
      [0, 0],
      [100, 0]
    ])
  })

  test('a close says which segment closes the path, and closes it unless refused', () => {
    const { released } = listen()
    click(0, 0)
    click(100, 0)
    click(100, 100)
    let refuse = true
    editor.onEditorEvent('pen:released', ({ kind }) => {
      if (kind === 'close' && refuse) editor.cancelGesture()
    })
    click(0, 0, [0, -30])
    expect(released.at(-1)).toMatchObject({
      kind: 'close',
      segment: { p0: { x: 100, y: 100 }, p3: { x: 0, y: 0 }, cp2: { x: 0, y: 30 } }
    })
    expect(vectors()).toHaveLength(0)
    expect(points()).toHaveLength(3)

    refuse = false
    click(0, 0)
    expect(vectors()).toHaveLength(1)
    expect(editor.state.penState).toBeNull()
  })
})

describe('snap targets', () => {
  test('a host sets them, and replacing the document clears them', () => {
    editor.setSnapTargets({ points: [{ x: 10, y: 20 }] })
    expect(editor.state.snapTargets.points).toEqual([{ x: 10, y: 20 }])
    editor.replaceGraph(new SceneGraph())
    expect(editor.state.snapTargets.points).toEqual([])
  })
})

describe('cancelling a vector edit change', () => {
  test('puts the path back as the change started and tells the canvas', () => {
    const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      width: 100,
      height: 1,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    let cancelled = 0
    editor.onEditorEvent('gesture:cancelled', () => cancelled++)
    editor.setTool('SELECT')
    editor.enterNodeEditMode(path.id)
    editor.nodeEditPushHistory()
    editor.nodeEditSetHandle(0, 'tangentStart', { x: 30, y: 40 })
    editor.cancelGesture()
    expect(editor.getNodeEditState()?.segments[0]?.tangentStart).toEqual({ x: 0, y: 0 })
    expect(cancelled).toBe(1)
  })
})
