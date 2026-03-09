import { describe, test, expect } from 'bun:test'

import {
  toggleBoldInRange,
  toggleItalicInRange,
  applyStyleToRange,
  removeStyleFromRange,
  getStyleAt,
  type StyleRun,
} from '@open-pencil/core'

import {
  encodeVectorNetworkBlob,
  decodeVectorNetworkBlob,
  type VectorNetwork,
} from '@open-pencil/core'

import { SceneGraph, UndoManager } from '@open-pencil/core'

// ---------------------------------------------------------------------------
// toggleBoldInRange — mutation coverage
// ---------------------------------------------------------------------------

describe('toggleBoldInRange — partial bold → all bold', () => {
  test('mixed selection (some bold, some not) becomes all bold', () => {
    // chars 0-2 bold, chars 3-4 not — toggle on [0,5) should make all bold
    const runs: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const { runs: result, newWeight } = toggleBoldInRange(runs, 0, 5, 400, 5)
    expect(newWeight).toBe(700)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(result, i).fontWeight ?? 400).toBe(700)
    }
  })

  test('node-level weight 700 — chars without run override treated as bold', () => {
    // nodeWeight=700, no runs → all chars "bold" → toggle removes bold
    const { newWeight } = toggleBoldInRange([], 0, 5, 700, 5)
    expect(newWeight).toBe(400)
  })

  test('partial range: only middle chars toggled, edges unchanged', () => {
    const runs: StyleRun[] = []
    const { runs: result } = toggleBoldInRange(runs, 2, 6, 400, 10)
    // chars 0-1 and 6-9 should have no fontWeight override
    expect(getStyleAt(result, 0).fontWeight).toBeUndefined()
    expect(getStyleAt(result, 1).fontWeight).toBeUndefined()
    // chars 2-5 should be 700
    for (let i = 2; i < 6; i++) {
      expect(getStyleAt(result, i).fontWeight).toBe(700)
    }
    expect(getStyleAt(result, 6).fontWeight).toBeUndefined()
  })

  test('toggling bold twice returns to original state', () => {
    const runs: StyleRun[] = []
    const { runs: bolded } = toggleBoldInRange(runs, 0, 5, 400, 5)
    const { runs: restored } = toggleBoldInRange(bolded, 0, 5, 400, 5)
    // all chars should have no fontWeight override (back to node default)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(restored, i).fontWeight).toBeUndefined()
    }
  })

  test('does not mutate original runs array', () => {
    const original: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const snapshot = JSON.stringify(original)
    toggleBoldInRange(original, 0, 3, 400, 5)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

describe('toggleItalicInRange — mutation coverage', () => {
  test('partial italic → all italic', () => {
    const runs: StyleRun[] = [{ start: 0, length: 2, style: { italic: true } }]
    const { newItalic, runs: result } = toggleItalicInRange(runs, 0, 5, false, 5)
    expect(newItalic).toBe(true)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(result, i).italic ?? false).toBe(true)
    }
  })

  test('node-level italic=true, no runs → toggles off', () => {
    const { newItalic } = toggleItalicInRange([], 0, 5, true, 5)
    expect(newItalic).toBe(false)
  })

  test('toggling italic twice restores original', () => {
    const { runs: italicized } = toggleItalicInRange([], 0, 5, false, 5)
    const { runs: restored } = toggleItalicInRange(italicized, 0, 5, false, 5)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(restored, i).italic).toBeUndefined()
    }
  })
})

describe('applyStyleToRange — split and merge', () => {
  test('applying to middle of existing run splits it', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 700 } }]
    // apply italic only to chars 3-6
    const result = applyStyleToRange(runs, 3, 7, { italic: true }, 10)
    // chars 0-2: bold only
    expect(getStyleAt(result, 0)).toEqual({ fontWeight: 700 })
    expect(getStyleAt(result, 2)).toEqual({ fontWeight: 700 })
    // chars 3-6: bold + italic
    expect(getStyleAt(result, 3)).toEqual({ fontWeight: 700, italic: true })
    expect(getStyleAt(result, 6)).toEqual({ fontWeight: 700, italic: true })
    // chars 7-9: bold only
    expect(getStyleAt(result, 7)).toEqual({ fontWeight: 700 })
  })

  test('applying same style merges adjacent runs', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 3, style: { fontWeight: 700 } },
      { start: 5, length: 3, style: { fontWeight: 700 } },
    ]
    // fill the gap between them
    const result = applyStyleToRange(runs, 3, 5, { fontWeight: 700 }, 10)
    // should compact into one run
    const bold700Count = result.filter(r => r.style.fontWeight === 700).length
    expect(bold700Count).toBe(1)
    expect(result[0].length).toBe(8)
  })

  test('overwriting a property in range does not affect chars outside', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 400 } }]
    const result = applyStyleToRange(runs, 5, 10, { fontWeight: 700 }, 10)
    expect(getStyleAt(result, 4).fontWeight).toBe(400)
    expect(getStyleAt(result, 5).fontWeight).toBe(700)
    expect(getStyleAt(result, 9).fontWeight).toBe(700)
  })
})

