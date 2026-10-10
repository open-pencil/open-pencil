import { describe, expect, test } from 'bun:test'

import { createMoveHarness } from './harness'

// Orders from Figma desktop 126, which reorders auto layout children while they are dragged:
// rows of four 60 × 40 layers with padding and gap 10, dragged along the row.
function rows(count = 1) {
  const harness = createMoveHarness()
  const { editor, page, node } = harness
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frames = Array.from({ length: count }, (_, r) => {
    const frame = node('FRAME', page, {
      y: r * 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 10,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 10,
      paddingBottom: 10
    })
    for (const name of 'ABCD') node('RECTANGLE', frame.id, { name: `${name}${r}`, width: 60, height: 40 })
    editor.runLayoutForNode(frame.id)
    return frame
  })
  const named = (name: string) => {
    const found = [...editor.graph.getAllNodes()].find((n) => n.name === name)
    if (!found) throw new Error(`no ${name}`)
    return found
  }
  const order = () =>
    frames.map((f) => f.childIds.map((id) => editor.graph.getNode(id)?.name).join(' ')).join(' | ')
  /** Drags the selection by `dx` along the row from the centre of `grab`. */
  const dragBy = (picks: string[], grab: string, dx: number) => {
    const at = editor.graph.getAbsolutePosition(named(grab).id)
    const from: [number, number] = [at.x + 30, at.y + 20]
    harness.drag(
      picks.map((p) => named(p).id),
      from,
      [from[0] + dx, from[1]]
    )
  }
  return { editor, order, dragBy }
}

describe('dragging along an auto layout row', () => {
  test('a layer passes the next once its leading edge reaches that layer’s centre', () => {
    for (const [dx, expected] of [
      [40, 'A0 B0 C0 D0'],
      [45, 'A0 C0 B0 D0'],
      [110, 'A0 C0 B0 D0'],
      [115, 'A0 C0 D0 B0']
    ] as const) {
      const { order, dragBy } = rows()
      dragBy(['B0'], 'B0', dx)
      expect(order()).toBe(expected)
    }
  })

  test('several selected layers move as one block, wherever they are grabbed', () => {
    for (const [picks, grab, dx, expected] of [
      [['A0', 'C0'], 'A0', 45, 'B0 A0 C0 D0'],
      [['A0', 'C0'], 'C0', 115, 'B0 D0 A0 C0'],
      [['B0', 'D0'], 'B0', -45, 'B0 D0 A0 C0'],
      [['A0', 'D0'], 'A0', 100, 'B0 A0 D0 C0'],
      // The block cannot pass the start, so the layers keep their order.
      [['A0', 'D0'], 'D0', -150, 'A0 B0 C0 D0']
    ] as const) {
      const { editor, order, dragBy } = rows()
      dragBy([...picks], grab, dx)
      expect(order()).toBe(expected)
      editor.undoAction()
      expect(order()).toBe('A0 B0 C0 D0')
    }
  })

  test('layers selected in two rows each move along their own row', () => {
    const { order, dragBy } = rows(2)
    dragBy(['B0', 'B1'], 'B0', 120)
    expect(order()).toBe('A0 C0 D0 B0 | A1 C1 D1 B1')
  })
})
