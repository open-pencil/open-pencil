import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Rect } from '@open-pencil/core'
import { computeOverlaps } from '@open-pencil/core/tools/analyze/overlaps'

import { frame, pageId, rect } from './helpers'

describe('analyze overlaps visible bounds', () => {
  test('large background below a small badge is not reported as overlay', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'Backdrop', page, 0, 0, 100, 100)
    rect(graph, 'Badge', page, 10, 10, 10, 10)

    const result = computeOverlaps(graph)
    expect(result.overlaps.some((o) => o.category === 'overlay')).toBe(false)
    expect(result.overlaps.some((o) => o.category === 'sibling-overlap')).toBe(true)
  })

  test('text decoration extends visual bounds below raw height', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const t = graph.createNode('TEXT', page, {
      name: 'Underlined',
      x: 0,
      y: 0,
      width: 100,
      height: 10,
      text: 'Underlined',
      fontSize: 14,
      textDecoration: 'UNDERLINE'
    })
    rect(graph, 'Below', page, 0, 11, 100, 10)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBeGreaterThan(0)
    expect(result.overlaps.some((o) => o.nodeA.id === t.id || o.nodeB.id === t.id)).toBe(true)
  })

  test('vector geometry expands bounds beyond width and height', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    function rectGeometryBlob(local: Rect) {
      const parts = [
        { cmd: 1, x: local.x, y: local.y },
        { cmd: 2, x: local.x + local.width, y: local.y },
        { cmd: 2, x: local.x + local.width, y: local.y + local.height },
        { cmd: 2, x: local.x, y: local.y + local.height },
        { cmd: 0 }
      ]
      let byteLength = 0
      for (const part of parts) {
        byteLength += 1
        if (part.x !== undefined) byteLength += 8
      }
      const bytes = new Uint8Array(byteLength)
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      let offset = 0
      for (const part of parts) {
        bytes[offset++] = part.cmd
        if (part.x !== undefined) {
          dv.setFloat32(offset, part.x, true)
          dv.setFloat32(offset + 4, part.y as number, true)
          offset += 8
        }
      }
      return bytes
    }

    const v = graph.createNode('VECTOR', page, {
      name: 'WideVector',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fillGeometry: [
        {
          commandsBlob: rectGeometryBlob({ x: 0, y: 0, width: 200, height: 200 }),
          windingRule: 'NONZERO'
        }
      ]
    })
    rect(graph, 'Far', page, 150, 150, 50, 50)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBeGreaterThan(0)
    expect(result.overlaps.some((o) => o.nodeA.id === v.id || o.nodeB.id === v.id)).toBe(true)
  })

  test('ancestor clipping prevents false overlaps across the clip boundary', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    const clipFrame = frame(graph, 'ClipFrame', page, 0, 0, 50, 50, true)
    rect(graph, 'ClippedChild', clipFrame.id, 40, 0, 20, 20)
    rect(graph, 'Outside', page, 50, 0, 20, 20)

    const clipped = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(clipped.summary.overlapCount).toBe(0)

    const noClipFrame = frame(graph, 'NoClipFrame', page, 200, 0, 50, 50, false)
    rect(graph, 'UnclippedChild', noClipFrame.id, 40, 0, 20, 20)
    rect(graph, 'Outside2', page, 250, 0, 20, 20)

    const unclipped = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(unclipped.summary.overlapCount).toBe(1)
  })

  test('rotated clipping frame prevents false sibling overlap', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    // A 90°-rotated clipping frame. Its local space [0,100]x[0,100] maps to
    // canvas [0,100]x[0,100] (a square rotated 90° around its center is the
    // same square). But the OLD axis-aligned clip used the rotated origin
    // (100,0) and produced a wrong clip rectangle [100,200]x[0,100].
    const clipFrame = frame(graph, 'RotatedClip', page, 0, 0, 100, 100, true)
    graph.updateNode(clipFrame.id, { rotation: 90 })

    // Child at local (10,10,20,20). After 90° rotation around the frame
    // center (50,50), the child lands at canvas AABB [70,90]x[10,30].
    rect(graph, 'Child', clipFrame.id, 10, 10, 20, 20)

    // Outside node starting exactly at the clip frame's right boundary.
    // With the BUGGY code the child's clipped bounds were [100,110]x[10,30]
    // (wrong), producing a false overlap with [100,120]x[10,30].
    // With the fix the child's clipped bounds are [70,90]x[10,30] (correct),
    // so there is no overlap.
    rect(graph, 'Outside', page, 100, 10, 20, 20)

    const result = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBe(0)
  })

  test('child of rotated non-clipping parent is detected at correct position', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    // Non-clipping parent rotated 90°. A child at local (10,10,20,20)
    // maps to canvas AABB [70,90]x[10,30] after rotation. A second node
    // placed at canvas (72,12,10,10) should overlap — proving the bounds
    // are computed from the world matrix, not from the rotated origin.
    const parent = frame(graph, 'RotatedParent', page, 0, 0, 100, 100, false)
    graph.updateNode(parent.id, { rotation: 90 })
    const child = rect(graph, 'Child', parent.id, 10, 10, 20, 20)
    rect(graph, 'OverlapTarget', page, 72, 12, 10, 10)

    const result = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
    expect(result.overlaps.some((o) => o.nodeA.id === child.id || o.nodeB.id === child.id)).toBe(
      true
    )
  })

  test('rotated clipping frame still clips children that protrude', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    // 90°-rotated clipping frame at (0,0,100,100). Its canvas-space clip is
    // [0,100]x[0,100] (a square rotated 90° around its center is the same
    // square). The OLD axis-aligned clip used the rotated origin (100,0) and
    // produced a wrong clip rectangle [100,200]x[0,100].
    const clipFrame = frame(graph, 'RotatedClip90', page, 0, 0, 100, 100, true)
    graph.updateNode(clipFrame.id, { rotation: 90 })

    // Child at local (10,10,80,80) — a large child whose AABB (after 90°
    // rotation) is [10,90]x[10,90], entirely inside the [0,100]x[0,100] clip.
    rect(graph, 'Center', clipFrame.id, 10, 10, 80, 80)

    // Outside node at (110,10,20,20) — its AABB [110,130]x[10,30] does NOT
    // overlap the child's clipped AABB [10,90]x[10,90] and does NOT overlap
    // the clip frame's AABB [0,100]x[0,100]. With the BUGGY code, the child's
    // clipped bounds were [100,170]x[10,90] (wrong), which WOULD overlap
    // [110,130]x[10,30] — a false positive.
    rect(graph, 'Outside', page, 110, 10, 20, 20)

    const result = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBe(0)
  })

  test('a stroked rotated node expands bounds along the rotated axes', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    // 10x10 rectangle at (45,45) rotated 45° around its center (50,50). Its
    // unstroked canvas AABB is [42.93, 57.07]² (half-diagonal ≈ 7.07).
    // An OUTSIDE stroke of weight 20 expands the LOCAL box by 20 on each side;
    // after 45° rotation the canvas-space expansion is 20*(|cos45|+|sin45|) ≈
    // 28.28 per side, so the stroked AABB is [14.64, 85.36]². The OLD code
    // expanded the already-rotated AABB by 20 → only [22.93, 77.07]².
    const stroked = graph.createNode('RECTANGLE', page, {
      name: 'RotatedStroked',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      rotation: 45,
      strokes: [
        {
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 20,
          opacity: 1,
          visible: true,
          align: 'OUTSIDE'
        }
      ]
    })

    // Target at canvas (18, 48, 2, 2): inside the rotation-aware stroked AABB
    // (18 > 14.64) but outside both the unstroked AABB (18 < 42.93) and the
    // OLD naive expansion (18 < 22.93). Only the rotation-aware stroke reaches it.
    rect(graph, 'GapTarget', page, 18, 48, 2, 2)

    const result = computeOverlaps(graph, { category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
    expect(
      result.overlaps.some((o) => o.nodeA.id === stroked.id || o.nodeB.id === stroked.id)
    ).toBe(true)

    // Without the stroke, the same target must NOT overlap — proving the reach
    // into the gap is caused by the stroked bounds, not the raw node box.
    const plain = new SceneGraph()
    const plainPage = pageId(plain)
    plain.createNode('RECTANGLE', plainPage, {
      name: 'RotatedPlain',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      rotation: 45
    })
    rect(plain, 'GapTarget', plainPage, 18, 48, 2, 2)
    const plainResult = computeOverlaps(plain, { category: 'sibling-overlap' })
    expect(plainResult.summary.overlapCount).toBe(0)
  })
})