describe('removeStyleFromRange — edge cases', () => {
  test('removing non-existent key leaves run intact', () => {
    const runs: StyleRun[] = [{ start: 0, length: 5, style: { italic: true } }]
    const result = removeStyleFromRange(runs, 0, 5, ['fontWeight'], 5)
    expect(getStyleAt(result, 0).italic).toBe(true)
    expect(result).toHaveLength(1)
  })

  test('removing all keys from run eliminates the run', () => {
    const runs: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    const result = removeStyleFromRange(runs, 0, 5, ['fontWeight'], 5)
    expect(result).toHaveLength(0)
  })

  test('partial removal preserves surrounding runs', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 700 } }]
    const result = removeStyleFromRange(runs, 3, 7, ['fontWeight'], 10)
    // chars 0-2 still bold
    expect(getStyleAt(result, 0).fontWeight).toBe(700)
    // chars 3-6 no override
    expect(getStyleAt(result, 3).fontWeight).toBeUndefined()
    // chars 7-9 still bold
    expect(getStyleAt(result, 7).fontWeight).toBe(700)
  })
})

// ---------------------------------------------------------------------------
// vectorNetworkBlob — precision and handleMirroring round-trip
// ---------------------------------------------------------------------------

describe('vectorNetworkBlob — precision and mirroring', () => {
  test('negative coordinates round-trip exactly', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: -123.456, y: -78.9, handleMirroring: 'NONE' },
        { x: -0.001, y: -999.999, handleMirroring: 'NONE' },
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      ],
      regions: [],
    }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.vertices[0].x).toBeCloseTo(-123.456, 2)
    expect(decoded.vertices[0].y).toBeCloseTo(-78.9, 2)
    expect(decoded.vertices[1].y).toBeCloseTo(-999.999, 2)
  })

  // handleMirroring is not encoded in vectorNetworkBlob (TODO in vector.ts:133).
  // ANGLE and ANGLE_AND_LENGTH are decoded as NONE — document this known limitation.
  test('handleMirroring NONE round-trips; ANGLE decodes as NONE (known limitation)', () => {
    const noneNetwork: VectorNetwork = {
      vertices: [{ x: 0, y: 0, handleMirroring: 'NONE' }, { x: 10, y: 0, handleMirroring: 'NONE' }],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: [],
    }
    const decodedNone = decodeVectorNetworkBlob(encodeVectorNetworkBlob(noneNetwork))
    expect(decodedNone.vertices[0].handleMirroring).toBe('NONE')

    // ANGLE is not persisted in blob — comes back as NONE
    const angleNetwork: VectorNetwork = {
      vertices: [{ x: 0, y: 0, handleMirroring: 'ANGLE' }, { x: 10, y: 0, handleMirroring: 'ANGLE' }],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: [],
    }
    const decodedAngle = decodeVectorNetworkBlob(encodeVectorNetworkBlob(angleNetwork))
    // This is a known limitation: handleMirroring is not stored in the blob format
    expect(decodedAngle.vertices[0].handleMirroring).toBe('NONE')
  })

  test('large bezier tangents preserve sign', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' },
        { x: 500, y: 500, handleMirroring: 'ANGLE' },
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: -200, y: 300 }, tangentEnd: { x: 150, y: -100 } },
      ],
      regions: [],
    }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.segments[0].tangentStart.x).toBeCloseTo(-200, 1)
    expect(decoded.segments[0].tangentStart.y).toBeCloseTo(300, 1)
    expect(decoded.segments[0].tangentEnd.x).toBeCloseTo(150, 1)
    expect(decoded.segments[0].tangentEnd.y).toBeCloseTo(-100, 1)
  })

  test('many vertices preserve order and count', () => {
    const n = 20
    const vertices = Array.from({ length: n }, (_, i) => ({
      x: i * 10,
      y: i * 5,
      handleMirroring: 'NONE' as const,
    }))
    const segments = Array.from({ length: n - 1 }, (_, i) => ({
      start: i,
      end: i + 1,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 },
    }))
    const network: VectorNetwork = { vertices, segments, regions: [] }
    const decoded = decodeVectorNetworkBlob(encodeVectorNetworkBlob(network))
    expect(decoded.vertices).toHaveLength(n)
    expect(decoded.segments).toHaveLength(n - 1)
    for (let i = 0; i < n; i++) {
      expect(decoded.vertices[i].x).toBeCloseTo(i * 10, 1)
      expect(decoded.vertices[i].y).toBeCloseTo(i * 5, 1)
    }
  })

  test('encode produces deterministic output', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 10, y: 20, handleMirroring: 'NONE' },
        { x: 30, y: 40, handleMirroring: 'ANGLE' },
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 5, y: 0 }, tangentEnd: { x: -5, y: 0 } },
      ],
      regions: [],
    }
    const a = encodeVectorNetworkBlob(network)
    const b = encodeVectorNetworkBlob(network)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SceneGraph + UndoManager — integration (updateNodeWithUndo pattern)
