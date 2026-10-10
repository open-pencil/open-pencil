import { describe, expect, test } from 'bun:test'

import {
  combineToolbarEntry,
  DEFAULT_TOOLBAR_LAYOUT,
  detachToolbarEntry,
  joinToolbarEntry,
  moveToolbarEntry,
  normalizeToolbarLayout,
  placeToolbarEntry,
  setToolbarEntryHidden,
  toolbarDropOperations,
  toolbarItems,
  toolbarRows,
  type ToolbarEntry,
  type ToolbarLayout
} from '@/app/editor/toolbar/layout'
import { TOOL_SHORTCUT_LABELS } from '@/app/editor/toolbar/shortcuts'

const SHAPES: ToolbarEntry[] = ['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR']
const LABELS = { ...TOOL_SHORTCUT_LABELS }

function layout(groups: ToolbarEntry[][], hidden: ToolbarEntry[] = []): ToolbarLayout {
  return normalizeToolbarLayout(groups, hidden)
}

describe('normalizeToolbarLayout', () => {
  test('keeps the default layout as it is', () => {
    expect(layout(DEFAULT_TOOLBAR_LAYOUT.groups)).toEqual(DEFAULT_TOOLBAR_LAYOUT)
  })

  test('drops unknown entries, repeats and empty groups', () => {
    const groups = [['SELECT', 'LASSO', 'SELECT'], [], ['FRAME', 'SECTION', 'FRAME']]
    const result = normalizeToolbarLayout(groups, ['HAND', 'HAND', 'GHOST'])
    expect(result.groups.slice(0, 2)).toEqual([['SELECT'], ['FRAME', 'SECTION']])
    expect(result.hidden).toEqual(['HAND'])
  })

  test('never hides Move', () => {
    expect(layout(DEFAULT_TOOLBAR_LAYOUT.groups, ['SELECT', 'PEN']).hidden).toEqual(['PEN'])
  })

  test('keeps commands out of flyouts', () => {
    const result = layout([['SELECT', 'insert-icon', 'HAND'], ['COMMENT']])
    expect(result.groups.slice(-4)).toEqual([['TEXT'], ['insert-icon'], ['HAND'], ['COMMENT']])
  })

  test('puts a tool the stored layout lacks into its default flyout', () => {
    const result = layout([['SELECT'], ['STAR', 'RECTANGLE', 'ELLIPSE'], ['LINE']])
    expect(result.groups[2]).toEqual(['STAR', 'RECTANGLE', 'ELLIPSE', 'POLYGON'])
    expect(result.groups.at(-1)).toEqual(['LINE'])
  })

  test('places a tool whose flyout is gone after the entry before it by default', () => {
    const stored: ToolbarEntry[][] = [['TEXT'], ['SELECT'], SHAPES, ['HAND']]
    expect(layout(stored).groups).toEqual([
      ['TEXT'],
      ['SELECT'],
      ['FRAME', 'SECTION'],
      SHAPES,
      ['PEN'],
      ['HAND'],
      ['COMMENT'],
      ['insert-icon']
    ])
  })
})

describe('toolbarItems', () => {
  test('makes a button of a single shown tool and a flyout keyed by the first shown member', () => {
    const items = toolbarItems(
      layout(DEFAULT_TOOLBAR_LAYOUT.groups, ['SECTION', 'RECTANGLE']),
      LABELS,
      TOOL_SHORTCUT_LABELS
    )
    expect(items[1]).toEqual({
      kind: 'tool',
      tool: { key: 'FRAME', label: 'F', shortcut: 'F' }
    })
    expect(items[2]).toEqual({
      kind: 'tool',
      tool: {
        key: 'LINE',
        label: 'L',
        shortcut: 'L',
        flyout: ['LINE', 'ELLIPSE', 'POLYGON', 'STAR']
      }
    })
    expect(items.at(-1)).toEqual({ kind: 'action', action: 'insert-icon' })
  })

  test('leaves out a flyout whose members are all hidden', () => {
    const items = toolbarItems(
      layout(DEFAULT_TOOLBAR_LAYOUT.groups, ['FRAME', 'SECTION']),
      LABELS,
      TOOL_SHORTCUT_LABELS
    )
    expect(items.map((item) => (item.kind === 'tool' ? item.tool.key : item.action))).not.toContain(
      'FRAME'
    )
  })
})

