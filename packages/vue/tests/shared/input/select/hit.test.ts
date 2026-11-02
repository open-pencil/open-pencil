import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleSelectDown, type HitTestFns } from '#vue/shared/input/select'
import { resolveHit } from '#vue/shared/input/select/hit'
import type { DragState } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

function labelHits(
  hits: Partial<Record<'frame' | 'section' | 'component', SceneNode>>
): HitTestFns {
  return {
    hitTestLayer: () => null,
    hitTestFrameTitle: () => hits.frame ?? null,
    hitTestSectionTitle: () => hits.section ?? null,
    hitTestComponentLabel: () => hits.component ?? null
  }
}

describe('label hits', () => {
  test('a press on overlapping labels picks the one drawn on top', () => {
    editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { name: 'Frame' })
    const section = editor.graph.createNode('SECTION', pageId, { name: 'Section' })
    const component = editor.graph.createNode('COMPONENT', pageId, { name: 'Button' })

    // Labels are drawn frames, then sections, then components.
    expect(resolveHit(0, 0, labelHits({ frame, section, component }))?.id).toBe(component.id)
    expect(resolveHit(0, 0, labelHits({ frame, section }))?.id).toBe(section.id)
    expect(resolveHit(0, 0, labelHits({ frame }))?.id).toBe(frame.id)
  })
})

const press = { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false } as MouseEvent

/**
 * A section holding a top-level auto layout frame of two rows of cards, each a swatch over a
 * label, as the shadcn kit lays its colours out. Presses resolve against the graph from the page.
 */
function swatchRows() {
  editor = createEditor()
  const pageId = editor.state.currentPageId
  const section = editor.graph.createNode('SECTION', pageId, {
    name: 'Light',
    width: 800,
    height: 300
  })
  const rows = editor.graph.createNode('FRAME', section.id, {
    name: 'Rows',
    x: 40,
    y: 40,
    width: 700,
    height: 180,
    layoutMode: 'VERTICAL',
    fills: []
  })
  const card = (row: SceneNode, index: number) => {
    const frame = editor.graph.createNode('FRAME', row.id, {
      name: `${row.name} card ${index}`,
      x: index * 140,
      width: 120,
      height: 80,
      layoutMode: 'VERTICAL',
      fills: []
    })
    const swatch = editor.graph.createNode('RECTANGLE', frame.id, {
      name: `${frame.name} swatch`,
      width: 120,
      height: 60
    })
    return { frame, swatch }
  }
  const row = (index: number) =>
    editor.graph.createNode('FRAME', rows.id, {
      name: `Row ${index}`,
      y: (index - 1) * 100,
      width: 700,
      height: 80,
      layoutMode: 'HORIZONTAL',
      fills: []
    })
  const row1 = row(1)
  const row2 = row(2)
  const first = card(row1, 0)
  const second = card(row1, 1)
  const below = card(row2, 2)
  const fns: HitTestFns = {
    hitTestLayer: (cx, cy, deep) =>
      deep
        ? editor.graph.hitTestDeep(cx, cy, pageId)
        : editor.graph.hitTestSelectable(cx, cy, pageId, editor.state.selectedIds),
    hitTestFrameTitle: () => null,
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }
  const pressAt = (x: number, y: number) => {
    let drag: DragState | null = null
    handleSelectDown(press, x, y, x, y, editor, fns, () => false, () => false, (next) => {
      drag = next
    })
    return drag as DragState | null
  }
  const selected = () => [...editor.state.selectedIds].map((id) => editor.graph.getNode(id)?.name)
  /** The centre of a layer, in canvas units. */
  const center = (node: SceneNode) => {
    const abs = editor.graph.getAbsolutePosition(node.id)
    return { x: abs.x + node.width / 2, y: abs.y + node.height / 2 }
  }
  return { section, rows, row1, row2, first, second, below, pressAt, selected, center }
}

describe('presses after reaching a nested layer', () => {
  // Each case repeats a click observed in Figma desktop 126 on the shadcn kit's swatches.
  test('a press on a swatch in another row selects that row and leaves the entered card', () => {
    const { first, below, row2, pressAt, selected, center } = swatchRows()
    editor.select([first.swatch.id])
    editor.enterContainerOf(first.swatch.id)
    expect(editor.state.enteredContainerId).toBe(first.frame.id)

    const at = center(below.swatch)
    pressAt(at.x, at.y)
    expect(selected()).toEqual([row2.name])
    expect(editor.state.enteredContainerId).toBeNull()
  })

  test('a press on a swatch in a sibling card selects that card and enters the row', () => {
    const { first, second, row1, pressAt, selected, center } = swatchRows()
    editor.select([first.swatch.id])
    editor.enterContainerOf(first.swatch.id)

    const at = center(second.swatch)
    pressAt(at.x, at.y)
    expect(selected()).toEqual([second.frame.name])
    expect(editor.state.enteredContainerId).toBe(row1.id)
  })

  test('a press on nothing deselects, leaves every entered container, and starts a marquee', () => {
    const { first, pressAt, selected } = swatchRows()
    editor.select([first.swatch.id])
    editor.enterContainerOf(first.swatch.id)

    // The section's padding, with a selection, deselects without selecting the section.
    const drag = pressAt(10, 290)
    expect(selected()).toEqual([])
    expect(editor.state.enteredContainerId).toBeNull()
    expect(drag).toMatchObject({ type: 'marquee', selectsSection: false })

    // From nothing, the same press ends up selecting the section when it does not drag.
    expect(pressAt(10, 290)).toMatchObject({ type: 'marquee', selectsSection: true })
  })

  test('a press from nothing selects the row, the direct child of the top-level frame', () => {
    const { first, row1, pressAt, selected, center } = swatchRows()
    const at = center(first.swatch)
    pressAt(at.x, at.y)
    expect(selected()).toEqual([row1.name])
    expect(editor.state.enteredContainerId).toBeNull()
  })
})