// ---------------------------------------------------------------------------

describe('SceneGraph + UndoManager — updateNode undo integration', () => {
  function makeSetup() {
    const graph = new SceneGraph()
    const undo = new UndoManager()
    const pageId = graph.getPages()[0].id

    function updateWithUndo(id: string, changes: Partial<Parameters<SceneGraph['updateNode']>[1]>, label: string) {
      const node = graph.getNode(id)!
      const previous = Object.fromEntries(
        (Object.keys(changes) as string[]).map(k => [k, (node as Record<string, unknown>)[k]])
      )
      graph.updateNode(id, changes)
      undo.push({
        label,
        forward: () => graph.updateNode(id, changes),
        inverse: () => graph.updateNode(id, previous as Parameters<SceneGraph['updateNode']>[1]),
      })
    }

    return { graph, undo, pageId, updateWithUndo }
  }

  test('update then undo restores previous value', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 200 }, 'move')
    expect(graph.getNode(id)!.x).toBe(200)

    undo.undo()
    expect(graph.getNode(id)!.x).toBe(0)
  })

  test('update → undo → redo restores updated value', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { width: 250 }, 'resize')
    undo.undo()
    expect(graph.getNode(id)!.width).toBe(100)
    undo.redo()
    expect(graph.getNode(id)!.width).toBe(250)
  })

  test('multiple updates undo in LIFO order', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 10 }, 'step1')
    updateWithUndo(id, { x: 20 }, 'step2')
    updateWithUndo(id, { x: 30 }, 'step3')

    undo.undo()
    expect(graph.getNode(id)!.x).toBe(20)
    undo.undo()
    expect(graph.getNode(id)!.x).toBe(10)
    undo.undo()
    expect(graph.getNode(id)!.x).toBe(0)
  })

  test('new action after undo clears redo stack', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 100 }, 'a')
    updateWithUndo(id, { x: 200 }, 'b')
    undo.undo()
    expect(undo.canRedo).toBe(true)

    // new action should kill redo
    updateWithUndo(id, { x: 300 }, 'c')
    expect(undo.canRedo).toBe(false)
    expect(graph.getNode(id)!.x).toBe(300)
  })

  test('undo does not affect other nodes', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const a = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 50, height: 50 }).id
    const b = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 50, height: 50 }).id

    updateWithUndo(a, { x: 100 }, 'move a')
    updateWithUndo(b, { x: 200 }, 'move b')

    undo.undo() // undoes move b
    expect(graph.getNode(b)!.x).toBe(0)
    expect(graph.getNode(a)!.x).toBe(100) // a unaffected

    undo.undo() // undoes move a
    expect(graph.getNode(a)!.x).toBe(0)
  })

  test('multi-field update: all fields restored on undo', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 50, y: 75, width: 200, height: 300 }, 'big move')
    const after = graph.getNode(id)!
    expect(after.x).toBe(50)
    expect(after.y).toBe(75)
    expect(after.width).toBe(200)
    expect(after.height).toBe(300)

    undo.undo()
    const restored = graph.getNode(id)!
    expect(restored.x).toBe(0)
    expect(restored.y).toBe(0)
    expect(restored.width).toBe(100)
    expect(restored.height).toBe(100)
  })

  test('batch: multiple updates undo as one', () => {
    const { graph, undo, pageId } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    undo.beginBatch('batch move')
    undo.apply({
      label: 'x',
      forward: () => graph.updateNode(id, { x: 10 }),
      inverse: () => graph.updateNode(id, { x: 0 }),
    })
    undo.apply({
      label: 'y',
      forward: () => graph.updateNode(id, { y: 20 }),
      inverse: () => graph.updateNode(id, { y: 0 }),
    })
    undo.commitBatch()

    expect(graph.getNode(id)!.x).toBe(10)
    expect(graph.getNode(id)!.y).toBe(20)
    expect(undo.undoLabel).toBe('batch move')

    undo.undo()
    expect(graph.getNode(id)!.x).toBe(0)
    expect(graph.getNode(id)!.y).toBe(0)
  })
})