describe('editing', () => {
  const base = layout(DEFAULT_TOOLBAR_LAYOUT.groups)

  test('hiding and showing keeps the entry in place', () => {
    const hidden = setToolbarEntryHidden(base, 'PEN', true)
    expect(hidden.hidden).toEqual(['PEN'])
    expect(hidden.groups).toEqual(base.groups)
    expect(setToolbarEntryHidden(hidden, 'PEN', false).hidden).toEqual([])
    expect(setToolbarEntryHidden(base, 'SELECT', true)).toBe(base)
  })

  test('a button swaps with the button or flyout next to it', () => {
    const moved = moveToolbarEntry(base, 'PEN', -1)
    expect(moved.groups.slice(2, 4)).toEqual([['PEN'], SHAPES])
    expect(moveToolbarEntry(base, 'SELECT', -1)).toBe(base)
  })

  test('a flyout member moves inside the flyout and past its end becomes a button', () => {
    const inside = moveToolbarEntry(base, 'SECTION', -1)
    expect(inside.groups[1]).toEqual(['SECTION', 'FRAME'])
    const out = moveToolbarEntry(inside, 'SECTION', -1)
    expect(out.groups.slice(0, 3)).toEqual([['SELECT'], ['SECTION'], ['FRAME']])
    const below = moveToolbarEntry(base, 'SECTION', 1)
    expect(below.groups.slice(1, 3)).toEqual([['FRAME'], ['SECTION']])
  })

  test('joining merges a group into the one above', () => {
    const joined = joinToolbarEntry(base, 'TEXT')
    expect(joined.groups[3]).toEqual(['PEN', 'TEXT'])
    expect(joinToolbarEntry(base, 'insert-icon')).toBe(base)
    expect(joinToolbarEntry(base, 'SELECT')).toBe(base)
    expect(joinToolbarEntry(base, 'LINE')).toBe(base)
  })

  test('removing a tool from its flyout leaves only it a button, after the flyout', () => {
    expect(detachToolbarEntry(base, 'ELLIPSE').groups.slice(2, 4)).toEqual([
      ['RECTANGLE', 'LINE', 'POLYGON', 'STAR'],
      ['ELLIPSE']
    ])
    expect(detachToolbarEntry(base, 'PEN')).toBe(base)
  })

  test('rows say how each entry relates to the one above', () => {
    const rows = toolbarRows(base)
    const row = (entry: ToolbarEntry) => rows.find((candidate) => candidate.entry === entry)
    expect(row('SELECT')).toMatchObject({
      joined: false,
      canJoin: false,
      canMoveUp: false
    })
    expect(row('SECTION')).toMatchObject({
      joined: true,
      canJoin: false,
      canMoveUp: true
    })
    expect(row('PEN')).toMatchObject({ joined: false, canJoin: true })
    expect(row('insert-icon')).toMatchObject({
      canJoin: false,
      canMoveDown: false
    })
  })
})

describe('dragging', () => {
  const base = layout(DEFAULT_TOOLBAR_LAYOUT.groups)
  /** Where an entry sits in the list the dragged Pen is lifted out of. */
  const indexOf = (entry: ToolbarEntry) => {
    const flat: ToolbarEntry[] = base.groups.flat().filter((other) => other !== 'PEN')
    return flat.indexOf(entry)
  }

  test('a tool dropped between two flyout members joins the flyout', () => {
    const dropped = placeToolbarEntry(base, 'PEN', indexOf('LINE'))
    expect(dropped.groups[2]).toEqual(['RECTANGLE', 'PEN', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR'])
  })

  test('a tool dropped between groups becomes a button there', () => {
    const dropped = placeToolbarEntry(base, 'PEN', indexOf('RECTANGLE'))
    expect(dropped.groups.slice(1, 4)).toEqual([['FRAME', 'SECTION'], ['PEN'], SHAPES])
  })

  test('a flyout member dragged to the gap leaves its flyout', () => {
    const flat = base.groups.flat().filter((entry) => entry !== 'SECTION')
    const dropped = placeToolbarEntry(base, 'SECTION', flat.indexOf('PEN'))
    expect(dropped.groups.slice(1, 5)).toEqual([['FRAME'], SHAPES, ['SECTION'], ['PEN']])
  })

  test('a command never lands inside a flyout', () => {
    const flat = base.groups.flat().filter((entry) => entry !== 'insert-icon')
    const dropped = placeToolbarEntry(base, 'insert-icon', flat.indexOf('LINE'))
    expect(dropped.groups.slice(2, 4)).toEqual([SHAPES, ['insert-icon']])
    expect(toolbarDropOperations(base, 'insert-icon', 'LINE')).toEqual({
      'reorder-before': false,
      'reorder-after': false,
      combine: false
    })
    expect(toolbarDropOperations(base, 'insert-icon', 'RECTANGLE')['reorder-before']).toBe(true)
  })

  test('a tool dropped onto another shares its flyout, right after it', () => {
    expect(combineToolbarEntry(base, 'COMMENT', 'TEXT').groups).toContainEqual(['TEXT', 'COMMENT'])
    expect(combineToolbarEntry(base, 'PEN', 'LINE').groups[2]).toEqual([
      'RECTANGLE',
      'LINE',
      'PEN',
      'ELLIPSE',
      'POLYGON',
      'STAR'
    ])
    expect(combineToolbarEntry(base, 'LINE', 'STAR')).toBe(base)
    expect(combineToolbarEntry(base, 'PEN', 'insert-icon')).toBe(base)
  })
})
